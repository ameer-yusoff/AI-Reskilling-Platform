import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profilesRouter from "./profiles";
import catalogRouter from "./catalog";
import marketRouter from "./market";
import aiRouter from "./ai";
import cohortRouter from "./cohort";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profilesRouter);
router.use(catalogRouter);
router.use(marketRouter);
router.use(aiRouter);
router.use(cohortRouter);

export default router;
