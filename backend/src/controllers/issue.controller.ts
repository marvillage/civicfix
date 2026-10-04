import { Request, Response } from "express";
import { z } from "zod";
import {
  IssueCategory,
  IssueStatus,
} from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { asyncHandler, HttpError, param } from "../lib/http";
import { recordAudit } from "../services/audit.service";
import { input } from "../middleware/validate.middleware";
import {
  getPublicIssues,
  getIssueById,
  getAllIssues,
  getNearbyIssues,
  updateIssueStatus,
  markIssueDuplicate,
} from "../services/issue.service";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

// Empty query values ("?status=") mean "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional()
  );

const dateQuery = z
  .string()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Dates must look like YYYY-MM-DD"
  );

export const publicIssuesQuerySchema = z
  .object({
    q: optional(z.string().trim().max(100)),
    category: optional(
      z.enum(IssueCategory, { error: "Unknown category" })
    ),
    status: optional(
      z.enum(IssueStatus, { error: "Unknown status" })
    ),
    wardId: optional(z.string().trim().min(1).max(64)),
    from: optional(dateQuery),
    to: optional(dateQuery),
    sort: optional(
      z.enum(["newest", "oldest", "upvotes"], {
        error: "sort must be newest, oldest or upvotes",
      })
    ),
    limit: z.coerce
      .number({ error: "limit must be a number" })
      .int()
      .min(1, "limit must be between 1 and 200")
      .max(200, "limit must be between 1 and 200")
      .default(50),
    cursor: optional(z.string().trim().min(1).max(64)),
  })
  .refine(
    (query) =>
      query.sort !== "upvotes" ||
      !query.cursor ||
      /^\d{1,7}$/.test(query.cursor),
    {
      message: "cursor for sort=upvotes is the nextCursor of the previous page",
      path: ["cursor"],
    }
  );

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

    const issueId = param(req, "issueId");
    const { originalIssueId } = req.body ?? {};

    if (!originalIssueId || typeof originalIssueId !== "string") {
      return res.status(400).json({
        message: "originalIssueId is required",
      });
    }

    const result = await markIssueDuplicate(
      issueId,
      originalIssueId,
      req.user.userId
    );

    await recordAudit({
      actorId: req.user.userId,
      action: "issue.duplicate",
      entityType: "Issue",
      entityId: issueId,
      meta: { originalId: originalIssueId },
      ip: req.ip,
    });

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

// GET /issues?q&category&status&wardId&from&to&sort&limit&cursor
// → { issues, nextCursor }. Validated here because the route
// file only wires the handler.
export const getPublicIssuesController = asyncHandler(
  async (req, res) => {
    const parsed = publicIssuesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid query",
        "VALIDATION_FAILED",
        z.flattenError(parsed.error)
      );
    }

    return res.status(200).json(await getPublicIssues(parsed.data));
  }
);

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

export const adminIssuesQuerySchema = z.object({
  view: z
    .enum(["open", "closed", "all"], {
      error: "view must be open, closed or all",
    })
    .default("open"),
  q: optional(z.string().trim().max(100)),
  category: optional(
    z.enum(IssueCategory, { error: "Unknown category" })
  ),
  wardId: optional(z.string().trim().min(1).max(64)),
  limit: z.coerce
    .number({ error: "limit must be a number" })
    .int()
    .min(1, "limit must be between 1 and 500")
    .max(500, "limit must be between 1 and 500")
    .default(100),
  cursor: optional(z.string().trim().min(1).max(64)),
});

export const getAllIssuesController = asyncHandler(async (_req, res) => {
  const filters = input(res, "query", adminIssuesQuerySchema);

  return res.status(200).json(await getAllIssues(filters));
});

export async function getIssueByIdController(
  req: Request,
  res: Response
) {
  try {
    const issueId = param(req, "issueId");

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

    const issueId = param(req, "issueId");
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