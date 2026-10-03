import { prisma } from "../lib/prisma";
import { reverseGeocode } from "./geocoding.service";
import {
  createNotification,
  notifyIssueWatchers,
} from "./notification.service";

interface CreateComplaintData {
  citizenId: string | null;
  imageUrl: string;
  photos?: string[];
  audioUrl?: string;
  isEmergency?: boolean;
  description?: string;
  latitude: number;
  longitude: number;

  // Gemini AI results
  title: string;
  category: string;
  severity: string;
  aiConfidence: number;
}

export async function getMyComplaints(citizenId: string) {
  return prisma.complaint.findMany({
    where: {
      citizenId,
    },
    include: {
      issue: {
        include: {
          department: true,
          ward: true,
          sla: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getComplaintById(
  complaintId: string,
  citizenId: string
) {
  return prisma.complaint.findFirst({
    where: {
      id: complaintId,
      citizenId,
    },
    include: {
      issue: {
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
        },
      },
    },
  });
}

const VALID_CATEGORIES = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "GARBAGE",
  "WATER_LEAKAGE",
  "DRAINAGE",
  "OTHER",
];

const CATEGORY_ALIASES: Record<string, string> = {
  POTHOLE: "ROAD_DAMAGE",
  ROAD: "ROAD_DAMAGE",
  ROAD_ISSUE: "ROAD_DAMAGE",
  STREET_LIGHT: "STREETLIGHT",
  LIGHT: "STREETLIGHT",
  LIGHTING: "STREETLIGHT",
  TRASH: "GARBAGE",
  WASTE: "GARBAGE",
  LITTER: "GARBAGE",
  WATER: "WATER_LEAKAGE",
  WATER_LEAK: "WATER_LEAKAGE",
  LEAKAGE: "WATER_LEAKAGE",
  SEWAGE: "DRAINAGE",
  SEWER: "DRAINAGE",
  FLOODING: "DRAINAGE",
};

const VALID_SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

function normalizeCategory(raw: string) {
  const value = (raw || "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z]+/g, "_");

  if (VALID_CATEGORIES.includes(value)) {
    return value;
  }

  if (CATEGORY_ALIASES[value]) {
    return CATEGORY_ALIASES[value];
  }

  return "OTHER";
}

function normalizeSeverity(raw: string) {
  const value = (raw || "").toUpperCase().trim();

  return VALID_SEVERITIES.includes(value)
    ? value
    : "MEDIUM";
}

export async function createComplaint(
  data: CreateComplaintData
) {
  const address = await reverseGeocode(
    data.latitude,
    data.longitude
  );

  const category = normalizeCategory(data.category);

  // Auto-assignment rule: category → default department
  const rule = await prisma.categoryRule.findUnique({
    where: {
      category: category as any,
    },
  });

  const issue = await prisma.issue.create({
    data: {
      title: data.title,
      description: data.description,
      category: category as any,
      severity: data.isEmergency
        ? "CRITICAL"
        : (normalizeSeverity(data.severity) as any),
      isEmergency: data.isEmergency ?? false,
      latitude: data.latitude,
      longitude: data.longitude,
      address,
      aiConfidence: data.aiConfidence,
      status: "REPORTED",
      departmentId: rule?.departmentId,
    },
  });

  const complaint = await prisma.complaint.create({
    data: {
      citizenId: data.citizenId,
      issueId: issue.id,
      imageUrl: data.imageUrl,
      photos:
        data.photos && data.photos.length > 0
          ? data.photos
          : [data.imageUrl],
      audioUrl: data.audioUrl,
      description: data.description,
      latitude: data.latitude,
      longitude: data.longitude,
    },
    include: {
      issue: true,
    },
  });

  // Emergency reports wake up every admin immediately.
  if (data.isEmergency) {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    for (const admin of admins) {
      await createNotification(
        admin.id,
        "🚨 EMERGENCY REPORT",
        `An emergency civic issue was just reported: "${issue.title}"${address ? ` near ${address}` : ""}. It needs immediate attention.`
      );
    }
  }

  // Reward registered citizens for reporting.
  if (data.citizenId) {
    await prisma.user.update({
      where: {
        id: data.citizenId,
      },
      data: {
        points: {
          increment: 5,
        },
      },
    });
  }

  return complaint;
}

export async function verifyComplaintResolution(
  complaintId: string,
  citizenId: string,
  approved: boolean,
  note?: string,
  stars?: number
) {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id: complaintId,
      citizenId,
    },
    include: {
      issue: {
        include: {
          assignments: {
            orderBy: {
              assignedAt: "desc",
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
            },
          },
        },
      },
    },
  });

  if (!complaint) {
    throw new Error("COMPLAINT_NOT_FOUND");
  }

  if (complaint.issue.status !== "RESOLVED") {
    throw new Error("INVALID_STATUS");
  }

  const newStatus = approved ? "CLOSED" : "REOPENED";

  const result = await prisma.$transaction(
    async (tx) => {
      const updatedIssue = await tx.issue.update({
        where: {
          id: complaint.issueId,
        },
        data: {
          status: newStatus,
        },
      });

      await tx.statusHistory.create({
        data: {
          issueId: complaint.issueId,
          changedBy: citizenId,
          status: newStatus,
          note:
            note ??
            (approved
              ? "Citizen verified the resolution"
              : "Citizen rejected the resolution"),
        },
      });

      // When the citizen rejects the resolution,
      // reactivate the most recent assignment so
      // the authority can continue working on the issue.
      if (!approved) {
        const assignment = complaint.issue.assignments[0];

        if (assignment) {
          await tx.assignment.update({
            where: {
              id: assignment.id,
            },
            data: {
              acceptedAt: null,
              completedAt: null,
              assignedAt: new Date(),
            },
          });
        }
      }

      // Reward the citizen for closing the loop:
      // +5 for verifying, +10 extra when the fix is confirmed.
      await tx.user.update({
        where: {
          id: citizenId,
        },
        data: {
          points: {
            increment: approved ? 15 : 5,
          },
        },
      });

      // Record the verification with the satisfaction rating.
      await tx.resolutionVerification.upsert({
        where: {
          issueId: complaint.issueId,
        },
        create: {
          issueId: complaint.issueId,
          citizenId,
          verified: approved,
          comment: note,
          stars: approved ? stars : undefined,
        },
        update: {
          verified: approved,
          comment: note,
          stars: approved ? stars : undefined,
          citizenId,
        },
      });

      // A rejection means the fix did not hold — track it.
      if (!approved) {
        await tx.issue.update({
          where: {
            id: complaint.issueId,
          },
          data: {
            reopenCount: {
              increment: 1,
            },
          },
        });
      }

      return updatedIssue;
    }
  );

  // Chronic issue alert: reopened twice or more.
  if (!approved) {
    const updated = await prisma.issue.findUnique({
      where: { id: complaint.issueId },
      select: { reopenCount: true, title: true },
    });

    if (updated && updated.reopenCount >= 2) {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });

      for (const admin of admins) {
        await createNotification(
          admin.id,
          "Chronic Issue Detected",
          `"${updated.title}" has been reopened ${updated.reopenCount} times. The fixes are not holding — it may need a different approach.`
        );
      }
    }
  }

  // Notify the authority when the citizen reopens the issue.
  if (!approved) {
    const assignment = complaint.issue.assignments[0];

    if (assignment) {
      await createNotification(
        assignment.authority.id,
        "Issue Reopened",
        `The citizen has rejected the resolution of "${complaint.issue.title}" and reopened the issue.${
          note ? ` Reason: ${note}` : ""
        }`
      );
    }
  }

  await notifyIssueWatchers(
    complaint.issueId,
    approved ? "Issue Closed" : "Issue Reopened",
    approved
      ? `"${complaint.issue.title}" was verified as fixed and is now closed.`
      : `"${complaint.issue.title}" was reopened — the citizen reported the problem is not fixed.`,
    { excludeUserId: citizenId }
  );

  return result;
}

// ─────────────────────────────────────────────
// FIELD SURVEY — authority logs an issue directly
// ─────────────────────────────────────────────

interface FieldReportData {
  authorityId: string;
  title: string;
  category: string;
  severity: string;
  description?: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  photos?: string[];
}

export async function createFieldReport(
  data: FieldReportData
) {
  const address = await reverseGeocode(
    data.latitude,
    data.longitude
  );

  const category = normalizeCategory(data.category);

  const rule = await prisma.categoryRule.findUnique({
    where: {
      category: category as any,
    },
  });

  return prisma.$transaction(async (tx) => {
    const issue = await tx.issue.create({
      data: {
        title: data.title,
        description: data.description,
        category: category as any,
        severity: normalizeSeverity(
          data.severity
        ) as any,
        latitude: data.latitude,
        longitude: data.longitude,
        address,
        status: "ACKNOWLEDGED",
        departmentId: rule?.departmentId,
      },
    });

    await tx.complaint.create({
      data: {
        citizenId: null,
        issueId: issue.id,
        imageUrl: data.imageUrl,
        photos:
          data.photos && data.photos.length > 0
            ? data.photos
            : [data.imageUrl],
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    // Field reports are pre-verified and assigned
    // to the surveying authority immediately.
    await tx.assignment.create({
      data: {
        issueId: issue.id,
        authorityId: data.authorityId,
        departmentId: rule?.departmentId,
        acceptedAt: new Date(),
      },
    });

    await tx.statusHistory.create({
      data: {
        issueId: issue.id,
        changedBy: data.authorityId,
        status: "ACKNOWLEDGED",
        note: "Logged during a field survey by the authority",
      },
    });

    return issue;
  });
}

// ─────────────────────────────────────────────
// WITHDRAW COMPLAINT
// ─────────────────────────────────────────────

export async function withdrawComplaint(
  complaintId: string,
  citizenId: string
) {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id: complaintId,
      citizenId,
    },
    include: {
      issue: {
        include: {
          assignments: true,
          _count: {
            select: {
              complaints: true,
            },
          },
        },
      },
    },
  });

  if (!complaint) {
    throw new Error("COMPLAINT_NOT_FOUND");
  }

  const withdrawableStatuses = [
    "REPORTED",
    "AI_VERIFIED",
  ];

  const hasActiveAssignment =
    complaint.issue.assignments.some(
      (assignment) => !assignment.completedAt
    );

  if (
    !withdrawableStatuses.includes(
      complaint.issue.status
    ) ||
    hasActiveAssignment
  ) {
    throw new Error("NOT_WITHDRAWABLE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.complaint.delete({
      where: {
        id: complaintId,
      },
    });

    // Close the issue when this was its only report.
    if (complaint.issue._count.complaints === 1) {
      await tx.issue.update({
        where: {
          id: complaint.issueId,
        },
        data: {
          status: "CLOSED",
        },
      });

      await tx.statusHistory.create({
        data: {
          issueId: complaint.issueId,
          changedBy: citizenId,
          status: "CLOSED",
          note: "Report withdrawn by the citizen",
        },
      });
    }
  });

  return { withdrawn: true };
}