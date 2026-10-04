import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createWatchZoneBody,
  createWatchZoneController,
  deleteWatchZoneController,
  getWatchZoneIssuesController,
  listWatchZonesController,
  updateWatchZoneBody,
  updateWatchZoneController,
} from "../controllers/watchzone.controller";

// ─────────────────────────────────────────────
// WATCH ZONES — /api/watch-zones
// Every route needs watchzone:manage; zones are owner-only
// (another user's zone id answers 404).
// ─────────────────────────────────────────────

const router = Router();

router.use(authenticate, requirePermission("watchzone:manage"));

router.get("/", listWatchZonesController);

router.post(
  "/",
  validate({ body: createWatchZoneBody }),
  createWatchZoneController
);

router.patch(
  "/:id",
  validate({ body: updateWatchZoneBody }),
  updateWatchZoneController
);

router.delete("/:id", deleteWatchZoneController);

router.get("/:id/issues", getWatchZoneIssuesController);

export default router;
