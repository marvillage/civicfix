import { prisma } from "../lib/prisma";
import {
  HttpError,
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../lib/http";
import { can, PERMISSIONS } from "../auth/permissions";
import { Prisma } from "../generated/prisma/client";
import { recordAudit } from "./audit.service";
import { createNotification } from "./notification.service";
import { USER_REF_SELECT } from "./cost.service";

// ─────────────────────────────────────────────
// CLEANUP DRIVES
// Citizen-organised volunteer events:
//   PROPOSED → (moderator) APPROVED | REJECTED
//   APPROVED → RSVPs until it starts → attendance → COMPLETED
// Capacity is enforced inside a serializable transaction;
// the (driveId, userId) unique constraint stops double RSVPs.
// ─────────────────────────────────────────────

export interface Viewer {
  userId: string;
  role: string;
}

const HOUR_MS = 3_600_000;
const MIN_LEAD_MS = 2 * HOUR_MS; // proposals start ≥ 2 h out
const UPCOMING_GRACE_MS = 6 * HOUR_MS; // still "upcoming" while on
const ATTENDEE_POINTS = 15;
const ORGANIZER_POINTS = 25;
const LIST_LIMIT = 100;

const DRIVE_INCLUDE = {
  ward: { select: { id: true, name: true, code: true } },
  issue: {
    select: { id: true, title: true, status: true, category: true },
  },
  organizer: { select: USER_REF_SELECT },
  rsvps: { select: { userId: true, attended: true } },
} as const;

type DriveRow = Prisma.DriveGetPayload<{
  include: typeof DRIVE_INCLUDE;
}>;

const isModerator = (viewer?: Viewer) =>
  !!viewer && can(viewer.role, "drive:moderate");

// Contract shape: counts and the viewer's own RSVP, never
// the full RSVP list (that is only on the detail view).
function toDrive(drive: DriveRow, viewer?: Viewer) {
  const mine = viewer
    ? drive.rsvps.find((rsvp) => rsvp.userId === viewer.userId)
    : undefined;

  return {
    id: drive.id,
    title: drive.title,
    description: drive.description,
    startsAt: drive.startsAt,
    capacity: drive.capacity,
    status: drive.status,
    moderationNote: drive.moderationNote,
    address: drive.address,
    latitude: drive.latitude,
    longitude: drive.longitude,
    ward: drive.ward,
    issue: drive.issue,
    organizer: drive.organizer,
    rsvpCount: drive.rsvps.length,
    attendedCount: drive.rsvps.filter((rsvp) => rsvp.attended)
      .length,
    myRsvp: mine ? { attended: mine.attended } : null,
    isOrganizer: !!viewer && viewer.userId === drive.organizerId,
    createdAt: drive.createdAt,
  };
}

async function loadDrive(driveId: string) {
  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    include: DRIVE_INCLUDE,
  });

  if (!drive) throw notFound("Drive");

  return drive;
}

// Notifications are a courtesy: a failed one is logged and
// never undoes the action that triggered it.
async function notifySafely(
  userIds: string[],
  title: string,
  message: string
) {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      createNotification(userId, title, message)
    )
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Drive notification failed:", result.reason);
    }
  });
}

const formatWhen = (date: Date) =>
  date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const signInRequired = () =>
  new HttpError(401, "Sign in to see your drives", "UNAUTHENTICATED");

// ─────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────

export type DriveListStatus = "upcoming" | "past" | "pending" | "mine";

export async function listDrives(
  status: DriveListStatus,
  viewer?: Viewer
) {
  const graceStart = new Date(Date.now() - UPCOMING_GRACE_MS);

  let where: Prisma.DriveWhereInput;
  let orderBy: Prisma.DriveOrderByWithRelationInput[];

  switch (status) {
    case "upcoming":
      where = { status: "APPROVED", startsAt: { gte: graceStart } };
      orderBy = [{ startsAt: "asc" }, { id: "asc" }];
      break;

    // Disjoint from "upcoming": approved drives move here
    // once their 6 h grace window has passed.
    case "past":
      where = {
        OR: [
          { status: "COMPLETED" },
          { status: "APPROVED", startsAt: { lt: graceStart } },
        ],
      };
      orderBy = [{ startsAt: "desc" }, { id: "desc" }];
      break;

    case "pending":
      if (!viewer) throw signInRequired();
      if (!isModerator(viewer)) {
        throw forbidden("Only moderators can review proposed drives");
      }
      where = { status: "PROPOSED" };
      orderBy = [{ startsAt: "asc" }, { id: "asc" }];
      break;

    case "mine":
      if (!viewer) throw signInRequired();
      where = {
        OR: [
          { organizerId: viewer.userId },
          { rsvps: { some: { userId: viewer.userId } } },
        ],
      };
      orderBy = [{ startsAt: "desc" }, { id: "desc" }];
      break;
  }

  const drives = await prisma.drive.findMany({
    where,
    orderBy,
    take: LIST_LIMIT,
    include: DRIVE_INCLUDE,
  });

  return drives.map((drive) => toDrive(drive, viewer));
}

// ─────────────────────────────────────────────
// DETAIL
// ─────────────────────────────────────────────

export async function getDrive(driveId: string, viewer?: Viewer) {
  const drive = await loadDrive(driveId);
  const isOrganizer = viewer?.userId === drive.organizerId;
  const canManage = isOrganizer || isModerator(viewer);

  // Unapproved proposals stay private to their organiser
  // and the moderators.
  if (
    (drive.status === "PROPOSED" || drive.status === "REJECTED") &&
    !canManage
  ) {
    throw notFound("Drive");
  }

  if (!canManage) {
    return { drive: toDrive(drive, viewer) };
  }

  const rsvps = await prisma.driveRsvp.findMany({
    where: { driveId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      attended: true,
      user: { select: USER_REF_SELECT },
    },
  });

  return { drive: toDrive(drive, viewer), rsvps };
}

// ─────────────────────────────────────────────
// PROPOSE
// ─────────────────────────────────────────────

export interface ProposeDriveInput {
  title: string;
  description: string;
  startsAt: Date;
  capacity: number;
  latitude: number;
  longitude: number;
  address?: string;
  wardId?: string;
  issueId?: string;
}

export async function proposeDrive(
  viewer: Viewer,
  data: ProposeDriveInput
) {
  if (data.startsAt.getTime() < Date.now() + MIN_LEAD_MS) {
    throw badRequest(
      "A drive must start at least 2 hours from now"
    );
  }

  let wardId = data.wardId ?? null;

  if (data.wardId) {
    const ward = await prisma.ward.findUnique({
      where: { id: data.wardId },
      select: { id: true },
    });

    if (!ward) throw notFound("Ward");
  }

  if (data.issueId) {
    const issue = await prisma.issue.findUnique({
      where: { id: data.issueId },
      select: { id: true, wardId: true },
    });

    if (!issue) throw notFound("Issue");

    // A drive for a case happens in that case's ward.
    wardId = wardId ?? issue.wardId;
  }

  const drive = await prisma.drive.create({
    data: {
      title: data.title,
      description: data.description,
      startsAt: data.startsAt,
      capacity: data.capacity,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? null,
      wardId,
      issueId: data.issueId ?? null,
      organizerId: viewer.userId,
      status: "PROPOSED",
    },
    include: DRIVE_INCLUDE,
  });

  const moderators = await prisma.user.findMany({
    where: {
      role: { in: [...PERMISSIONS["drive:moderate"].roles] },
      isVerified: true,
    },
    select: { id: true },
  });

  await notifySafely(
    moderators.map((moderator) => moderator.id),
    "Cleanup Drive proposed",
    `${drive.organizer.name} proposed "${drive.title}" for ${formatWhen(drive.startsAt)}. Review it in Drives.`
  );

  return toDrive(drive, viewer);
}

// ─────────────────────────────────────────────
// MODERATE
// ─────────────────────────────────────────────

export async function moderateDrive(
  viewer: Viewer,
  driveId: string,
  decision: "APPROVE" | "REJECT",
  note: string | undefined,
  ip?: string | null
) {
  const drive = await loadDrive(driveId);

  if (drive.status !== "PROPOSED") {
    throw conflict("This drive has already been moderated");
  }

  if (decision === "APPROVE" && drive.startsAt <= new Date()) {
    throw badRequest(
      "This drive's start time has passed, so it can only be rejected"
    );
  }

  const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  // Conditional on still being PROPOSED, so two moderators
  // acting at once cannot both win.
  const { count } = await prisma.drive.updateMany({
    where: { id: driveId, status: "PROPOSED" },
    data: { status, moderationNote: note ?? null },
  });

  if (count === 0) {
    throw conflict("This drive has already been moderated");
  }

  await notifySafely(
    [drive.organizerId],
    decision === "APPROVE"
      ? "Your Cleanup Drive is approved"
      : "Your Cleanup Drive was not approved",
    decision === "APPROVE"
      ? `"${drive.title}" is live. Neighbours can now RSVP.${note ? ` Note: ${note}` : ""}`
      : `"${drive.title}" was not approved.${note ? ` Reason: ${note}` : ""}`
  );

  await recordAudit({
    actorId: viewer.userId,
    action: "drive.moderate",
    entityType: "Drive",
    entityId: driveId,
    meta: { decision, note: note ?? null, title: drive.title },
    ip,
  });

  return toDrive(await loadDrive(driveId), viewer);
}

// ─────────────────────────────────────────────
// RSVP
// ─────────────────────────────────────────────

const MAX_ATTEMPTS = 4;

interface DbError {
  code?: string;
  message?: string;
  cause?: { originalCode?: string; kind?: string };
  meta?: {
    driverAdapterError?: {
      cause?: { originalCode?: string; kind?: string };
    };
  };
}

// The SQLSTATE / adapter kind behind an error, whether it
// arrives as a Prisma known error or a raw driver-adapter
// error (a failed COMMIT surfaces as the latter).
function dbCause(error: unknown) {
  const e = error as DbError;
  const cause = e?.cause ?? e?.meta?.driverAdapterError?.cause;

  return {
    code: e?.code,
    sqlState: cause?.originalCode,
    kind: cause?.kind,
    message: String(e?.message ?? ""),
  };
}

// Postgres aborts one of two clashing serializable
// transactions (SQLSTATE 40001, Prisma P2034); retry it.
function isSerializationFailure(error: unknown) {
  const { code, sqlState, kind, message } = dbCause(error);

  return (
    code === "P2034" ||
    sqlState === "40001" ||
    kind === "TransactionWriteConflict" ||
    message.includes("could not serialize")
  );
}

function isUniqueViolation(error: unknown) {
  const { code, sqlState, kind } = dbCause(error);

  return (
    code === "P2002" ||
    sqlState === "23505" ||
    kind === "UniqueConstraintViolation"
  );
}

const pause = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function joinDrive(viewer: Viewer, driveId: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const drive = await tx.drive.findUnique({
            where: { id: driveId },
            select: {
              status: true,
              startsAt: true,
              capacity: true,
              organizerId: true,
            },
          });

          if (!drive) throw notFound("Drive");

          if (
            drive.status !== "APPROVED" ||
            drive.startsAt <= new Date()
          ) {
            throw badRequest(
              "RSVPs are only open for approved drives that have not started"
            );
          }

          if (drive.organizerId === viewer.userId) {
            throw conflict("You are organising this drive");
          }

          const existing = await tx.driveRsvp.findUnique({
            where: {
              driveId_userId: { driveId, userId: viewer.userId },
            },
            select: { id: true },
          });

          if (existing) {
            throw conflict("You have already joined this drive");
          }

          const taken = await tx.driveRsvp.count({
            where: { driveId },
          });

          if (taken >= drive.capacity) {
            throw conflict("This drive is full");
          }

          await tx.driveRsvp.create({
            data: { driveId, userId: viewer.userId },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      break;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("You have already joined this drive");
      }

      if (isSerializationFailure(error) && attempt < MAX_ATTEMPTS) {
        // Jittered backoff so the retries do not collide again.
        await pause(Math.random() * 25 * attempt);
        continue;
      }

      if (isSerializationFailure(error)) {
        throw new HttpError(
          409,
          "Lots of people are joining right now — please try again",
          "CONFLICT"
        );
      }

      throw error;
    }
  }

  return toDrive(await loadDrive(driveId), viewer);
}

export async function leaveDrive(viewer: Viewer, driveId: string) {
  const drive = await loadDrive(driveId);

  if (drive.status !== "APPROVED" || drive.startsAt <= new Date()) {
    throw badRequest("You can only leave a drive before it starts");
  }

  const { count } = await prisma.driveRsvp.deleteMany({
    where: { driveId, userId: viewer.userId },
  });

  if (count === 0) {
    throw new HttpError(
      404,
      "You have not joined this drive",
      "NOT_FOUND"
    );
  }

  return toDrive(await loadDrive(driveId), viewer);
}

// ─────────────────────────────────────────────
// ATTENDANCE → COMPLETED
// Additive: marks the listed RSVPs as attended (never
// un-marks). Points go only to newly marked attendees, and
// the organiser's bonus only on the APPROVED → COMPLETED
// transition, so re-submitting is safe.
// ─────────────────────────────────────────────

export async function recordAttendance(
  viewer: Viewer,
  driveId: string,
  userIds: string[]
) {
  const drive = await loadDrive(driveId);
  const isOrganizer = drive.organizerId === viewer.userId;

  if (!isOrganizer && !isModerator(viewer)) {
    throw forbidden(
      "Only the organiser or a moderator can record attendance"
    );
  }

  if (drive.status !== "APPROVED" && drive.status !== "COMPLETED") {
    throw badRequest(
      "Attendance can only be recorded for an approved drive"
    );
  }

  if (drive.startsAt > new Date()) {
    throw badRequest("Attendance opens once the drive has started");
  }

  const ids = [...new Set(userIds)];
  const rsvped = new Set(drive.rsvps.map((rsvp) => rsvp.userId));
  const strangers = ids.filter((id) => !rsvped.has(id));

  if (strangers.length > 0) {
    throw badRequest(
      "Only people who RSVP'd can be marked as attending",
      { userIds: strangers }
    );
  }

  const { newlyAttended, organizerRewarded } =
    await prisma.$transaction(async (tx) => {
      const marked = await tx.$queryRaw<{ userId: string }[]>`
        UPDATE "DriveRsvp"
        SET attended = true
        WHERE "driveId" = ${driveId}
          AND attended = false
          AND "userId" IN (${Prisma.join(ids)})
        RETURNING "userId"`;

      const newly = marked.map((row) => row.userId);

      if (newly.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: newly } },
          data: { points: { increment: ATTENDEE_POINTS } },
        });
      }

      const completed = await tx.drive.updateMany({
        where: { id: driveId, status: "APPROVED" },
        data: { status: "COMPLETED" },
      });

      if (completed.count === 1) {
        await tx.user.update({
          where: { id: drive.organizerId },
          data: { points: { increment: ORGANIZER_POINTS } },
        });
      }

      return {
        newlyAttended: newly,
        organizerRewarded: completed.count === 1,
      };
    });

  await notifySafely(
    newlyAttended,
    "Thanks for turning up",
    `Your attendance at "${drive.title}" is recorded: +${ATTENDEE_POINTS} civic points.`
  );

  if (organizerRewarded) {
    await notifySafely(
      [drive.organizerId],
      "Cleanup Drive completed",
      `"${drive.title}" is complete with ${drive.rsvps.filter((rsvp) => rsvp.attended).length + newlyAttended.length} volunteers. +${ORGANIZER_POINTS} civic points for organising.`
    );
  }

  return toDrive(await loadDrive(driveId), viewer);
}
