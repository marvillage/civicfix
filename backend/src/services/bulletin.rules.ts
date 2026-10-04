import type { Prisma } from "../generated/prisma/client";

// ─────────────────────────────────────────────
// WARD BULLETIN RULES
// Pure time-window logic, kept free of I/O so it can be unit
// tested and shared by the list query and the serializer.
// ─────────────────────────────────────────────

export const BULLETIN_STATUS_FILTERS = [
  "active",
  "upcoming",
  "past",
  "all",
] as const;

export type BulletinStatusFilter =
  (typeof BULLETIN_STATUS_FILTERS)[number];

export type BulletinStatus = Exclude<BulletinStatusFilter, "all">;

export interface BulletinWindow {
  startsAt: Date;
  endsAt: Date | null;
}

// upcoming: not started yet. past: has an end and it has passed.
// active: started, and open-ended or ending in the future.
export function bulletinStatus(
  window: BulletinWindow,
  now: Date = new Date()
): BulletinStatus {
  if (window.startsAt > now) return "upcoming";

  if (window.endsAt && window.endsAt <= now) return "past";

  return "active";
}

export function isBulletinActive(
  window: BulletinWindow,
  now: Date = new Date()
) {
  return bulletinStatus(window, now) === "active";
}

// An end time, when given, must come after the start.
export function isValidBulletinWindow(
  startsAt: Date,
  endsAt?: Date | null
) {
  return !endsAt || endsAt.getTime() > startsAt.getTime();
}

// The same windows as bulletinStatus(), as a database filter.
export function bulletinWindowWhere(
  status: BulletinStatusFilter,
  now: Date = new Date()
): Prisma.BulletinWhereInput {
  switch (status) {
    case "active":
      return {
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      };
    case "upcoming":
      return { startsAt: { gt: now } };
    case "past":
      return { startsAt: { lte: now }, endsAt: { lte: now } };
    case "all":
      return {};
  }
}
