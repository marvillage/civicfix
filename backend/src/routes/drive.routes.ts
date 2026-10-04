import { Router } from "express";
import {
  authenticate,
  optionalAuthenticate,
} from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  attendanceSchema,
  driveListQuerySchema,
  getDriveController,
  joinDriveController,
  leaveDriveController,
  listDrivesController,
  moderateDriveController,
  moderateDriveSchema,
  proposeDriveController,
  proposeDriveSchema,
  recordAttendanceController,
} from "../controllers/drive.controller";

const router = Router();

// ─────────────────────────────────────────────
// BROWSE — public; signed-in users also see their RSVP
// ─────────────────────────────────────────────

router.get(
  "/",
  optionalAuthenticate,
  validate({ query: driveListQuerySchema }),
  listDrivesController
);

router.get("/:id", optionalAuthenticate, getDriveController);

// ─────────────────────────────────────────────
// PROPOSE & MODERATE
// ─────────────────────────────────────────────

router.post(
  "/",
  authenticate,
  requirePermission("drive:propose"),
  validate({ body: proposeDriveSchema }),
  proposeDriveController
);

router.post(
  "/:id/moderate",
  authenticate,
  requirePermission("drive:moderate"),
  validate({ body: moderateDriveSchema }),
  moderateDriveController
);

// ─────────────────────────────────────────────
// RSVP
// ─────────────────────────────────────────────

router.post(
  "/:id/rsvp",
  authenticate,
  requirePermission("drive:join"),
  joinDriveController
);

router.delete(
  "/:id/rsvp",
  authenticate,
  requirePermission("drive:join"),
  leaveDriveController
);

// ─────────────────────────────────────────────
// ATTENDANCE — organiser or moderator (checked in the
// service, since organisers are citizens)
// ─────────────────────────────────────────────

router.post(
  "/:id/attendance",
  authenticate,
  validate({ body: attendanceSchema }),
  recordAttendanceController
);

export default router;
