import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  budgetPulseQuerySchema,
  getBudgetPulseController,
  getPulseController,
  pulseQuerySchema,
} from "../controllers/pulse.controller";

const router = Router();

// ─────────────────────────────────────────────
// CITY PULSE — public analytics (cached 60 s per query)
// ─────────────────────────────────────────────

router.get(
  "/",
  validate({ query: pulseQuerySchema }),
  getPulseController
);

// ─────────────────────────────────────────────
// SPEND AGAINST BUDGET — staff analytics
// ─────────────────────────────────────────────

router.get(
  "/budget",
  authenticate,
  requirePermission("analytics:full"),
  validate({ query: budgetPulseQuerySchema }),
  getBudgetPulseController
);

export default router;
