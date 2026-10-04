import { z } from "zod";
import { CostKind } from "../generated/prisma/client";
import { asyncHandler, param } from "../lib/http";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { input } from "../middleware/validate.middleware";
import {
  deleteCost,
  listIssueCosts,
  logIssueCost,
} from "../services/cost.service";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

export const logCostSchema = z.object({
  kind: z.enum(CostKind, {
    error: "kind must be MATERIAL, LABOUR, EQUIPMENT or CONTRACTOR",
  }),
  description: z
    .string({ error: "description is required" })
    .trim()
    .min(3, "Describe the cost in at least 3 characters")
    .max(200, "Keep the description under 200 characters"),
  amount: z
    .number({ error: "amount must be a number of rupees" })
    .int("amount must be whole rupees")
    .min(1, "amount must be at least ₹1")
    .max(10_000_000, "amount cannot exceed ₹1,00,00,000"),
});

// ─────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────

export const listIssueCostsController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await listIssueCosts(
      req.user!,
      param(req, "issueId")
    );

    return res.json(result);
  });

export const logIssueCostController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const cost = await logIssueCost(
      req.user!,
      param(req, "issueId"),
      input(res, "body", logCostSchema)
    );

    return res.status(201).json({ cost });
  });

export const deleteCostController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    await deleteCost(req.user!, param(req, "id"), req.ip);

    return res.json({ message: "Cost entry removed" });
  });
