import { z } from "zod";
import { IssueCategory } from "../generated/prisma/client";
import { asyncHandler } from "../lib/http";
import { input } from "../middleware/validate.middleware";
import { getBudgetPulse, getPulse } from "../services/pulse.service";
import { RANGE_KEYS } from "../services/pulse.helpers";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

// Empty query values ("?wardId=") mean "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional()
  );

export const pulseQuerySchema = z.object({
  range: z
    .enum(RANGE_KEYS, {
      error: "range must be one of 30d, 90d or 12m",
    })
    .default("90d"),
  wardId: optional(z.string().trim().min(1).max(64)),
  category: optional(
    z.enum(IssueCategory, { error: "Unknown category" })
  ),
});

export const budgetPulseQuerySchema = z.object({
  months: z.coerce
    .number({ error: "months must be a number" })
    .int()
    .min(3, "months must be between 3 and 12")
    .max(12, "months must be between 3 and 12")
    .default(6),
});

// ─────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────

export const getPulseController = asyncHandler(async (_req, res) => {
  const query = input(res, "query", pulseQuerySchema);

  res.set("Cache-Control", "public, max-age=60");

  return res.json(await getPulse(query));
});

export const getBudgetPulseController = asyncHandler(
  async (_req, res) => {
    const { months } = input(res, "query", budgetPulseQuerySchema);

    return res.json(await getBudgetPulse(months));
  }
);
