import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
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
  authorizeRoles("AUTHORITY", "ADMIN"),
  reportUpload,
  createFieldReportController
);

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