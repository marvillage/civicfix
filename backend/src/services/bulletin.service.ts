import { prisma } from "../lib/prisma";
import { BulletinKind, Prisma } from "../generated/prisma/client";
import { can } from "../auth/permissions";
import { forbidden, notFound, paginate } from "../lib/http";
import { createNotification } from "./notification.service";
import {
  BulletinStatusFilter,
  bulletinWindowWhere,
  isBulletinActive,
} from "./bulletin.rules";

// ─────────────────────────────────────────────
// WARD BULLETINS
// Planned works, outages and advisories. wardId null = citywide.
// ─────────────────────────────────────────────

interface Actor {
  userId: string;
  role: string;
}

const BULLETIN_INCLUDE = {
  ward: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true } },
  author: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      designation: true,
    },
  },
} satisfies Prisma.BulletinInclude;

type BulletinRow = Prisma.BulletinGetPayload<{
  include: typeof BULLETIN_INCLUDE;
}>;

const KIND_LABEL: Record<BulletinKind, string> = {
  OUTAGE: "Outage",
  ROADWORKS: "Roadworks",
  ADVISORY: "Advisory",
  EVENT: "Event",
};

function serializeBulletin(row: BulletinRow, now: Date) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    pinned: row.pinned,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    ward: row.ward,
    department: row.department,
    author: row.author,
    isActive: isBulletinActive(row, now),
  };
}

// ─────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────

export interface BulletinFilters {
  status: BulletinStatusFilter;
  wardId?: string;
  kind?: BulletinKind;
  limit: number;
  cursor?: string;
}

export async function listBulletins(filters: BulletinFilters) {
  const now = new Date();

  const where: Prisma.BulletinWhereInput = {
    AND: [
      bulletinWindowWhere(filters.status, now),
      // A ward's feed includes citywide notices.
      filters.wardId
        ? { OR: [{ wardId: filters.wardId }, { wardId: null }] }
        : {},
      filters.kind ? { kind: filters.kind } : {},
    ],
  };

  const rows = await prisma.bulletin.findMany({
    where,
    include: BULLETIN_INCLUDE,
    orderBy: [{ pinned: "desc" }, { startsAt: "desc" }, { id: "desc" }],
    take: filters.limit + 1,
    ...(filters.cursor
      ? { cursor: { id: filters.cursor }, skip: 1 }
      : {}),
  });

  const { items, nextCursor } = paginate(rows, filters.limit);

  return {
    bulletins: items.map((row) => serializeBulletin(row, now)),
    nextCursor,
  };
}

// ─────────────────────────────────────────────
// PUBLISH
// ─────────────────────────────────────────────

export interface BulletinInput {
  title: string;
  body: string;
  kind: BulletinKind;
  wardId?: string;
  departmentId?: string;
  startsAt: Date;
  endsAt?: Date | null;
  pinned?: boolean;
}

export async function createBulletin(
  actor: Actor,
  input: BulletinInput
) {
  const canManage = can(actor.role, "bulletin:manage");

  if (input.pinned && !canManage) {
    throw forbidden("Only admins can pin bulletins");
  }

  const author = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { departmentId: true },
  });

  if (!author) {
    throw notFound("User");
  }

  if (input.wardId) {
    const ward = await prisma.ward.findUnique({
      where: { id: input.wardId },
      select: { id: true },
    });

    if (!ward) throw notFound("Ward");
  }

  // Officers always publish for their own department; admins may
  // name one (or none, for a council-wide notice).
  let departmentId = author.departmentId;

  if (canManage) {
    departmentId = input.departmentId ?? null;

    if (departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });

      if (!department) throw notFound("Department");
    }
  }

  const row = await prisma.bulletin.create({
    data: {
      title: input.title,
      body: input.body,
      kind: input.kind,
      pinned: input.pinned ?? false,
      wardId: input.wardId ?? null,
      departmentId,
      authorId: actor.userId,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
    },
    include: BULLETIN_INCLUDE,
  });

  // After the write: a failed alert must not fail the publish.
  notifyWardCitizens(row).catch((error) => {
    console.error("Bulletin notifications failed:", row.id, error);
  });

  return serializeBulletin(row, new Date());
}

// Profile wards are free text, so match the ward's name, code or
// id, ignoring case.
async function notifyWardCitizens(bulletin: BulletinRow) {
  const ward = bulletin.ward;

  if (!ward) return 0;

  const citizens = await prisma.user.findMany({
    where: {
      role: "CITIZEN",
      id: { not: bulletin.authorId },
      OR: [ward.name, ward.code, ward.id].map((value) => ({
        ward: { equals: value, mode: "insensitive" as const },
      })),
    },
    select: { id: true },
  });

  const when = formatWindow(bulletin.startsAt, bulletin.endsAt);

  for (const citizen of citizens) {
    await createNotification(
      citizen.id,
      `${KIND_LABEL[bulletin.kind]} in ${ward.name}: ${bulletin.title}`,
      `${when}. ${truncate(bulletin.body, 200)}`
    );
  }

  return citizens.length;
}

function formatDate(date: Date) {
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatWindow(startsAt: Date, endsAt: Date | null) {
  return endsAt
    ? `From ${formatDate(startsAt)} to ${formatDate(endsAt)}`
    : `From ${formatDate(startsAt)}`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ─────────────────────────────────────────────
// DELETE — the author (while still a publisher) or a manager
// ─────────────────────────────────────────────

export async function deleteBulletin(actor: Actor, bulletinId: string) {
  const bulletin = await prisma.bulletin.findUnique({
    where: { id: bulletinId },
    select: { id: true, title: true, authorId: true, kind: true },
  });

  if (!bulletin) {
    throw notFound("Bulletin");
  }

  const isAuthor =
    bulletin.authorId === actor.userId &&
    can(actor.role, "bulletin:publish");

  if (!isAuthor && !can(actor.role, "bulletin:manage")) {
    throw forbidden("Only the author or an admin can remove this bulletin");
  }

  await prisma.bulletin.delete({ where: { id: bulletinId } });

  return bulletin;
}
