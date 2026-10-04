import { prisma } from "../src/lib/prisma";
import { createAssignment } from "../src/services/assignment.service";

async function main() {
  const authority = await prisma.user.findUnique({
    where: {
      email: "authority@fixity.test",
    },
  });

  if (!authority) {
    throw new Error("AUTHORITY_NOT_FOUND");
  }

  const issue = await prisma.issue.findFirst({
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

  const assignment = await createAssignment({
    issueId: issue.id,
    authorityId: authority.id,
  });

  console.log("New issue assigned successfully!");

  console.log({
    issueId: issue.id,
    title: issue.title,
    status: issue.status,
    assignmentId: assignment.id,
    authority: assignment.authority?.email,
    acceptedAt: assignment.acceptedAt,
  });
}

main()
  .catch((error) => {
    console.error("Assignment failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });