import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import authRouter from "./auth";
import rewardsRouter from "./rewards";
import geocodeRouter from "./geocode";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(dashboardRouter);
router.use(storageRouter);
router.use(authRouter);
router.use(rewardsRouter);
router.use(geocodeRouter);

export default router;
