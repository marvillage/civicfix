import { prisma } from "../src/lib/prisma";
import { createAssignment } from "../src/services/assignment.service";

async function main() {
  const authority =
    await prisma.user.findUnique({
      where: {
        email: "authority@fixity.test",
      },
    });

  if (!authority) {
    throw new Error(
      "AUTHORITY_NOT_FOUND"
    );
  }

  if (authority.role !== "AUTHORITY") {
    throw new Error(
      "USER_IS_NOT_AN_AUTHORITY"
    );
  }

  const existingAssignment =
    await prisma.assignment.findFirst({
      where: {
        authorityId: authority.id,
      },
      include: {
        issue: true,
      },
    });

  if (existingAssignment) {
    console.log(
      "Authority already has an assignment:"
    );

    console.log({
      assignmentId:
        existingAssignment.id,
      issueId:
        existingAssignment.issueId,
      issueTitle:
        existingAssignment.issue.title,
      issueStatus:
        existingAssignment.issue.status,
    });

    return;
  }

  const issue =
    await prisma.issue.findFirst({
      where: {
        status: "REPORTED",
        assignments: {
          none: {},
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  if (!issue) {
    throw new Error(
      "NO_UNASSIGNED_REPORTED_ISSUE"
    );
  }

  const assignment =
    await createAssignment({
      issueId: issue.id,
      authorityId: authority.id,
    });

  console.log(
    "Issue assigned successfully:"
  );

  console.log({
    assignmentId: assignment.id,
    issueId: issue.id,
    issueTitle: issue.title,
    authority:
      assignment.authority?.email,
    acceptedAt:
      assignment.acceptedAt,
  });
}

main()
  .catch((error) => {
    console.error(
      "Failed to assign issue:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });