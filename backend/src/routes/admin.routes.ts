import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  accessMatrixController,
  auditEventsController,
  auditEventsQuery,
} from "../controllers/admin.controller";

// ─────────────────────────────────────────────
// ADMINISTRATION — /api/admin
// ─────────────────────────────────────────────

const router = Router();

router.get(
  "/access-matrix",
  authenticate,
  requirePermission("rbac:read"),
  accessMatrixController
);

router.get(
  "/audit-events",
  authenticate,
  requirePermission("audit:read"),
  validate({ query: auditEventsQuery }),
  auditEventsController
);

export default router;
