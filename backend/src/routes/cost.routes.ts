import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  deleteCostController,
  listIssueCostsController,
  logCostSchema,
  logIssueCostController,
} from "../controllers/cost.controller";
import {
  budgetQuerySchema,
  getBudgetsController,
  setBudgetController,
  setBudgetSchema,
} from "../controllers/budget.controller";

// Mounted at /api: the ledger spans /issues/:issueId/costs,
// /costs/:id and /budgets. Ownership and department scope
// are enforced in the services on top of these gates.
const router = Router();

// ─────────────────────────────────────────────
// COSTS ON A CASE
// ─────────────────────────────────────────────

router.get(
  "/issues/:issueId/costs",
  authenticate,
  requirePermission("cost:read"),
  listIssueCostsController
);

router.post(
  "/issues/:issueId/costs",
  authenticate,
  requirePermission("cost:log"),
  validate({ body: logCostSchema }),
  logIssueCostController
);

// The logger (within 24 h) or an admin — checked in the service.
router.delete(
  "/costs/:id",
  authenticate,
  requirePermission("cost:log"),
  deleteCostController
);

// ─────────────────────────────────────────────
// DEPARTMENT BUDGETS
// ─────────────────────────────────────────────

router.get(
  "/budgets",
  authenticate,
  requirePermission("budget:read"),
  validate({ query: budgetQuerySchema }),
  getBudgetsController
);

router.put(
  "/budgets",
  authenticate,
  requirePermission("budget:manage"),
  validate({ body: setBudgetSchema }),
  setBudgetController
);

export default router;
