import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import cvRouter from "./cv.js";
import interviewRouter from "./interview.js";
import identityRouter from "./identity.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cvRouter);
router.use(interviewRouter);
router.use(identityRouter);

export default router;
