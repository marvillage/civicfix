import { z } from "zod";
import { asyncHandler } from "../lib/http";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { input } from "../middleware/validate.middleware";
import {
  currentMonth,
  getBudgets,
  setBudget,
} from "../services/budget.service";
import { isMonthKey } from "../services/pulse.helpers";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const month = z
  .string()
  .trim()
  .refine(isMonthKey, "month must look like YYYY-MM");

export const budgetQuerySchema = z.object({
  month: z.preprocess(
    (value) => (value === "" ? undefined : value),
    month.optional()
  ),
});

export const setBudgetSchema = z.object({
  departmentId: z
    .string({ error: "departmentId is required" })
    .trim()
    .min(1, "departmentId is required"),
  month,
  amount: z
    .number({ error: "amount must be a number of rupees" })
    .int("amount must be whole rupees")
    .min(0, "amount cannot be negative")
    .max(1_000_000_000, "amount cannot exceed ₹1,00,00,00,000"),
});

// ─────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────

export const getBudgetsController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = input(res, "query", budgetQuerySchema);

    return res.json(
      await getBudgets(req.user!, query.month ?? currentMonth())
    );
  });

export const setBudgetController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const budget = await setBudget(
      req.user!,
      input(res, "body", setBudgetSchema),
      req.ip
    );

    return res.json({ budget });
  });
