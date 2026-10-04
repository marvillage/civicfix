import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import {
  createSLAController,
  checkSLABreachesController,
} from "../controllers/sla.controller";

const router = Router();

router.post(
  "/",
  authenticate,
  requirePermission("sla:manage"),
  createSLAController
);

router.post(
  "/check-breaches",
  authenticate,
  requirePermission("sla:manage"),
  checkSLABreachesController
);

export default router;
