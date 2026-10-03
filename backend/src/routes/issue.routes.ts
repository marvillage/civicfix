import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

import {
  getPublicIssuesController,
  getIssueByIdController,
  getAllIssuesController,
  getNearbyIssuesController,
  updateIssueStatusController,
  markDuplicateController,
} from "../controllers/issue.controller";
import {
  getIssueCommentsController,
  createCommentController,
} from "../controllers/comment.controller";
import {
  getIssueMessagesController,
  sendIssueMessageController,
} from "../controllers/message.controller";

const router = Router();

// ─────────────────────────────────────────────
// PUBLIC ISSUES
// ─────────────────────────────────────────────

router.get(
  "/",
  getPublicIssuesController
);

// ─────────────────────────────────────────────
// ADMIN — ALL ISSUES
// IMPORTANT: This must come BEFORE /:issueId
// ─────────────────────────────────────────────

router.get(
  "/admin/all",
  authenticate,
  authorizeRoles("ADMIN"),
  getAllIssuesController
);

router.get(
  "/nearby",
  getNearbyIssuesController
);

router.get(
  "/:issueId/comments",
  getIssueCommentsController
);

router.post(
  "/:issueId/comments",
  authenticate,
  createCommentController
);

router.get(
  "/:issueId/messages",
  authenticate,
  getIssueMessagesController
);

router.post(
  "/:issueId/messages",
  authenticate,
  sendIssueMessageController
);

// ─────────────────────────────────────────────
// ISSUE BY ID
// ─────────────────────────────────────────────

router.get(
  "/:issueId",
  getIssueByIdController
);

// ─────────────────────────────────────────────
// UPDATE ISSUE STATUS
// ─────────────────────────────────────────────

router.patch(
  "/:issueId/status",
  authenticate,
  authorizeRoles("AUTHORITY", "ADMIN"),
  updateIssueStatusController
);

router.post(
  "/:issueId/duplicate",
  authenticate,
  authorizeRoles("ADMIN"),
  markDuplicateController
);

export default router;