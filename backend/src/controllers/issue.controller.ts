import { Request, Response } from "express";
import { IssueStatus } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  getPublicIssues,
  getIssueById,
  getAllIssues,
  getNearbyIssues,
  updateIssueStatus,
  markIssueDuplicate,
} from "../services/issue.service";

export async function markDuplicateController(
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
    const { originalIssueId } = req.body;

    if (!originalIssueId) {
      return res.status(400).json({
        message: "originalIssueId is required",
      });
    }

    const result = await markIssueDuplicate(
      issueId,
      originalIssueId,
      req.user.userId
    );

    return res.status(200).json({
      message: "Issue marked as duplicate and upvotes merged",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SAME_ISSUE") {
        return res.status(400).json({
          message: "An issue cannot be a duplicate of itself",
        });
      }

      if (error.message === "ISSUE_NOT_FOUND") {
        return res.status(404).json({
          message: "One of the issues was not found",
        });
      }

      if (error.message === "ORIGINAL_IS_DUPLICATE") {
        return res.status(400).json({
          message:
            "The original issue is itself marked as a duplicate — pick its original instead",
        });
      }
    }

    console.error("Mark duplicate error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while marking the duplicate",
    });
  }
}

export async function getPublicIssuesController(
  req: Request,
  res: Response
) {
  try {
    const { q, category, status, wardId, from, to, sort } =
      req.query;

    const issues = await getPublicIssues({
      q: typeof q === "string" ? q : undefined,
      category:
        typeof category === "string" && category
          ? category
          : undefined,
      status:
        typeof status === "string" && status
          ? status
          : undefined,
      wardId:
        typeof wardId === "string" && wardId
          ? wardId
          : undefined,
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
      sort: typeof sort === "string" ? sort : undefined,
    });

    return res.status(200).json({
      issues,
    });
  } catch (error) {
    console.error(
      "Get public issues error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching issues",
    });
  }
}

export async function getNearbyIssuesController(
  req: Request,
  res: Response
) {
  try {
    const { lat, lng, category, radius, limit } =
      req.query;

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return res.status(400).json({
        message: "Valid lat and lng are required",
      });
    }

    const radiusMeters = Math.min(
      Number(radius) || 500,
      10000
    );

    const resultLimit = Math.min(
      Number(limit) || 5,
      30
    );

    const issues = await getNearbyIssues(
      latitude,
      longitude,
      typeof category === "string" && category
        ? category
        : undefined,
      radiusMeters,
      resultLimit
    );

    return res.status(200).json({
      issues,
    });
  } catch (error) {
    console.error("Get nearby issues error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while fetching nearby issues",
    });
  }
}

export async function getAllIssuesController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const issues = await getAllIssues();

    return res.status(200).json({
      issues,
    });
  } catch (error) {
    console.error(
      "Get all issues error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching all issues",
    });
  }
}

export async function getIssueByIdController(
  req: Request,
  res: Response
) {
  try {
    const { issueId } = req.params;

    if (!issueId) {
      return res.status(400).json({
        message: "Issue ID is required",
      });
    }

    const issue = await getIssueById(
      issueId
    );

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    return res.status(200).json({
      issue,
    });
  } catch (error) {
    console.error(
      "Get issue error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while fetching the issue",
    });
  }
}

export async function updateIssueStatusController(
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
    const { status, note } = req.body;

    if (!issueId) {
      return res.status(400).json({
        message: "Issue ID is required",
      });
    }

    if (
      !status ||
      !Object.values(IssueStatus).includes(
        status
      )
    ) {
      return res.status(400).json({
        message: "Invalid issue status",
      });
    }

    const issue = await updateIssueStatus(
      issueId,
      req.user.userId,
      status,
      note
    );

    return res.status(200).json({
      message:
        "Issue status updated successfully",
      issue,
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

    console.error(
      "Update issue status error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while updating the issue status",
    });
  }
}