import { z } from "zod";
import { BulletinKind } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { input } from "../middleware/validate.middleware";
import { asyncHandler, param } from "../lib/http";
import { recordAudit } from "../services/audit.service";
import {
  BULLETIN_STATUS_FILTERS,
  isValidBulletinWindow,
} from "../services/bulletin.rules";
import {
  createBulletin,
  deleteBulletin,
  listBulletins,
} from "../services/bulletin.service";
import {
  cursorPage,
  dateField,
  optionalId,
} from "./schema.helpers";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

export const listBulletinsQuery = z.object({
  status: z.enum(BULLETIN_STATUS_FILTERS).default("active"),
  wardId: optionalId,
  kind: z.enum(BulletinKind).optional(),
  ...cursorPage,
});

export const createBulletinBody = z
  .object({
    title: z
      .string()
      .trim()
      .min(4, "Title must be at least 4 characters")
      .max(120, "Title must be at most 120 characters"),
    body: z
      .string()
      .trim()
      .min(10, "Body must be at least 10 characters")
      .max(2000, "Body must be at most 2000 characters"),
    kind: z.enum(BulletinKind, {
      error: "kind must be OUTAGE, ROADWORKS, ADVISORY or EVENT",
    }),
    wardId: optionalId,
    // Honoured for bulletin:manage only; officers get their own.
    departmentId: optionalId,
    startsAt: dateField("startsAt"),
    endsAt: dateField("endsAt").nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (bulletin) =>
      isValidBulletinWindow(bulletin.startsAt, bulletin.endsAt),
    { message: "endsAt must be after startsAt", path: ["endsAt"] }
  );

// ─────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────

export const listBulletinsController = asyncHandler(
  async (_req, res) => {
    const query = input(res, "query", listBulletinsQuery);

    res.json(await listBulletins(query));
  }
);

export const createBulletinController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = input(res, "body", createBulletinBody);
    const bulletin = await createBulletin(req.user!, body);

    await recordAudit({
      actorId: req.user!.userId,
      action: "bulletin.publish",
      entityType: "Bulletin",
      entityId: bulletin.id,
      meta: {
        title: bulletin.title,
        kind: bulletin.kind,
        wardId: bulletin.ward?.id ?? null,
        departmentId: bulletin.department?.id ?? null,
        pinned: bulletin.pinned,
      },
      ip: req.ip,
    });

    res.status(201).json({ bulletin });
  });

export const deleteBulletinController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const bulletin = await deleteBulletin(
      req.user!,
      param(req, "id")
    );

    await recordAudit({
      actorId: req.user!.userId,
      action: "bulletin.delete",
      entityType: "Bulletin",
      entityId: bulletin.id,
      meta: {
        title: bulletin.title,
        kind: bulletin.kind,
        authorId: bulletin.authorId,
      },
      ip: req.ip,
    });

    res.json({ message: "Bulletin removed" });
  });
