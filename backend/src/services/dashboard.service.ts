import { prisma } from "../lib/prisma";
import { reportCardGrade } from "./pulse.helpers";

export async function getDashboardStats() {
  const [
    totalIssues,
    reported,
    acknowledged,
    inProgress,
    resolved,
    closed,
    slaBreached,
    escalated,
    reopened,
    duplicate,
  ] = await Promise.all([
    prisma.issue.count(),

    prisma.issue.count({
      where: {
        status: "REPORTED",
      },
    }),

    prisma.issue.count({
      where: {
        status: "ACKNOWLEDGED",
      },
    }),

    prisma.issue.count({
      where: {
        status: "IN_PROGRESS",
      },
    }),

    prisma.issue.count({
      where: {
        status: "RESOLVED",
      },
    }),

    prisma.issue.count({
      where: {
        status: "CLOSED",
      },
    }),

    prisma.issue.count({
      where: {
        status: "SLA_BREACHED",
      },
    }),

    prisma.issue.count({
      where: {
        status: "ESCALATED",
      },
    }),

    prisma.issue.count({
      where: {
        status: "REOPENED",
      },
    }),

    prisma.issue.count({
      where: {
        status: "DUPLICATE",
      },
    }),
  ]);

  const categoryStats = await prisma.issue.groupBy({
    by: ["category"],
    _count: {
      id: true,
    },
  });

  const severityStats = await prisma.issue.groupBy({
    by: ["severity"],
    _count: {
      id: true,
    },
  });

  return {
    totalIssues,
    status: {
      reported,
      acknowledged,
      inProgress,
      resolved,
      closed,
      slaBreached,
      escalated,
      reopened,
      duplicate,
    },
    category: categoryStats,
    severity: severityStats,
  };
}

// ─────────────────────────────────────────────
// ANALYTICS — admin charts
// ─────────────────────────────────────────────

export async function getAnalytics() {
  const [byCategory, byStatus, byWard, wards] =
    await Promise.all([
      prisma.issue.groupBy({
        by: ["category"],
        _count: { id: true },
      }),
      prisma.issue.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.issue.groupBy({
        by: ["wardId"],
        _count: { id: true },
      }),
      prisma.ward.findMany({
        select: { id: true, name: true, code: true },
      }),
    ]);

  const wardNames = new Map(
    wards.map((ward) => [ward.id, ward.name])
  );

  // Average resolution time: first RESOLVED history
  // entry minus the issue's reported time.
  const resolvedHistory =
    await prisma.statusHistory.findMany({
      where: {
        status: "RESOLVED",
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        issueId: true,
        createdAt: true,
      },
    });

  const firstResolved = new Map<string, Date>();

  for (const entry of resolvedHistory) {
    if (!firstResolved.has(entry.issueId)) {
      firstResolved.set(entry.issueId, entry.createdAt);
    }
  }

  let avgResolutionHours: number | null = null;

  if (firstResolved.size > 0) {
    const issues = await prisma.issue.findMany({
      where: {
        id: {
          in: [...firstResolved.keys()],
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const totalMs = issues.reduce((sum, issue) => {
      const resolvedAt = firstResolved.get(issue.id);

      if (!resolvedAt) {
        return sum;
      }

      return (
        sum +
        (resolvedAt.getTime() -
          issue.createdAt.getTime())
      );
    }, 0);

    avgResolutionHours =
      Math.round(
        (totalMs / issues.length / 3600000) * 10
      ) / 10;
  }

  const [totalSLAs, breachedSLAs] = await Promise.all([
    prisma.sLA.count(),
    prisma.sLA.count({
      where: {
        breached: true,
      },
    }),
  ]);

  // Issues reported per month, last 6 months.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const recentIssues = await prisma.issue.findMany({
    where: {
      createdAt: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      createdAt: true,
    },
  });

  const monthly: { month: string; count: number }[] = [];

  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setMonth(d.getMonth() + i);

    const label = d.toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    });

    const count = recentIssues.filter(
      (issue) =>
        issue.createdAt.getFullYear() ===
          d.getFullYear() &&
        issue.createdAt.getMonth() === d.getMonth()
    ).length;

    monthly.push({ month: label, count });
  }

  return {
    byCategory: byCategory.map((row) => ({
      category: row.category,
      count: row._count.id,
    })),
    byStatus: byStatus.map((row) => ({
      status: row.status,
      count: row._count.id,
    })),
    byWard: byWard.map((row) => ({
      ward: row.wardId
        ? (wardNames.get(row.wardId) ?? "Unknown ward")
        : "Unassigned",
      count: row._count.id,
    })),
    avgResolutionHours,
    sla: {
      total: totalSLAs,
      breached: breachedSLAs,
      complianceRate:
        totalSLAs > 0
          ? Math.round(
              ((totalSLAs - breachedSLAs) /
                totalSLAs) *
                100
            )
          : null,
    },
    monthly,
  };
}

// ─────────────────────────────────────────────
// LEADERBOARD — top citizens by points
// ─────────────────────────────────────────────

export async function getLeaderboard() {
  return prisma.user.findMany({
    where: {
      role: "CITIZEN",
      points: {
        gt: 0,
      },
    },
    select: {
      id: true,
      name: true,
      points: true,
      _count: {
        select: {
          complaints: true,
        },
      },
    },
    orderBy: {
      points: "desc",
    },
    take: 10,
  });
}

// ─────────────────────────────────────────────
// MY IMPACT — citizen stats
// ─────────────────────────────────────────────

export async function getMyImpact(citizenId: string) {
  const complaints = await prisma.complaint.findMany({
    where: {
      citizenId,
    },
    select: {
      issueId: true,
      issue: {
        select: {
          status: true,
          _count: {
            select: {
              upvotes: true,
            },
          },
        },
      },
    },
  });

  const issueIds = new Set(
    complaints.map((complaint) => complaint.issueId)
  );

  let resolvedCount = 0;
  let upvotesReceived = 0;
  const counted = new Set<string>();

  for (const complaint of complaints) {
    if (counted.has(complaint.issueId)) {
      continue;
    }

    counted.add(complaint.issueId);

    if (
      ["RESOLVED", "CLOSED"].includes(
        complaint.issue.status
      )
    ) {
      resolvedCount++;
    }

    upvotesReceived +=
      complaint.issue._count.upvotes;
  }

  return {
    totalReports: complaints.length,
    issuesTracked: issueIds.size,
    resolved: resolvedCount,
    upvotesReceived,
  };
}

// ─────────────────────────────────────────────
// MY PERFORMANCE — authority scorecard
// ─────────────────────────────────────────────

export async function getMyPerformance(
  authorityId: string
) {
  const assignments = await prisma.assignment.findMany({
    where: {
      authorityId,
    },
    include: {
      issue: {
        select: {
          sla: {
            select: {
              breached: true,
            },
          },
        },
      },
    },
  });

  const completed = assignments.filter(
    (assignment) => assignment.completedAt
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const completedThisMonth = completed.filter(
    (assignment) =>
      assignment.completedAt! >= monthStart
  ).length;

  let avgResolutionHours: number | null = null;

  if (completed.length > 0) {
    const totalMs = completed.reduce(
      (sum, assignment) =>
        sum +
        (assignment.completedAt!.getTime() -
          assignment.assignedAt.getTime()),
      0
    );

    avgResolutionHours =
      Math.round(
        (totalMs / completed.length / 3600000) * 10
      ) / 10;
  }

  const completedWithSLA = completed.filter(
    (assignment) => assignment.issue.sla
  );

  const slaHitRate =
    completedWithSLA.length > 0
      ? Math.round(
          (completedWithSLA.filter(
            (assignment) =>
              !assignment.issue.sla?.breached
          ).length /
            completedWithSLA.length) *
            100
        )
      : null;

  // Average citizen satisfaction on my resolved issues.
  const ratings =
    await prisma.resolutionVerification.findMany({
      where: {
        stars: { not: null },
        issue: {
          assignments: {
            some: { authorityId },
          },
        },
      },
      select: { stars: true },
    });

  const avgRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce(
            (sum, rating) => sum + (rating.stars || 0),
            0
          ) /
            ratings.length) *
            10
        ) / 10
      : null;

  return {
    totalAssigned: assignments.length,
    active: assignments.length - completed.length,
    completed: completed.length,
    completedThisMonth,
    avgResolutionHours,
    slaHitRate,
    avgRating,
    ratingsCount: ratings.length,
  };
}

// ─────────────────────────────────────────────
// AUDIT LOG — every status change
// ─────────────────────────────────────────────

export async function getAuditLog(
  limit = 100,
  offset = 0
) {
  const [entries, total] = await Promise.all([
    prisma.statusHistory.findMany({
      include: {
        issue: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: Math.min(limit, 200),
      skip: offset,
    }),
    prisma.statusHistory.count(),
  ]);

  return { entries, total };
}

// ─────────────────────────────────────────────
// PUBLIC STATS — transparency page (no auth)
// ─────────────────────────────────────────────

// Ward grades use the shared report-card scale (A ≥ 90,
// B ≥ 75, C ≥ 60, D ≥ 40, else F), the same one City Pulse
// uses — see pulse.helpers.ts.
export { gradeFromScore } from "./pulse.helpers";

export async function getPublicStats() {
  const [total, resolvedOrClosed, open, wards] =
    await Promise.all([
      prisma.issue.count({
        where: { status: { not: "DUPLICATE" } },
      }),
      prisma.issue.count({
        where: {
          status: { in: ["RESOLVED", "CLOSED"] },
        },
      }),
      prisma.issue.count({
        where: {
          status: {
            notIn: ["RESOLVED", "CLOSED", "DUPLICATE"],
          },
        },
      }),
      prisma.ward.findMany({
        include: {
          issues: {
            select: {
              status: true,
              sla: {
                select: { breached: true },
              },
            },
          },
        },
      }),
    ]);

  const byCategory = await prisma.issue.groupBy({
    by: ["category"],
    where: { status: { not: "DUPLICATE" } },
    _count: { id: true },
  });

  // Average resolution time across all resolved issues.
  const resolvedHistory =
    await prisma.statusHistory.findMany({
      where: { status: "RESOLVED" },
      orderBy: { createdAt: "asc" },
      select: { issueId: true, createdAt: true },
    });

  const firstResolved = new Map<string, Date>();

  for (const entry of resolvedHistory) {
    if (!firstResolved.has(entry.issueId)) {
      firstResolved.set(entry.issueId, entry.createdAt);
    }
  }

  let avgResolutionHours: number | null = null;

  if (firstResolved.size > 0) {
    const issues = await prisma.issue.findMany({
      where: {
        id: { in: [...firstResolved.keys()] },
      },
      select: { id: true, createdAt: true },
    });

    const totalMs = issues.reduce((sum, issue) => {
      const resolvedAt = firstResolved.get(issue.id);

      return resolvedAt
        ? sum +
            (resolvedAt.getTime() -
              issue.createdAt.getTime())
        : sum;
    }, 0);

    avgResolutionHours =
      Math.round(
        (totalMs / issues.length / 3600000) * 10
      ) / 10;
  }

  // Ward report cards: grade from resolution rate
  // and SLA compliance.
  const wardCards = wards
    .map((ward) => {
      const issues = ward.issues.filter(
        (issue) => issue.status !== "DUPLICATE"
      );

      const totalIssues = issues.length;

      const resolved = issues.filter((issue) =>
        ["RESOLVED", "CLOSED"].includes(issue.status)
      ).length;

      const withSLA = issues.filter(
        (issue) => issue.sla
      );

      const slaKept = withSLA.filter(
        (issue) => !issue.sla?.breached
      ).length;

      const resolutionRate =
        totalIssues > 0
          ? (resolved / totalIssues) * 100
          : null;

      const slaCompliance =
        withSLA.length > 0
          ? (slaKept / withSLA.length) * 100
          : null;

      return {
        id: ward.id,
        name: ward.name,
        code: ward.code,
        totalIssues,
        resolved,
        resolutionRate:
          resolutionRate !== null
            ? Math.round(resolutionRate)
            : null,
        slaCompliance:
          slaCompliance !== null
            ? Math.round(slaCompliance)
            : null,
        grade: reportCardGrade([
          resolutionRate,
          slaCompliance,
        ]),
      };
    })
    .sort(
      (a, b) => b.totalIssues - a.totalIssues
    );

  return {
    total,
    resolved: resolvedOrClosed,
    open,
    avgResolutionHours,
    byCategory: byCategory.map((row) => ({
      category: row.category,
      count: row._count.id,
    })),
    wards: wardCards,
  };
}

// ─────────────────────────────────────────────
// BADGES — computed citizen achievements
// ─────────────────────────────────────────────

export async function getMyBadges(citizenId: string) {
  const impact = await getMyImpact(citizenId);

  const verifications =
    await prisma.resolutionVerification.count({
      where: { citizenId },
    });

  const upvotesGiven = await prisma.upvote.count({
    where: { userId: citizenId },
  });

  const badges = [
    {
      id: "first-report",
      name: "First Report",
      icon: "📣",
      description: "Filed your first civic report",
      earned: impact.totalReports >= 1,
    },
    {
      id: "streetwise",
      name: "Streetwise",
      icon: "🛣️",
      description: "Filed 5 reports",
      earned: impact.totalReports >= 5,
    },
    {
      id: "civic-hero",
      name: "Civic Hero",
      icon: "🦸",
      description: "Filed 10 reports",
      earned: impact.totalReports >= 10,
    },
    {
      id: "fixer",
      name: "Fixer",
      icon: "🔧",
      description: "One of your reports got fixed",
      earned: impact.resolved >= 1,
    },
    {
      id: "change-maker",
      name: "Change Maker",
      icon: "🏆",
      description: "5 of your reports got fixed",
      earned: impact.resolved >= 5,
    },
    {
      id: "closing-the-loop",
      name: "Closing the Loop",
      icon: "✅",
      description: "Verified a resolution",
      earned: verifications >= 1,
    },
    {
      id: "popular-voice",
      name: "Popular Voice",
      icon: "📢",
      description:
        "Your issues collected 10 upvotes",
      earned: impact.upvotesReceived >= 10,
    },
    {
      id: "supporter",
      name: "Supporter",
      icon: "🤝",
      description: "Upvoted 5 community issues",
      earned: upvotesGiven >= 5,
    },
  ];

  return badges;
}

// ─────────────────────────────────────────────
// CHRONIC ISSUES — fixes that do not hold
// ─────────────────────────────────────────────

export async function getChronicIssues() {
  return prisma.issue.findMany({
    where: {
      OR: [
        { reopenCount: { gte: 2 } },
        { escalations: { some: { level: { gte: 2 } } } },
      ],
    },
    include: {
      ward: true,
      department: true,
      _count: {
        select: {
          escalations: true,
          complaints: true,
        },
      },
    },
    orderBy: {
      reopenCount: "desc",
    },
  });
}

// ─────────────────────────────────────────────
// CSV EXPORT — all issues
// ─────────────────────────────────────────────

export async function getIssuesCSV() {
  const issues = await prisma.issue.findMany({
    include: {
      department: true,
      ward: true,
      sla: true,
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

  const escape = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ""
        : String(value);

    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = [
    "id",
    "title",
    "category",
    "severity",
    "status",
    "ward",
    "department",
    "address",
    "latitude",
    "longitude",
    "upvotes",
    "complaints",
    "sla_deadline",
    "sla_breached",
    "created_at",
    "updated_at",
  ].join(",");

  const rows = issues.map((issue) =>
    [
      escape(issue.id),
      escape(issue.title),
      escape(issue.category),
      escape(issue.severity),
      escape(issue.status),
      escape(issue.ward?.name),
      escape(issue.department?.name),
      escape(issue.address),
      escape(issue.latitude),
      escape(issue.longitude),
      escape(issue._count.upvotes),
      escape(issue._count.complaints),
      escape(issue.sla?.deadline?.toISOString()),
      escape(issue.sla?.breached),
      escape(issue.createdAt.toISOString()),
      escape(issue.updatedAt.toISOString()),
    ].join(",")
  );

  return [header, ...rows].join("\n");
}