import { Router, type IRouter } from "express";
import { db, attendanceTable, studentsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { GetSessionAttendanceParams, SaveSessionAttendanceParams, SaveSessionAttendanceBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions/:sessionId/attendance", async (req, res) => {
  const { sessionId } = GetSessionAttendanceParams.parse({ sessionId: req.params.sessionId });

  const records = await db
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
    .where(eq(attendanceTable.sessionId, sessionId))
    .orderBy(studentsTable.name);

  res.json(records.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    studentId: r.studentId,
    studentName: r.studentName ?? "",
    isPresent: r.isPresent,
    remark: r.remark ?? undefined,
  })));
});

router.post("/sessions/:sessionId/attendance", async (req, res) => {
  const { sessionId } = SaveSessionAttendanceParams.parse({ sessionId: req.params.sessionId });
  const body = SaveSessionAttendanceBody.parse(req.body);

  if (body.length === 0) {
    res.json({ success: true });
    return;
  }

  const studentIds = body.map((b) => b.studentId);

  // Delete existing attendance for this session's students
  await db
    .delete(attendanceTable)
    .where(eq(attendanceTable.sessionId, sessionId));

  // Insert fresh
  await db.insert(attendanceTable).values(
    body.map((b) => ({
      sessionId,
      studentId: b.studentId,
      isPresent: b.isPresent,
      remark: b.remark ?? null,
    }))
  );

  res.json({ success: true });
});

export default router;
