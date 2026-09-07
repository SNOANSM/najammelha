import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(authRouter);

export default router;
