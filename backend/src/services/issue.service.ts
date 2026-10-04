import { prisma } from "../lib/prisma";
import { badRequest, paginate } from "../lib/http";
import { haversineMeters } from "../lib/geo";
import {
  IssueCategory,
  IssueStatus,
  Prisma,
} from "../generated/prisma/client";
import { notifyIssueWatchers } from "./notification.service";

// ─────────────────────────────────────────────
// PUBLIC ISSUES — filtered, sorted, paginated
// ─────────────────────────────────────────────

// One list item. Light on purpose: the full timeline and
// assignment records live on GET /issues/:id.
export const ISSUE_SUMMARY_INCLUDE = {
  department: true,
  ward: true,
  sla: true,
  _count: {
    select: {
      upvotes: true,
      complaints: true,
    },
  },
} satisfies Prisma.IssueInclude;

export type IssueSort = "newest" | "oldest" | "upvotes";

export interface PublicIssueFilters {
  q?: string;
  category?: IssueCategory;
  status?: IssueStatus;
  wardId?: string;
  from?: string;
  to?: string;
  sort?: IssueSort;
  limit?: number;
  // newest/oldest: id of the last item on the previous page.
  // upvotes: the numeric offset handed out as nextCursor.
  cursor?: string;
}

function publicIssueWhere(
  filters: PublicIssueFilters
): Prisma.IssueWhereInput {
  const where: Prisma.IssueWhereInput = {
    status: filters.status
      ? filters.status
      : { notIn: ["CLOSED", "DUPLICATE"] },
  };

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.wardId) {
    where.wardId = filters.wardId;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { address: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.from || filters.to) {
    const createdAt: Prisma.DateTimeFilter = {};

    if (filters.from) {
      createdAt.gte = new Date(filters.from);
    }

    if (filters.to) {
      const to = new Date(filters.to);
      to.setDate(to.getDate() + 1);
      createdAt.lt = to;
    }

    where.createdAt = createdAt;
  }

  return where;
}

export async function getPublicIssues(
  filters: PublicIssueFilters = {}
) {
  const limit = filters.limit ?? 50;
  const where = publicIssueWhere(filters);

  // Upvote counts move while someone pages, so there is no
  // stable keyset: page by offset, with a full tie-break so
  // the order itself is deterministic.
  if (filters.sort === "upvotes") {
    const offset = filters.cursor ? Number(filters.cursor) : 0;

    const rows = await prisma.issue.findMany({
      where,
      include: ISSUE_SUMMARY_INCLUDE,
      orderBy: [
        { upvotes: { _count: "desc" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip: offset,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;

    return {
      issues: hasMore ? rows.slice(0, limit) : rows,
      nextCursor: hasMore ? String(offset + limit) : null,
    };
  }

  // newest / oldest: keyset on (createdAt, id) after the
  // cursor issue, so inserts never shift a page.
  const direction = filters.sort === "oldest" ? "asc" : "desc";
  const past = direction === "desc" ? "lt" : "gt";
  let pageWhere = where;

  if (filters.cursor) {
    const anchor = await prisma.issue.findUnique({
      where: { id: filters.cursor },
      select: { id: true, createdAt: true },
    });

    if (!anchor) {
      throw badRequest("cursor does not match any issue");
    }

    pageWhere = {
      AND: [
        where,
        {
          OR: [
            { createdAt: { [past]: anchor.createdAt } },
            {
              createdAt: anchor.createdAt,
              id: { [past]: anchor.id },
            },
          ],
        },
      ],
    };
  }

  const rows = await prisma.issue.findMany({
    where: pageWhere,
    include: ISSUE_SUMMARY_INCLUDE,
    orderBy: [{ createdAt: direction }, { id: direction }],
    take: limit + 1,
  });

  const { items, nextCursor } = paginate(rows, limit);

  return { issues: items, nextCursor };
}

// ─────────────────────────────────────────────
// NEARBY OPEN ISSUES — duplicate detection
// ─────────────────────────────────────────────

export async function getNearbyIssues(
  latitude: number,
  longitude: number,
  category?: string,
  radiusMeters = 500,
  limit = 5
) {
  const issues = await prisma.issue.findMany({
    where: {
      status: {
        notIn: ["CLOSED", "DUPLICATE", "RESOLVED"],
      },
      ...(category
        ? { category: category as IssueCategory }
        : {}),
    },
    include: {
      ward: true,
      _count: {
        select: {
          upvotes: true,
        },
      },
    },
  });

  return issues
    .map((issue) => ({
      ...issue,
      distanceMeters: Math.round(
        haversineMeters(
          latitude,
          longitude,
          issue.latitude,
          issue.longitude
        )
      ),
    }))
    .filter(
      (issue) => issue.distanceMeters <= radiusMeters
    )
    .sort(
      (a, b) => a.distanceMeters - b.distanceMeters
    )
    .slice(0, limit);
}

// ─────────────────────────────────────────────
// ADMIN — ALL ISSUES
// ─────────────────────────────────────────────

// Statuses that still need work. Everything else (resolved,
// awaiting sign-off, closed, duplicate) is "closed" on the Case Desk.
export const OPEN_ISSUE_STATUSES: IssueStatus[] = [
  "REPORTED",
  "AI_VERIFIED",
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "SLA_BREACHED",
  "ESCALATED",
  "REOPENED",
];

export type AdminIssueView = "open" | "closed" | "all";

export interface AdminIssueFilters {
  view: AdminIssueView;
  q?: string;
  category?: IssueCategory;
  wardId?: string;
  limit: number;
  cursor?: string;
}

// Only what the Case Desk table and its dialogs read: no status
// history, slim refs, officer identity without credentials.
const ADMIN_LIST_INCLUDE = {
  department: { select: { id: true, name: true } },
  ward: { select: { id: true, name: true, code: true } },
  sla: {
    select: {
      id: true,
      durationMin: true,
      deadline: true,
      breached: true,
      breachedAt: true,
    },
  },
  assignments: {
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      assignedAt: true,
      acceptedAt: true,
      completedAt: true,
      authority: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          avatarUrl: true,
        },
      },
    },
  },
  _count: {
    select: {
      upvotes: true,
      complaints: true,
    },
  },
} satisfies Prisma.IssueInclude;

function viewWhere(view: AdminIssueView): Prisma.IssueWhereInput {
  if (view === "open") return { status: { in: OPEN_ISSUE_STATUSES } };
  if (view === "closed") return { status: { notIn: OPEN_ISSUE_STATUSES } };
  return {};
}

// Admin Case Desk list: server-side filters + keyset pagination on
// (createdAt desc, id desc), so the payload stays bounded no matter
// how many years of cases are on file.
export async function getAllIssues(filters: AdminIssueFilters) {
  const where: Prisma.IssueWhereInput = {
    ...viewWhere(filters.view),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.wardId ? { wardId: filters.wardId } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: "insensitive" } },
            { address: { contains: filters.q, mode: "insensitive" } },
            { id: { startsWith: filters.q } },
            {
              assignments: {
                some: {
                  authority: {
                    name: { contains: filters.q, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  let pageWhere = where;

  if (filters.cursor) {
    const anchor = await prisma.issue.findUnique({
      where: { id: filters.cursor },
      select: { id: true, createdAt: true },
    });

    if (!anchor) {
      throw badRequest("Unknown cursor");
    }

    pageWhere = {
      AND: [
        where,
        {
          OR: [
            { createdAt: { lt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { lt: anchor.id } },
          ],
        },
      ],
    };
  }

  const [rows, total, open, all] = await Promise.all([
    prisma.issue.findMany({
      where: pageWhere,
      include: ADMIN_LIST_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filters.limit + 1,
    }),
    prisma.issue.count({ where }),
    prisma.issue.count({ where: viewWhere("open") }),
    prisma.issue.count(),
  ]);

  const { items, nextCursor } = paginate(rows, filters.limit);

  return {
    issues: items,
    nextCursor,
    total,
    totals: { open, closed: all - open, all },
  };
}

// ─────────────────────────────────────────────
// ISSUE BY ID
// ─────────────────────────────────────────────

export async function getIssueById(
  issueId: string
) {
  return prisma.issue.findUnique({
    where: {
      id: issueId,
    },
    include: {
      department: true,
      ward: true,
      sla: true,
      complaints: {
        select: {
          id: true,
          imageUrl: true,
          photos: true,
          audioUrl: true,
          description: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "asc",
        },
      },
      assignments: {
        include: {
          authority: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          department: true,
          ward: true,
        },
      },
      _count: {
        select: {
          upvotes: true,
          complaints: true,
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
// UPDATE ISSUE STATUS
// ─────────────────────────────────────────────

export async function updateIssueStatus(
  issueId: string,
  userId: string,
  status: IssueStatus,
  note?: string
) {
  const issue = await prisma.issue.findUnique({
    where: {
      id: issueId,
    },
  });

  if (!issue) {
    throw new Error("ISSUE_NOT_FOUND");
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedIssue =
        await tx.issue.update({
          where: {
            id: issueId,
          },
          data: {
            status,
          },
        });

      await tx.statusHistory.create({
        data: {
          issueId,
          changedBy: userId,
          status,
          note,
        },
      });

      return updatedIssue;
    }
  );

  await notifyIssueWatchers(
    issueId,
    "Issue Status Updated",
    `"${issue.title}" is now ${status.replace(/_/g, " ").toLowerCase()}.${note ? ` Note: ${note}` : ""}`,
    { excludeUserId: userId }
  );

  return result;
}

// ─────────────────────────────────────────────
// MARK DUPLICATE — merge into an original issue
// ─────────────────────────────────────────────

export async function markIssueDuplicate(
  issueId: string,
  originalIssueId: string,
  adminId: string
) {
  if (issueId === originalIssueId) {
    throw new Error("SAME_ISSUE");
  }

  const [duplicate, original] = await Promise.all([
    prisma.issue.findUnique({
      where: { id: issueId },
      include: { upvotes: true },
    }),
    prisma.issue.findUnique({
      where: { id: originalIssueId },
      include: { upvotes: true },
    }),
  ]);

  if (!duplicate || !original) {
    throw new Error("ISSUE_NOT_FOUND");
  }

  if (original.status === "DUPLICATE") {
    throw new Error("ORIGINAL_IS_DUPLICATE");
  }

  const originalUpvoters = new Set(
    original.upvotes.map((upvote) => upvote.userId)
  );

  await prisma.$transaction(async (tx) => {
    // Merge upvotes into the original; drop conflicts.
    for (const upvote of duplicate.upvotes) {
      if (originalUpvoters.has(upvote.userId)) {
        await tx.upvote.delete({
          where: { id: upvote.id },
        });
      } else {
        await tx.upvote.update({
          where: { id: upvote.id },
          data: { issueId: originalIssueId },
        });
      }
    }

    await tx.issue.update({
      where: { id: issueId },
      data: { status: "DUPLICATE" },
    });

    await tx.statusHistory.create({
      data: {
        issueId,
        changedBy: adminId,
        status: "DUPLICATE",
        note: `Marked as duplicate of "${original.title}" (${originalIssueId})`,
      },
    });
  });

  await notifyIssueWatchers(
    issueId,
    "Issue Merged",
    `"${duplicate.title}" is a duplicate and is now tracked under "${original.title}". Your upvote was carried over.`,
    { excludeUserId: adminId }
  );

  return { merged: true, originalIssueId };
}