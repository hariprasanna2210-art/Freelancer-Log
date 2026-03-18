import { Router, type IRouter } from "express";
import { db, coursesTable, companiesTable, sessionsTable, studentsTable, attendanceTable } from "@workspace/db";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { CreateCourseBody, DeleteCourseParams, GetCourseReportParams, GetCourseReportQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/courses", async (_req, res) => {
  const courses = await db
    .select({
      id: coursesTable.id,
      companyId: coursesTable.companyId,
      companyName: companiesTable.name,
      name: coursesTable.name,
      batch: coursesTable.batch,
      totalHours: coursesTable.totalHours,
      hoursUsed: sql<string>`COALESCE(SUM(${sessionsTable.hoursTeached}), 0)`,
      createdAt: coursesTable.createdAt,
    })
    .from(coursesTable)
    .leftJoin(companiesTable, eq(coursesTable.companyId, companiesTable.id))
    .leftJoin(sessionsTable, eq(sessionsTable.courseId, coursesTable.id))
    .groupBy(coursesTable.id, companiesTable.name)
    .orderBy(coursesTable.createdAt);

  const result = courses.map((c) => {
    const totalHours = parseFloat(c.totalHours ?? "0");
    const hoursUsed = parseFloat(c.hoursUsed ?? "0");
    return {
      id: c.id,
      companyId: c.companyId,
      companyName: c.companyName ?? "",
      name: c.name,
      batch: c.batch,
      totalHours,
      hoursUsed,
      hoursRemaining: Math.max(0, totalHours - hoursUsed),
      createdAt: c.createdAt.toISOString(),
    };
  });

  res.json(result);
});

router.post("/courses", async (req, res) => {
  const body = CreateCourseBody.parse(req.body);
  const [course] = await db
    .insert(coursesTable)
    .values({
      companyId: body.companyId,
      name: body.name,
      batch: body.batch,
      totalHours: String(body.totalHours),
    })
    .returning();

  const company = await db.select().from(companiesTable).where(eq(companiesTable.id, course.companyId)).limit(1);

  res.status(201).json({
    id: course.id,
    companyId: course.companyId,
    companyName: company[0]?.name ?? "",
    name: course.name,
    batch: course.batch,
    totalHours: parseFloat(course.totalHours),
    hoursUsed: 0,
    hoursRemaining: parseFloat(course.totalHours),
    createdAt: course.createdAt.toISOString(),
  });
});

router.delete("/courses/:id", async (req, res) => {
  const { id } = DeleteCourseParams.parse({ id: req.params.id });
  await db.delete(coursesTable).where(eq(coursesTable.id, id));
  res.json({ success: true });
});

router.get("/courses/:id/report", async (req, res) => {
  const { id } = GetCourseReportParams.parse({ id: req.params.id });
  const { startDate, endDate } = GetCourseReportQueryParams.parse(req.query);

  // Load course + company info
  const [courseRow] = await db
    .select({
      id: coursesTable.id,
      name: coursesTable.name,
      batch: coursesTable.batch,
      totalHours: coursesTable.totalHours,
      companyName: companiesTable.name,
      createdAt: coursesTable.createdAt,
    })
    .from(coursesTable)
    .leftJoin(companiesTable, eq(coursesTable.companyId, companiesTable.id))
    .where(eq(coursesTable.id, id));

  if (!courseRow) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  // Build session filter conditions
  const conditions: ReturnType<typeof eq>[] = [eq(sessionsTable.courseId, id) as any];
  if (startDate) conditions.push(gte(sessionsTable.date, startDate) as any);
  if (endDate) conditions.push(lte(sessionsTable.date, endDate) as any);

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(and(...conditions))
    .orderBy(sessionsTable.date);

  // Load students for this course
  const students = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.courseId, id))
    .orderBy(studentsTable.name);

  // Load attendance for all sessions
  const sessionIds = sessions.map((s) => s.id);
  let attendanceRows: { id: number; sessionId: number; studentId: number; studentName: string; isPresent: boolean; remark: string | null }[] = [];

  if (sessionIds.length > 0) {
    attendanceRows = await db
      .select({
        id: attendanceTable.id,
        sessionId: attendanceTable.sessionId,
        studentId: attendanceTable.studentId,
        studentName: studentsTable.name,
        isPresent: attendanceTable.isPresent,
        remark: attendanceTable.remark,
      })
      .from(attendanceTable)
      .leftJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
      .where(sql`${attendanceTable.sessionId} = ANY(${sql.raw(`ARRAY[${sessionIds.join(",")}]::int[]`)})`)
      .orderBy(studentsTable.name);
  }

  // Group attendance by session
  const attendanceBySession: Record<number, typeof attendanceRows> = {};
  for (const row of attendanceRows) {
    if (!attendanceBySession[row.sessionId]) attendanceBySession[row.sessionId] = [];
    attendanceBySession[row.sessionId].push(row);
  }

  const totalHours = parseFloat(courseRow.totalHours ?? "0");
  const hoursUsed = sessions.reduce((acc, s) => acc + parseFloat(s.hoursTeached ?? "0"), 0);

  const startDateStr = sessions.length > 0 ? sessions[0].date : undefined;
  const endDateStr = sessions.length > 0 ? sessions[sessions.length - 1].date : undefined;

  res.json({
    courseId: courseRow.id,
    courseName: courseRow.name,
    companyName: courseRow.companyName ?? "",
    batch: courseRow.batch,
    totalHours,
    hoursUsed,
    hoursRemaining: Math.max(0, totalHours - hoursUsed),
    startDate: startDateStr,
    endDate: endDateStr,
    students: students.map((s) => ({
      id: s.id,
      courseId: s.courseId,
      name: s.name,
      createdAt: s.createdAt.toISOString(),
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      hoursTeached: parseFloat(s.hoursTeached ?? "0"),
      studentsCount: s.studentsCount,
      studentsAbsent: s.studentsAbsent,
      notes: s.notes ?? undefined,
      attendance: (attendanceBySession[s.id] ?? []).map((a) => ({
        id: a.id,
        sessionId: a.sessionId,
        studentId: a.studentId,
        studentName: a.studentName,
        isPresent: a.isPresent,
        remark: a.remark ?? undefined,
      })),
    })),
  });
});

export default router;
