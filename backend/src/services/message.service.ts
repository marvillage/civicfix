import { prisma } from "../lib/prisma";
import { createNotification } from "./notification.service";

async function assertParticipant(
  issueId: string,
  userId: string,
  role: string
) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      complaints: {
        select: { citizenId: true },
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: { authorityId: true },
      },
    },
  });

  if (!issue) {
    throw new Error("ISSUE_NOT_FOUND");
  }

  const isComplainant = issue.complaints.some(
    (complaint) => complaint.citizenId === userId
  );

  const isAssignedAuthority =
    issue.assignments[0]?.authorityId === userId;

  if (
    !isComplainant &&
    !isAssignedAuthority &&
    role !== "ADMIN"
  ) {
    throw new Error("NOT_A_PARTICIPANT");
  }

  return issue;
}

export async function getIssueMessages(
  issueId: string,
  userId: string,
  role: string
) {
  await assertParticipant(issueId, userId, role);

  return prisma.message.findMany({
    where: { issueId },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function sendIssueMessage(
  issueId: string,
  userId: string,
  role: string,
  text: string
) {
  const issue = await assertParticipant(
    issueId,
    userId,
    role
  );

  const message = await prisma.message.create({
    data: {
      issueId,
      senderId: userId,
      text,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  // Notify the other side of the thread.
  const recipients = new Set<string>();

  issue.complaints.forEach((complaint) => {
    if (complaint.citizenId) {
      recipients.add(complaint.citizenId);
    }
  });

  const authorityId = issue.assignments[0]?.authorityId;

  if (authorityId) {
    recipients.add(authorityId);
  }

  recipients.delete(userId);

  for (const recipientId of recipients) {
    await createNotification(
      recipientId,
      "New Message",
      `${message.sender.name} sent a message on "${issue.title}".`
    );
  }

  return message;
}
