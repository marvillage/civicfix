import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { reportUpload } from "../middleware/upload.middleware";
import {
  createComplaintController,
  createAnonymousComplaintController,
  createFieldReportController,
  getMyComplaintsController,
  getComplaintByIdController,
  verifyComplaintResolutionController,
  withdrawComplaintController,
} from "../controllers/complaint.controller";

const router = Router();

router.post(
  "/",
  authenticate,
  requirePermission("issue:report"),
  reportUpload,
  createComplaintController
);

router.post(
  "/anonymous",
  reportUpload,
  createAnonymousComplaintController
);

router.post(
  "/field",
  authenticate,
  requirePermission("field:report"),
  reportUpload,
  createFieldReportController
);

// The routes below only need a signed-in user: the services
// scope every query to the caller's own complaints.

router.get(
  "/my",
  authenticate,
  getMyComplaintsController
);

router.get(
  "/:id",
  authenticate,
  getComplaintByIdController
);

router.patch(
  "/:complaintId/verify",
  authenticate,
  verifyComplaintResolutionController
);

router.delete(
  "/:id",
  authenticate,
  withdrawComplaintController
);

export default router;
