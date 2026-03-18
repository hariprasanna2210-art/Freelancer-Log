import { Router, type IRouter } from "express";
import { db, sessionsTable, coursesTable, companiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateSessionBody, DeleteSessionParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions", async (_req, res) => {
  const sessions = await db
    .select({
      id: sessionsTable.id,
      courseId: sessionsTable.courseId,
      courseName: coursesTable.name,
      companyId: coursesTable.companyId,
      companyName: companiesTable.name,
      batch: coursesTable.batch,
      date: sessionsTable.date,
      hoursTeached: sessionsTable.hoursTeached,
      studentsCount: sessionsTable.studentsCount,
      studentsAbsent: sessionsTable.studentsAbsent,
      notes: sessionsTable.notes,
      createdAt: sessionsTable.createdAt,
    })
    .from(sessionsTable)
    .leftJoin(coursesTable, eq(sessionsTable.courseId, coursesTable.id))
    .leftJoin(companiesTable, eq(coursesTable.companyId, companiesTable.id))
    .orderBy(desc(sessionsTable.date), desc(sessionsTable.createdAt));

  const result = sessions.map((s) => ({
    id: s.id,
    courseId: s.courseId,
    courseName: s.courseName ?? "",
    companyId: s.companyId ?? 0,
    companyName: s.companyName ?? "",
    batch: s.batch ?? "",
    date: s.date,
    hoursTeached: parseFloat(s.hoursTeached ?? "0"),
    studentsCount: s.studentsCount,
    studentsAbsent: s.studentsAbsent,
    notes: s.notes ?? undefined,
    createdAt: s.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/sessions", async (req, res) => {
  const body = CreateSessionBody.parse(req.body);

  const [session] = await db
    .insert(sessionsTable)
    .values({
      courseId: body.courseId,
      date: body.date,
      hoursTeached: String(body.hoursTeached),
      studentsCount: body.studentsCount,
      studentsAbsent: body.studentsAbsent,
      notes: body.notes ?? null,
    })
    .returning();

  const courseWithCompany = await db
    .select({
      courseName: coursesTable.name,
      companyId: coursesTable.companyId,
      companyName: companiesTable.name,
      batch: coursesTable.batch,
    })
    .from(coursesTable)
    .leftJoin(companiesTable, eq(coursesTable.companyId, companiesTable.id))
    .where(eq(coursesTable.id, session.courseId))
    .limit(1);

  const courseInfo = courseWithCompany[0];

  res.status(201).json({
    id: session.id,
    courseId: session.courseId,
    courseName: courseInfo?.courseName ?? "",
    companyId: courseInfo?.companyId ?? 0,
    companyName: courseInfo?.companyName ?? "",
    batch: courseInfo?.batch ?? "",
    date: session.date,
    hoursTeached: parseFloat(session.hoursTeached ?? "0"),
    studentsCount: session.studentsCount,
    studentsAbsent: session.studentsAbsent,
    notes: session.notes ?? undefined,
    createdAt: session.createdAt.toISOString(),
  });
});

router.delete("/sessions/:id", async (req, res) => {
  const { id } = DeleteSessionParams.parse({ id: req.params.id });
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
  res.json({ success: true });
});

export default router;
