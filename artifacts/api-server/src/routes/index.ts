import { Router, type IRouter } from "express";
import healthRouter from "./health";
import companiesRouter from "./companies";
import coursesRouter from "./courses";
import sessionsRouter from "./sessions";
import studentsRouter from "./students";
import attendanceRouter from "./attendance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(companiesRouter);
router.use(coursesRouter);
router.use(sessionsRouter);
router.use(studentsRouter);
router.use(attendanceRouter);

export default router;
