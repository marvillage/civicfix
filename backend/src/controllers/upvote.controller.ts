import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { param } from "../lib/http";
import { upvoteIssue } from "../services/upvote.service";

export async function upvoteIssueController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const issueId = param(req, "issueId");

    if (!issueId) {
      return res.status(400).json({
        message: "Issue ID is required",
      });
    }

    await upvoteIssue(req.user.userId, issueId);

    return res.status(201).json({
      message: "Issue upvoted successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ISSUE_NOT_FOUND") {
        return res.status(404).json({
          message: "Issue not found",
        });
      }

      if (error.message === "ALREADY_UPVOTED") {
        return res.status(409).json({
          message: "You have already upvoted this issue",
        });
      }
    }

    console.error("Upvote error:", error);

    return res.status(500).json({
      message: "Something went wrong while upvoting the issue",
    });
  }
}
