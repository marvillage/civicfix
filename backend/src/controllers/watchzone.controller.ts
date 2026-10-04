import { z } from "zod";
import { IssueCategory } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { input } from "../middleware/validate.middleware";
import { asyncHandler, param } from "../lib/http";
import {
  createWatchZone,
  deleteWatchZone,
  getWatchZoneIssues,
  listWatchZones,
  updateWatchZone,
  WATCH_ZONE_RADIUS,
} from "../services/watchzone.service";
import { latitudeField, longitudeField } from "./schema.helpers";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const zoneFields = {
  name: z
    .string({ error: "name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(40, "Name must be at most 40 characters"),
  latitude: latitudeField,
  longitude: longitudeField,
  radiusM: z
    .number({ error: "radiusM must be a number" })
    .int("radiusM must be a whole number of metres")
    .min(
      WATCH_ZONE_RADIUS.min,
      `radiusM must be between ${WATCH_ZONE_RADIUS.min} and ${WATCH_ZONE_RADIUS.max}`
    )
    .max(
      WATCH_ZONE_RADIUS.max,
      `radiusM must be between ${WATCH_ZONE_RADIUS.min} and ${WATCH_ZONE_RADIUS.max}`
    ),
  categories: z.array(z.enum(IssueCategory)).optional(),
};

export const createWatchZoneBody = z.object(zoneFields);

export const updateWatchZoneBody = z
  .object(zoneFields)
  .partial()
  .refine(
    (patch) =>
      Object.values(patch).some((value) => value !== undefined),
    { message: "Send at least one field to update" }
  );

// ─────────────────────────────────────────────
// HANDLERS — every route is owner-scoped in the service
// ─────────────────────────────────────────────

export const listWatchZonesController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const zones = await listWatchZones(req.user!.userId);

    res.json({ zones });
  });

export const createWatchZoneController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = input(res, "body", createWatchZoneBody);
    const zone = await createWatchZone(req.user!.userId, body);

    res.status(201).json({ zone });
  });

export const updateWatchZoneController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = input(res, "body", updateWatchZoneBody);
    const zone = await updateWatchZone(
      req.user!.userId,
      param(req, "id"),
      body
    );

    res.json({ zone });
  });

export const deleteWatchZoneController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    await deleteWatchZone(req.user!.userId, param(req, "id"));

    res.json({ message: "Watch zone deleted" });
  });

export const getWatchZoneIssuesController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const issues = await getWatchZoneIssues(
      req.user!.userId,
      param(req, "id")
    );

    res.json({ issues });
  });
