import { z } from "zod";
import { asyncHandler, param } from "../lib/http";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { input } from "../middleware/validate.middleware";
import {
  getDrive,
  joinDrive,
  leaveDrive,
  listDrives,
  moderateDrive,
  proposeDrive,
  recordAttendance,
} from "../services/drive.service";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === ""
        ? undefined
        : value,
    z.string().trim().max(max).optional()
  );

const optionalId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().min(1).max(64).optional()
);

export const driveListQuerySchema = z.object({
  status: z
    .enum(["upcoming", "past", "pending", "mine"], {
      error: "status must be upcoming, past, pending or mine",
    })
    .default("upcoming"),
});

export const proposeDriveSchema = z.object({
  title: z
    .string({ error: "title is required" })
    .trim()
    .min(4, "Title must be at least 4 characters")
    .max(100, "Title must be at most 100 characters"),
  description: z
    .string({ error: "description is required" })
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description must be at most 1000 characters"),
  startsAt: z.coerce.date({ error: "startsAt must be a date and time" }),
  capacity: z
    .number({ error: "capacity must be a number" })
    .int("capacity must be a whole number")
    .min(2, "capacity must be at least 2")
    .max(500, "capacity can be at most 500"),
  latitude: z
    .number({ error: "latitude is required" })
    .min(-90)
    .max(90),
  longitude: z
    .number({ error: "longitude is required" })
    .min(-180)
    .max(180),
  address: optionalText(200),
  wardId: optionalId,
  issueId: optionalId,
});

export const moderateDriveSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"], {
    error: "decision must be APPROVE or REJECT",
  }),
  note: optionalText(500),
});

export const attendanceSchema = z.object({
  userIds: z
    .array(z.string().trim().min(1), {
      error: "userIds must be a list of user ids",
    })
    .min(1, "Mark at least one attendee")
    .max(500, "At most 500 attendees"),
});

// ─────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────

export const listDrivesController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { status } = input(res, "query", driveListQuerySchema);

    return res.json({ drives: await listDrives(status, req.user) });
  });

export const getDriveController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    return res.json(await getDrive(param(req, "id"), req.user));
  });

export const proposeDriveController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const drive = await proposeDrive(
      req.user!,
      input(res, "body", proposeDriveSchema)
    );

    return res.status(201).json({ drive });
  });

export const moderateDriveController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { decision, note } = input(res, "body", moderateDriveSchema);

    const drive = await moderateDrive(
      req.user!,
      param(req, "id"),
      decision,
      note,
      req.ip
    );

    return res.json({ drive });
  });

export const joinDriveController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    return res.json({
      drive: await joinDrive(req.user!, param(req, "id")),
    });
  });

export const leaveDriveController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    return res.json({
      drive: await leaveDrive(req.user!, param(req, "id")),
    });
  });

export const recordAttendanceController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { userIds } = input(res, "body", attendanceSchema);

    return res.json({
      drive: await recordAttendance(
        req.user!,
        param(req, "id"),
        userIds
      ),
    });
  });
