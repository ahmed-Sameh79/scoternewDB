import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import warehousesRouter from "./warehouses";
import categoriesRouter from "./categories";
import motorcycleMetaRouter from "./motorcycle-meta";
import partsRouter from "./parts";
import motorcyclesRouter from "./motorcycles";
import vendorsRouter from "./vendors";
import purchaseOrdersRouter from "./purchase-orders";
import grnRouter from "./grn";
import workOrdersRouter from "./work-orders";
import invoicesRouter from "./invoices";
import inspectionsRouter from "./inspections";
import auditRouter from "./audit";
import analyticsRouter from "./analytics";
import uploadsRouter from "./uploads";
import siteRouter from "./site";
import publicRouter from "./public";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/site", siteRouter);
router.use(publicRouter);

router.use(requireAuth);

router.use(usersRouter);
router.use(warehousesRouter);
router.use(categoriesRouter);
router.use(motorcycleMetaRouter);
router.use(partsRouter);
router.use(motorcyclesRouter);
router.use(vendorsRouter);
router.use(purchaseOrdersRouter);
router.use(grnRouter);
router.use(workOrdersRouter);
router.use(invoicesRouter);
router.use(inspectionsRouter);
router.use(auditRouter);
router.use(analyticsRouter);
router.use(uploadsRouter);

export default router;
