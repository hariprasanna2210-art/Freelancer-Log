import { Router, type IRouter } from "express";
import { db, coursesTable, companiesTable, sessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCourseBody, DeleteCourseParams } from "@workspace/api-zod";

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

export default router;
