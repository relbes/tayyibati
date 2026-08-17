import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foodsRouter from "./foods";
import analysisRouter from "./analysis";
import historyRouter from "./history";
import usersRouter from "./users";
import adminRouter from "./admin";
import plansRouter from "./plans";
import configRouter from "./config";
import dishesRouter from "./dishes";
import { adminKnowledgeReviewRouter } from "./adminKnowledgeReview";
import { adminAiCacheRouter } from "./adminAiCache";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(plansRouter);
router.use(foodsRouter);
router.use(dishesRouter);
router.use(analysisRouter);
router.use(historyRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use("/admin/knowledge-review", adminKnowledgeReviewRouter);
router.use("/admin/ai-cache", adminAiCacheRouter);

export default router;
