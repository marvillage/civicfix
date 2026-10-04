import { prisma } from "../lib/prisma";
import { ISSUE_SUMMARY_INCLUDE } from "./issue.service";
import {
  IssueCategory,
  IssueStatus,
  Prisma,
  WatchZone,
} from "../generated/prisma/client";
import { conflict, notFound } from "../lib/http";
import {
  boundingBox,
  distanceMeters,
  GeoPoint,
} from "../lib/geo";
import { createNotification } from "./notification.service";

// ─────────────────────────────────────────────
// WATCH ZONES
// A circle a user cares about. New cases inside it (matching
// its categories; none = all) trigger a notification.
// ─────────────────────────────────────────────

export const MAX_WATCH_ZONES = 5;
export const WATCH_ZONE_RADIUS = { min: 100, max: 5000 } as const;
export const MAX_ZONE_ISSUES = 50;

// Cases that no longer need fixing don't count as open.
const NOT_OPEN: IssueStatus[] = [
  "RESOLVED",
  "CITIZEN_VERIFICATION",
  "CLOSED",
  "DUPLICATE",
];

// Zone cases use the same summary shape GET /issues returns.

type ZoneRow = WatchZone;

interface ZoneShape extends GeoPoint {
  radiusM: number;
  categories: IssueCategory[];
}

export interface WatchZoneInput {
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  categories?: IssueCategory[];
}

function serializeZone(zone: ZoneRow, openIssues: number) {
  return {
    id: zone.id,
    name: zone.name,
    latitude: zone.latitude,
    longitude: zone.longitude,
    radiusM: zone.radiusM,
    categories: zone.categories,
    createdAt: zone.createdAt,
    openIssues,
  };
}

// Bounding-box prefilter in SQL; the exact circle test runs in JS.
function openIssuesInBoxWhere(
  zone: ZoneShape
): Prisma.IssueWhereInput {
  const box = boundingBox(zone, zone.radiusM);

  return {
    status: { notIn: NOT_OPEN },
    latitude: { gte: box.minLat, lte: box.maxLat },
    longitude: { gte: box.minLng, lte: box.maxLng },
    ...(zone.categories.length > 0
      ? { category: { in: zone.categories } }
      : {}),
  };
}

// Open cases inside the circle, nearest first.
async function openIssueDistances(zone: ZoneShape) {
  const candidates = await prisma.issue.findMany({
    where: openIssuesInBoxWhere(zone),
    select: { id: true, latitude: true, longitude: true },
  });

  return candidates
    .map((issue) => ({
      id: issue.id,
      distance: distanceMeters(issue, zone),
    }))
    .filter((issue) => issue.distance <= zone.radiusM)
    .sort((a, b) => a.distance - b.distance);
}

async function findOwnZone(userId: string, zoneId: string) {
  // Someone else's zone is reported as missing rather than
  // forbidden, so ids can't be probed.
  const zone = await prisma.watchZone.findFirst({
    where: { id: zoneId, userId },
  });

  if (!zone) {
    throw notFound("Watch zone");
  }

  return zone;
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

export async function listWatchZones(userId: string) {
  const zones = await prisma.watchZone.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    zones.map(async (zone) =>
      serializeZone(
        zone,
        (await openIssueDistances(zone)).length
      )
    )
  );
}

export async function createWatchZone(
  userId: string,
  input: WatchZoneInput
) {
  const zone = await prisma.$transaction(async (tx) => {
    // Lock the owner's row so two parallel requests can't both
    // pass the limit check.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const count = await tx.watchZone.count({ where: { userId } });

    if (count >= MAX_WATCH_ZONES) {
      throw conflict(
        `You can have at most ${MAX_WATCH_ZONES} watch zones. Delete one to add another.`
      );
    }

    return tx.watchZone.create({
      data: {
        userId,
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusM: input.radiusM,
        categories: uniqueCategories(input.categories),
      },
    });
  });

  return serializeZone(
    zone,
    (await openIssueDistances(zone)).length
  );
}

export async function updateWatchZone(
  userId: string,
  zoneId: string,
  input: Partial<WatchZoneInput>
) {
  await findOwnZone(userId, zoneId);

  const zone = await prisma.watchZone.update({
    where: { id: zoneId },
    data: {
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusM: input.radiusM,
      categories:
        input.categories === undefined
          ? undefined
          : uniqueCategories(input.categories),
    },
  });

  return serializeZone(
    zone,
    (await openIssueDistances(zone)).length
  );
}

export async function deleteWatchZone(
  userId: string,
  zoneId: string
) {
  await findOwnZone(userId, zoneId);

  await prisma.watchZone.delete({ where: { id: zoneId } });
}

export async function getWatchZoneIssues(
  userId: string,
  zoneId: string
) {
  const zone = await findOwnZone(userId, zoneId);

  const nearest = (await openIssueDistances(zone)).slice(
    0,
    MAX_ZONE_ISSUES
  );

  const issues = await prisma.issue.findMany({
    where: { id: { in: nearest.map((issue) => issue.id) } },
    include: ISSUE_SUMMARY_INCLUDE,
  });

  const byId = new Map(issues.map((issue) => [issue.id, issue]));

  return nearest.flatMap(({ id, distance }) => {
    const issue = byId.get(id);

    return issue
      ? [{ ...issue, distanceMeters: Math.round(distance) }]
      : [];
  });
}

function uniqueCategories(categories: IssueCategory[] = []) {
  return [...new Set(categories)];
}

// ─────────────────────────────────────────────
// ALERTS — called when a new issue is created
// ─────────────────────────────────────────────

interface NewIssue extends GeoPoint {
  id: string;
  title: string;
  category: IssueCategory;
  address?: string | null;
}

// Notifies the owners of every zone that contains the issue and
// matches its category, once per owner, skipping the reporter.
export async function notifyWatchZoneOwners(
  issue: NewIssue,
  reporterId: string | null
) {
  // A zone can only contain the issue if its centre is within
  // the largest allowed radius of it.
  const box = boundingBox(issue, WATCH_ZONE_RADIUS.max);

  const zones = await prisma.watchZone.findMany({
    where: {
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
      OR: [
        { categories: { isEmpty: true } },
        { categories: { has: issue.category } },
      ],
      ...(reporterId ? { userId: { not: reporterId } } : {}),
    },
    select: {
      userId: true,
      name: true,
      latitude: true,
      longitude: true,
      radiusM: true,
    },
  });

  const matches = zones
    .map((zone) => ({ zone, distance: distanceMeters(issue, zone) }))
    .filter(({ zone, distance }) => distance <= zone.radiusM)
    .sort((a, b) => a.distance - b.distance);

  // One alert per owner, named after their nearest zone.
  const zoneByOwner = new Map<string, string>();

  for (const { zone } of matches) {
    if (!zoneByOwner.has(zone.userId)) {
      zoneByOwner.set(zone.userId, zone.name);
    }
  }

  const category = issue.category.replace(/_/g, " ").toLowerCase();

  for (const [userId, zoneName] of zoneByOwner) {
    await createNotification(
      userId,
      `New case in ${zoneName}`,
      `"${issue.title}" (${category}) was just reported${
        issue.address ? ` near ${issue.address}` : " inside your watch zone"
      }.`
    );
  }

  return zoneByOwner.size;
}
