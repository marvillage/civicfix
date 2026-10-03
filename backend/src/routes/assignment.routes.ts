import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
import upload from "../middleware/upload.middleware";
import {
  createAssignmentController,
  getMyAssignmentsController,
  getAllAssignmentsController,
  acceptAssignmentController,
  startAssignmentController,
  resolveAssignmentController,
  addProgressUpdateController,
} from "../controllers/assignment.controller";

const router = Router();

// Create / reassign an issue
router.post(
  "/",
  authenticate,
  authorizeRoles("AUTHORITY", "ADMIN"),
  createAssignmentController
);

// Get all assignments — Admin
router.get(
  "/all",
  authenticate,
  authorizeRoles("ADMIN"),
  getAllAssignmentsController
);

// Get assignments belonging to logged-in authority
router.get(
  "/my",
  authenticate,
  authorizeRoles("AUTHORITY", "ADMIN"),
  getMyAssignmentsController
);

// Accept assignment
router.patch(
  "/:assignmentId/accept",
  authenticate,
  authorizeRoles("AUTHORITY", "ADMIN"),
  acceptAssignmentController
);

// Start work
router.patch(
  "/:assignmentId/start",
  authenticate,
  authorizeRoles("AUTHORITY", "ADMIN"),
  startAssignmentController
);

// Post a mid-work progress update (note + optional photo)
router.post(
  "/:assignmentId/progress",
  authenticate,
  authorizeRoles("AUTHORITY", "ADMIN"),
  upload.single("photo"),
  addProgressUpdateController
);

// Resolve issue (optional "proof" photo of the completed work)
router.patch(
  "/:assignmentId/resolve",
  authenticate,
  authorizeRoles("AUTHORITY", "ADMIN"),
  upload.single("proof"),
  resolveAssignmentController
);

export default router;