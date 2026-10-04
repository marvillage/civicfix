import { z } from "zod";
import { input } from "../middleware/validate.middleware";
import { asyncHandler } from "../lib/http";
import { accessMatrix } from "../auth/permissions";
import { getAuditEvents } from "../services/audit.service";
import { cursorPage } from "./schema.helpers";

// ─────────────────────────────────────────────
// ACCESS CONTROL MATRIX
// ─────────────────────────────────────────────

export const accessMatrixController = asyncHandler(async (_req, res) => {
  res.json(accessMatrix());
});

// ─────────────────────────────────────────────
// AUDIT EVENTS (Paper Trail)
// ─────────────────────────────────────────────

export const auditEventsQuery = z.object({
  ...cursorPage,
  // Prefix match, e.g. "user." or "poll.close"
  action: z.string().trim().min(1).max(64).optional(),
});

export const auditEventsController = asyncHandler(async (_req, res) => {
  const query = input(res, "query", auditEventsQuery);
  const { events, nextCursor } = await getAuditEvents(query);

  res.json({
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      meta: event.meta,
      ip: event.ip,
      createdAt: event.createdAt,
      actor: event.actor,
    })),
    nextCursor,
  });
});
