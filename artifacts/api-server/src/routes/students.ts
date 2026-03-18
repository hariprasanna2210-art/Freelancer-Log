import { Router, type IRouter } from "express";
import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateStudentBody, DeleteStudentParams, ListStudentsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/students", async (req, res) => {
  const { courseId } = ListStudentsQueryParams.parse(req.query);
  const students = courseId
    ? await db.select().from(studentsTable).where(eq(studentsTable.courseId, courseId)).orderBy(studentsTable.name)
    : await db.select().from(studentsTable).orderBy(studentsTable.name);

  res.json(students.map((s) => ({
    id: s.id,
    courseId: s.courseId,
    name: s.name,
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/students", async (req, res) => {
  const body = CreateStudentBody.parse(req.body);
  const [student] = await db.insert(studentsTable).values({ courseId: body.courseId, name: body.name }).returning();
  res.status(201).json({
    id: student.id,
    courseId: student.courseId,
    name: student.name,
    createdAt: student.createdAt.toISOString(),
  });
});

router.delete("/students/:id", async (req, res) => {
  const { id } = DeleteStudentParams.parse({ id: req.params.id });
  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  res.json({ success: true });
});

export default router;
