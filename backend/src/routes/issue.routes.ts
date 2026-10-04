import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";

import {
  getPublicIssuesController,
  getIssueByIdController,
  getAllIssuesController,
  adminIssuesQuerySchema,
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
  requirePermission("issue:read:all"),
  validate({ query: adminIssuesQuerySchema }),
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
  requirePermission("issue:comment"),
  createCommentController
);

// Direct Line: the service also checks the caller is the
// reporter, the assigned officer or an admin.
router.get(
  "/:issueId/messages",
  authenticate,
  requirePermission("issue:message"),
  getIssueMessagesController
);

router.post(
  "/:issueId/messages",
  authenticate,
  requirePermission("issue:message"),
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
  requirePermission("issue:status"),
  updateIssueStatusController
);

router.post(
  "/:issueId/duplicate",
  authenticate,
  requirePermission("issue:duplicate"),
  markDuplicateController
);

export default router;
