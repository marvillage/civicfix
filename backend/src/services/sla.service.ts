import { prisma } from "../lib/prisma";
import {
  createNotification,
  notifyIssueWatchers,
} from "./notification.service";

interface CreateSLAData {
  issueId: string;
  durationMin: number;
}

export async function createSLA(
  data: CreateSLAData
) {
  const issue = await prisma.issue.findUnique({
    where: {
      id: data.issueId,
    },
  });

  if (!issue) {
    throw new Error("ISSUE_NOT_FOUND");
  }

  const existingSLA = await prisma.sLA.findUnique({
    where: {
      issueId: data.issueId,
    },
  });

  if (existingSLA) {
    throw new Error("SLA_ALREADY_EXISTS");
  }

  if (
    !Number.isInteger(data.durationMin) ||
    data.durationMin <= 0
  ) {
    throw new Error("INVALID_DURATION");
  }

  const deadline = new Date(
    issue.createdAt.getTime() +
      data.durationMin * 60 * 1000
  );

  return prisma.sLA.create({
    data: {
      issueId: data.issueId,
      durationMin: data.durationMin,
      deadline,
    },
    include: {
      issue: true,
    },
  });
}

export async function checkSLABreaches() {
  const now = new Date();

  const breachedSLAs = await prisma.sLA.findMany({
    where: {
      deadline: {
        lt: now,
      },
      breached: false,
      issue: {
        status: {
          notIn: ["RESOLVED", "CLOSED"],
        },
      },
    },
    include: {
      issue: true,
    },
  });

  if (breachedSLAs.length === 0) {
    return [];
  }

  const results = [];

  for (const sla of breachedSLAs) {
    const result = await prisma.$transaction(async (tx) => {
      const updatedSLA = await tx.sLA.update({
        where: {
          id: sla.id,
        },
        data: {
          breached: true,
          breachedAt: now,
        },
      });

      const updatedIssue = await tx.issue.update({
        where: {
          id: sla.issueId,
        },
        data: {
          status: "SLA_BREACHED",
        },
      });

      await tx.statusHistory.create({
        data: {
          issueId: sla.issueId,
          status: "SLA_BREACHED",
          note: "Issue exceeded its SLA deadline",
        },
      });

      return {
        sla: updatedSLA,
        issue: updatedIssue,
      };
    });

    results.push(result);
  }

  return results;
}

export async function escalateBreachedIssues() {
  const breachedIssues = await prisma.issue.findMany({
    where: {
      status: "SLA_BREACHED",
    },
    include: {
      escalations: true,
      assignments: {
        orderBy: {
          assignedAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (breachedIssues.length === 0) {
    return [];
  }

  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
    },
    select: {
      id: true,
    },
  });

  const results = [];

  for (const issue of breachedIssues) {
    const level = issue.escalations.length + 1;

    const result = await prisma.$transaction(async (tx) => {
      const updatedIssue = await tx.issue.update({
        where: {
          id: issue.id,
        },
        data: {
          status: "ESCALATED",
        },
      });

      await tx.escalation.create({
        data: {
          issueId: issue.id,
          level,
          reason: `SLA deadline exceeded — automatically escalated to level ${level}`,
        },
      });

      await tx.statusHistory.create({
        data: {
          issueId: issue.id,
          status: "ESCALATED",
          note: `Issue escalated to level ${level} after SLA breach`,
        },
      });

      return updatedIssue;
    });

    for (const admin of admins) {
      await createNotification(
        admin.id,
        "Issue Escalated",
        `"${issue.title}" breached its SLA and was automatically escalated to level ${level}. It needs attention.`
      );
    }

    const activeAssignment = issue.assignments[0];

    if (activeAssignment) {
      await createNotification(
        activeAssignment.authorityId,
        "Assigned Issue Escalated",
        `Your assigned issue "${issue.title}" breached its SLA and has been escalated to level ${level}.`
      );
    }

    await notifyIssueWatchers(
      issue.id,
      "Issue Escalated",
      `"${issue.title}" missed its resolution deadline and has been escalated to level ${level}.`
    );

    results.push(result);
  }

  return results;
}