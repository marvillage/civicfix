import { prisma } from "../lib/prisma";

export async function getIssueComments(issueId: string) {
  return prisma.comment.findMany({
    where: {
      issueId,
    },
    include: {
      user: {
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

export async function createComment(
  issueId: string,
  userId: string,
  text: string
) {
  const issue = await prisma.issue.findUnique({
    where: {
      id: issueId,
    },
  });

  if (!issue) {
    throw new Error("ISSUE_NOT_FOUND");
  }

  return prisma.comment.create({
    data: {
      issueId,
      userId,
      text,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
}
