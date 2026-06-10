import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foodsRouter from "./foods";
import analysisRouter from "./analysis";
import historyRouter from "./history";
import usersRouter from "./users";
import adminRouter from "./admin";
import plansRouter from "./plans";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(plansRouter);
router.use(foodsRouter);
router.use(analysisRouter);
router.use(historyRouter);
router.use(usersRouter);
router.use(adminRouter);

export default router;
