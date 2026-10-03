import { prisma } from "../lib/prisma";
import { IssueStatus } from "../generated/prisma/client";
import { notifyIssueWatchers } from "./notification.service";

// ─────────────────────────────────────────────
// PUBLIC ISSUES
// ─────────────────────────────────────────────

export interface PublicIssueFilters {
  q?: string;
  category?: string;
  status?: string;
  wardId?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export async function getPublicIssues(
  filters: PublicIssueFilters = {}
) {
  const where: Record<string, unknown> = {
    status: filters.status
      ? (filters.status as IssueStatus)
      : {
          notIn: ["CLOSED", "DUPLICATE"],
        },
  };

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.wardId) {
    where.wardId = filters.wardId;
  }

  if (filters.q) {
    where.OR = [
      {
        title: {
          contains: filters.q,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: filters.q,
          mode: "insensitive",
        },
      },
      {
        address: {
          contains: filters.q,
          mode: "insensitive",
        },
      },
    ];
  }

  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};

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

  const orderBy =
    filters.sort === "upvotes"
      ? {
          upvotes: {
            _count: "desc" as const,
          },
        }
      : filters.sort === "oldest"
        ? { createdAt: "asc" as const }
        : { createdAt: "desc" as const };

  return prisma.issue.findMany({
    where,
    include: {
      department: true,
      ward: true,
      sla: true,
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
    orderBy,
  });
}

// ─────────────────────────────────────────────
// NEARBY OPEN ISSUES — duplicate detection
// ─────────────────────────────────────────────

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

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
      ...(category ? { category: category as any } : {}),
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

export async function getAllIssues() {
  return prisma.issue.findMany({
    include: {
      department: true,
      ward: true,
      sla: true,
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
    orderBy: {
      createdAt: "desc",
    },
  });
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