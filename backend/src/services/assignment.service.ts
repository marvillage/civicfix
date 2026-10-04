import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import {
  createNotification,
  notifyIssueWatchers,
} from "./notification.service";

interface CreateAssignmentData {
  issueId: string;
  authorityId: string;
  departmentId?: string;
  wardId?: string;
}

export async function createAssignment(
  data: CreateAssignmentData
) {
  const issue = await prisma.issue.findUnique({
    where: {
      id: data.issueId,
    },
    include: {
      assignments: true,
    },
  });

  if (!issue) {
    throw new Error("ISSUE_NOT_FOUND");
  }

  const authority = await prisma.user.findUnique({
    where: {
      id: data.authorityId,
    },
  });

  if (!authority || authority.role !== "AUTHORITY") {
    throw new Error("INVALID_AUTHORITY");
  }

  if (data.departmentId) {
    const department = await prisma.department.findUnique({
      where: {
        id: data.departmentId,
      },
    });

    if (!department) {
      throw new Error("DEPARTMENT_NOT_FOUND");
    }
  }

  if (data.wardId) {
    const ward = await prisma.ward.findUnique({
      where: {
        id: data.wardId,
      },
    });

    if (!ward) {
      throw new Error("WARD_NOT_FOUND");
    }
  }

  const activeAssignment = issue.assignments.find(
    (assignment) => !assignment.completedAt
  );

  const assignment = await prisma.$transaction(
    async (tx) => {
      // Reassign an existing active assignment
      // instead of creating a duplicate assignment.
      if (activeAssignment) {
        return tx.assignment.update({
          where: {
            id: activeAssignment.id,
          },
          data: {
            authorityId: data.authorityId,
            departmentId: data.departmentId,
            wardId: data.wardId,
            acceptedAt: null,
            completedAt: null,
            assignedAt: new Date(),
          },
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
            issue: true,
          },
        });
      }

      // Create a new assignment when
      // there is no active assignment.
      return tx.assignment.create({
        data: {
          issueId: data.issueId,
          authorityId: data.authorityId,
          departmentId: data.departmentId,
          wardId: data.wardId,
        },
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
          issue: true,
        },
      });
    }
  );

  // Notify the assigned authority.
  await createNotification(
    assignment.authority.id,
    activeAssignment
      ? "Issue Reassigned"
      : "New Issue Assigned",
    activeAssignment
      ? `The civic issue "${assignment.issue.title}" has been reassigned to you.`
      : `A new civic issue "${assignment.issue.title}" has been assigned to you.`
  );

  return assignment;
}

export async function acceptAssignment(
  assignmentId: string,
  authorityId: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      issue: {
        include: {
          complaints: {
            select: {
              citizenId: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }

  if (assignment.authorityId !== authorityId) {
    throw new Error("NOT_ASSIGNED_AUTHORITY");
  }

  if (assignment.acceptedAt) {
    throw new Error("ALREADY_ACCEPTED");
  }

  // Temporary debug log to verify that the issue
  // contains the expected citizen complaint(s).
  console.log(
    "ACCEPT ASSIGNMENT DEBUG:",
    assignment.issueId,
    assignment.issue.complaints
  );

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedAssignment =
        await tx.assignment.update({
          where: {
            id: assignmentId,
          },
          data: {
            acceptedAt: new Date(),
          },
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
            issue: true,
          },
        });

      await tx.issue.update({
        where: {
          id: assignment.issueId,
        },
        data: {
          status: "ACKNOWLEDGED",
        },
      });

      await tx.statusHistory.create({
        data: {
          issueId: assignment.issueId,
          changedBy: authorityId,
          status: "ACKNOWLEDGED",
          note: "Authority accepted the assignment",
        },
      });

      for (const complaint of assignment.issue.complaints) {
        if (!complaint.citizenId) {
          continue;
        }

        await tx.notification.create({
          data: {
            userId: complaint.citizenId,
            title: "Issue Acknowledged",
            message: `Your civic issue "${assignment.issue.title}" has been acknowledged by the assigned authority.`,
          },
        });
      }

      return updatedAssignment;
    }
  );

  await notifyIssueWatchers(
    assignment.issueId,
    "Issue Acknowledged",
    `"${assignment.issue.title}" has been acknowledged by the assigned authority.`,
    { excludeComplainants: true }
  );

  return result;
}

export async function startAssignment(
  assignmentId: string,
  authorityId: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      issue: {
        include: {
          complaints: {
            select: {
              citizenId: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }

  if (assignment.authorityId !== authorityId) {
    throw new Error("NOT_ASSIGNED_AUTHORITY");
  }

  if (!assignment.acceptedAt) {
    throw new Error("ASSIGNMENT_NOT_ACCEPTED");
  }

  if (
    assignment.issue.status !== "ACKNOWLEDGED" &&
    assignment.issue.status !== "REOPENED"
  ) {
    throw new Error("INVALID_STATUS");
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedIssue =
        await tx.issue.update({
          where: {
            id: assignment.issueId,
          },
          data: {
            status: "IN_PROGRESS",
          },
        });

      await tx.statusHistory.create({
        data: {
          issueId: assignment.issueId,
          changedBy: authorityId,
          status: "IN_PROGRESS",
          note:
            assignment.issue.status === "REOPENED"
              ? "Authority resumed work after citizen reopened the issue"
              : "Authority started working on the issue",
        },
      });

      for (const complaint of assignment.issue.complaints) {
        if (!complaint.citizenId) {
          continue;
        }

        await tx.notification.create({
          data: {
            userId: complaint.citizenId,
            title: "Work Started",
            message: `Work has started on your civic issue "${assignment.issue.title}".`,
          },
        });
      }

      return updatedIssue;
    }
  );

  await notifyIssueWatchers(
    assignment.issueId,
    "Work Started",
    `Work has started on "${assignment.issue.title}".`,
    { excludeComplainants: true }
  );

  return result;
}

// ─────────────────────────────────────────────
// PROGRESS UPDATE — mid-work note + photo
// ─────────────────────────────────────────────

export async function addProgressUpdate(
  assignmentId: string,
  authorityId: string,
  note: string,
  imageUrl?: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      issue: true,
    },
  });

  if (!assignment) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }

  if (assignment.authorityId !== authorityId) {
    throw new Error("NOT_ASSIGNED_AUTHORITY");
  }

  if (assignment.issue.status !== "IN_PROGRESS") {
    throw new Error("INVALID_STATUS");
  }

  const entry = await prisma.statusHistory.create({
    data: {
      issueId: assignment.issueId,
      changedBy: authorityId,
      status: "IN_PROGRESS",
      note,
      imageUrl,
    },
  });

  await notifyIssueWatchers(
    assignment.issueId,
    "Progress Update",
    `Update on "${assignment.issue.title}": ${note}`
  );

  return entry;
}

export async function resolveAssignment(
  assignmentId: string,
  authorityId: string,
  note?: string,
  resolutionImageUrl?: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      issue: {
        include: {
          complaints: {
            select: {
              citizenId: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("ASSIGNMENT_NOT_FOUND");
  }

  if (assignment.authorityId !== authorityId) {
    throw new Error("NOT_ASSIGNED_AUTHORITY");
  }

  if (!assignment.acceptedAt) {
    throw new Error("ASSIGNMENT_NOT_ACCEPTED");
  }

  if (assignment.issue.status !== "IN_PROGRESS") {
    throw new Error("INVALID_STATUS");
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedAssignment =
        await tx.assignment.update({
          where: {
            id: assignmentId,
          },
          data: {
            completedAt: new Date(),
          },
        });

      await tx.issue.update({
        where: {
          id: assignment.issueId,
        },
        data: {
          status: "RESOLVED",
          ...(resolutionImageUrl
            ? { resolutionImageUrl }
            : {}),
        },
      });

      await tx.statusHistory.create({
        data: {
          issueId: assignment.issueId,
          changedBy: authorityId,
          status: "RESOLVED",
          note:
            note ??
            "Authority resolved the issue",
        },
      });

      for (const complaint of assignment.issue.complaints) {
        if (!complaint.citizenId) {
          continue;
        }

        await tx.notification.create({
          data: {
            userId: complaint.citizenId,
            title: "Issue Resolved",
            message: `Your civic issue "${assignment.issue.title}" has been marked as resolved. Please verify whether the issue has actually been fixed.`,
          },
        });
      }

      return updatedAssignment;
    }
  );

  await notifyIssueWatchers(
    assignment.issueId,
    "Issue Resolved",
    `"${assignment.issue.title}" has been marked as resolved.`,
    { excludeComplainants: true }
  );

  return result;
}

// Slim refs for assignment lists: what the queues and Dispatch
// render, without status histories or full ward/department rows.
const ASSIGNMENT_ISSUE_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  severity: true,
  status: true,
  isEmergency: true,
  reopenCount: true,
  latitude: true,
  longitude: true,
  address: true,
  createdAt: true,
  updatedAt: true,
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
} satisfies Prisma.IssueSelect;

const ORG_REFS = {
  department: { select: { id: true, name: true } },
  ward: { select: { id: true, name: true, code: true } },
} as const;

export async function getMyAssignments(
  authorityId: string
) {
  return prisma.assignment.findMany({
    where: {
      authorityId,
    },
    include: {
      issue: { select: ASSIGNMENT_ISSUE_SELECT },
      ...ORG_REFS,
    },
    orderBy: {
      assignedAt: "desc",
    },
  });
}

// Dispatch board: every open job plus jobs finished in the last
// `days` days, so the payload stays bounded as history grows.
export async function getAllAssignments(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return prisma.assignment.findMany({
    where: {
      OR: [{ completedAt: null }, { completedAt: { gte: since } }],
    },
    include: {
      issue: { select: ASSIGNMENT_ISSUE_SELECT },
      authority: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          avatarUrl: true,
        },
      },
      ...ORG_REFS,
    },
    orderBy: {
      assignedAt: "desc",
    },
  });
}
