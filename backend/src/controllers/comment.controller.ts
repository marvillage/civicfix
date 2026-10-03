import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  getIssueComments,
  createComment,
} from "../services/comment.service";

export async function getIssueCommentsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { issueId } = req.params;

    const comments = await getIssueComments(issueId);

    return res.status(200).json({
      comments,
    });
  } catch (error) {
    console.error("Get comments error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching comments",
    });
  }
}

export async function createCommentController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { issueId } = req.params;
    const { text } = req.body;

    if (
      !text ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return res.status(400).json({
        message: "Comment text is required",
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        message: "Comment is too long (max 2000 characters)",
      });
    }

    const comment = await createComment(
      issueId,
      req.user.userId,
      text.trim()
    );

    return res.status(201).json({
      message: "Comment added",
      comment,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ISSUE_NOT_FOUND"
    ) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    console.error("Create comment error:", error);

    return res.status(500).json({
      message: "Something went wrong while adding the comment",
    });
  }
}
