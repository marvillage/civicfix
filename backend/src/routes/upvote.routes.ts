import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { upvoteIssueController } from "../controllers/upvote.controller";

const router = Router();

router.post(
  "/:issueId/upvote",
  authenticate,
  requirePermission("issue:upvote"),
  upvoteIssueController
);

export default router;
