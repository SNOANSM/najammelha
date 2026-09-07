import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(storageRouter);

export default router;
