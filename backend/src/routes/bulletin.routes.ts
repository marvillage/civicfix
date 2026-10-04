import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createBulletinBody,
  createBulletinController,
  deleteBulletinController,
  listBulletinsController,
  listBulletinsQuery,
} from "../controllers/bulletin.controller";

// ─────────────────────────────────────────────
// WARD BULLETINS — /api/bulletins
// ─────────────────────────────────────────────

const router = Router();

router.get(
  "/",
  validate({ query: listBulletinsQuery }),
  listBulletinsController
);

// Officers publish for their own department; pinning needs
// bulletin:manage (checked in the service).
router.post(
  "/",
  authenticate,
  requirePermission("bulletin:publish"),
  validate({ body: createBulletinBody }),
  createBulletinController
);

// The author or bulletin:manage (checked in the service).
router.delete(
  "/:id",
  authenticate,
  deleteBulletinController
);

export default router;
