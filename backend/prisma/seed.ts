import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

/**
 * Production seed: the minimum data a freshly deployed
 * CivicFix needs — the admin account, one authority, one
 * citizen, the organisation structure, and four sample
 * issues that show the full lifecycle on the public pages.
 *
 *   npm run seed        -> reset to this baseline
 *   npm run seed:demo   -> the large local-testing dataset
 */

const ADMIN = {
  name: "CivicFix Admin",
  email: "admin@gmail.com",
  password: "123456789",
};

const AUTHORITY = {
  name: "Sunil Kumar",
  email: "authority@civicfix.com",
  password: "Authority@123",
  employeeId: "MCD-2026-0147",
  designation: "Junior Engineer",
  phone: "+91 98100 22147",
};

const CITIZEN = {
  name: "Ananya Sharma",
  email: "citizen@civicfix.com",
  password: "Citizen@123",
};

const photo = (seed: string) =>
  `https://picsum.photos/seed/${seed}/900/600`;

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3600 * 1000);

const hoursAhead = (h: number) =>
  new Date(Date.now() + h * 3600 * 1000);

async function wipe() {
  console.log("Clearing existing data...");

  await prisma.message.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.resolutionVerification.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.sLA.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.upvote.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.ward.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
}

async function main() {
  await wipe();

  // ── Organisation ────────────────────────────────
  console.log("Seeding departments and wards...");

  const [roads, sanitation, water, electrical] =
    await Promise.all([
      prisma.department.create({
        data: { name: "Roads & Infrastructure" },
      }),
      prisma.department.create({
        data: { name: "Sanitation & Waste" },
      }),
      prisma.department.create({
        data: { name: "Water & Drainage" },
      }),
      prisma.department.create({
        data: { name: "Electrical & Lighting" },
      }),
    ]);

  const [ward12, ward7, ward21] = await Promise.all([
    prisma.ward.create({
      data: { name: "Gandhi Nagar", code: "W-12" },
    }),
    prisma.ward.create({
      data: { name: "Nehru Colony", code: "W-07" },
    }),
    prisma.ward.create({
      data: { name: "Model Town", code: "W-21" },
    }),
  ]);

  await prisma.categoryRule.createMany({
    data: [
      { category: "ROAD_DAMAGE", departmentId: roads.id },
      { category: "GARBAGE", departmentId: sanitation.id },
      { category: "WATER_LEAKAGE", departmentId: water.id },
      { category: "DRAINAGE", departmentId: water.id },
      {
        category: "STREETLIGHT",
        departmentId: electrical.id,
      },
    ],
  });

  // ── Accounts ────────────────────────────────────
  console.log("Seeding accounts...");

  const admin = await prisma.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash: await bcrypt.hash(
        ADMIN.password,
        12
      ),
      role: "ADMIN",
      isVerified: true,
    },
  });

  const officer = await prisma.user.create({
    data: {
      name: AUTHORITY.name,
      email: AUTHORITY.email,
      passwordHash: await bcrypt.hash(
        AUTHORITY.password,
        12
      ),
      role: "AUTHORITY",
      isVerified: true,
      employeeId: AUTHORITY.employeeId,
      designation: AUTHORITY.designation,
      phone: AUTHORITY.phone,
      departmentId: roads.id,
    },
  });

  const citizen = await prisma.user.create({
    data: {
      name: CITIZEN.name,
      email: CITIZEN.email,
      passwordHash: await bcrypt.hash(
        CITIZEN.password,
        12
      ),
      role: "CITIZEN",
      points: 30,
      ward: "Gandhi Nagar (W-12)",
      isVerified: true,
    },
  });

  // ── Four sample issues covering the lifecycle ───
  console.log("Seeding sample issues...");

  // 1. REPORTED — fresh, unassigned, with an active SLA
  const reported = await prisma.issue.create({
    data: {
      title:
        "Deep pothole cluster near Gandhi Market crossing",
      description:
        "Three large potholes fill with water after every rain. Two-wheelers swerve into oncoming traffic to avoid them.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "REPORTED",
      latitude: 28.6139,
      longitude: 77.209,
      address:
        "Gandhi Market Road, Gandhi Nagar, New Delhi",
      aiConfidence: 0.91,
      wardId: ward12.id,
      departmentId: roads.id,
      createdAt: hoursAgo(8),
    },
  });

  await prisma.complaint.create({
    data: {
      citizenId: citizen.id,
      issueId: reported.id,
      imageUrl: photo("civicfix-pothole-a"),
      photos: [
        photo("civicfix-pothole-a"),
        photo("civicfix-pothole-b"),
      ],
      description:
        "Three large potholes fill with water after every rain. Two-wheelers swerve into oncoming traffic to avoid them.",
      latitude: 28.6139,
      longitude: 77.209,
      createdAt: hoursAgo(8),
    },
  });

  await prisma.statusHistory.create({
    data: {
      issueId: reported.id,
      changedBy: citizen.id,
      status: "REPORTED",
      note: "Issue reported by a citizen",
      createdAt: hoursAgo(8),
    },
  });

  await prisma.sLA.create({
    data: {
      issueId: reported.id,
      durationMin: 2880,
      deadline: hoursAhead(40),
    },
  });

  // 2. IN_PROGRESS — assigned, accepted, started, with a
  //    progress update so the timeline has real content
  const inProgress = await prisma.issue.create({
    data: {
      title:
        "Road surface broken outside the community hall",
      description:
        "Tar has peeled away over a ten metre stretch, exposing loose gravel that keeps causing skids.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "IN_PROGRESS",
      latitude: 28.6121,
      longitude: 77.2201,
      address:
        "Community Hall Road, Model Town, New Delhi",
      aiConfidence: 0.88,
      wardId: ward21.id,
      departmentId: roads.id,
      createdAt: hoursAgo(72),
    },
  });

  await prisma.complaint.create({
    data: {
      citizenId: citizen.id,
      issueId: inProgress.id,
      imageUrl: photo("civicfix-road-a"),
      photos: [
        photo("civicfix-road-a"),
        photo("civicfix-road-b"),
      ],
      description:
        "Tar has peeled away over a ten metre stretch, exposing loose gravel that keeps causing skids.",
      latitude: 28.6121,
      longitude: 77.2201,
      createdAt: hoursAgo(72),
    },
  });

  const inProgressAssignment =
    await prisma.assignment.create({
      data: {
        issueId: inProgress.id,
        authorityId: officer.id,
        departmentId: roads.id,
        wardId: ward21.id,
        assignedAt: hoursAgo(60),
        acceptedAt: hoursAgo(54),
      },
    });

  await prisma.statusHistory.createMany({
    data: [
      {
        issueId: inProgress.id,
        changedBy: citizen.id,
        status: "REPORTED",
        note: "Issue reported by a citizen",
        createdAt: hoursAgo(72),
      },
      {
        issueId: inProgress.id,
        changedBy: admin.id,
        status: "ASSIGNED",
        note: `Assigned to ${officer.name}`,
        createdAt: hoursAgo(60),
      },
      {
        issueId: inProgress.id,
        changedBy: officer.id,
        status: "ACKNOWLEDGED",
        note: "Authority accepted the assignment",
        createdAt: hoursAgo(54),
      },
      {
        issueId: inProgress.id,
        changedBy: officer.id,
        status: "IN_PROGRESS",
        note: "Authority started working on the issue",
        createdAt: hoursAgo(30),
      },
      {
        issueId: inProgress.id,
        changedBy: officer.id,
        status: "IN_PROGRESS",
        note: "Base layer laid. Final surfacing scheduled for tomorrow morning.",
        imageUrl: photo("civicfix-progress-1"),
        createdAt: hoursAgo(5),
      },
    ],
  });

  await prisma.sLA.create({
    data: {
      issueId: inProgress.id,
      durationMin: 4320,
      deadline: hoursAhead(10),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        issueId: inProgress.id,
        senderId: officer.id,
        text: "Hello, I am the engineer assigned to your report. Could you confirm whether the damage extends past the hall gate?",
        createdAt: hoursAgo(28),
      },
      {
        issueId: inProgress.id,
        senderId: citizen.id,
        text: "Yes, it continues about five metres past the gate towards the water tank.",
        createdAt: hoursAgo(27),
      },
    ],
  });

  await prisma.comment.create({
    data: {
      issueId: inProgress.id,
      userId: officer.id,
      text: "Only half the carriageway will be closed during the work. Access to the hall stays open.",
      createdAt: hoursAgo(26),
    },
  });

  // 3. RESOLVED — awaiting citizen verification, with
  //    a proof photo so the before/after view works
  const resolved = await prisma.issue.create({
    data: {
      title:
        "Streetlight out on the entire 4th Cross stretch",
      description:
        "Six consecutive streetlights are dead. The lane is pitch dark after 7pm and feels unsafe.",
      category: "STREETLIGHT",
      severity: "MEDIUM",
      status: "RESOLVED",
      latitude: 28.6202,
      longitude: 77.2043,
      address: "4th Cross, Nehru Colony, New Delhi",
      aiConfidence: 0.86,
      wardId: ward7.id,
      departmentId: electrical.id,
      resolutionImageUrl: photo("civicfix-light-proof"),
      createdAt: hoursAgo(120),
    },
  });

  await prisma.complaint.create({
    data: {
      citizenId: citizen.id,
      issueId: resolved.id,
      imageUrl: photo("civicfix-streetlight-a"),
      photos: [photo("civicfix-streetlight-a")],
      description:
        "Six consecutive streetlights are dead. The lane is pitch dark after 7pm and feels unsafe.",
      latitude: 28.6202,
      longitude: 77.2043,
      createdAt: hoursAgo(120),
    },
  });

  await prisma.assignment.create({
    data: {
      issueId: resolved.id,
      authorityId: officer.id,
      departmentId: electrical.id,
      wardId: ward7.id,
      assignedAt: hoursAgo(110),
      acceptedAt: hoursAgo(104),
      completedAt: hoursAgo(6),
    },
  });

  await prisma.statusHistory.createMany({
    data: [
      {
        issueId: resolved.id,
        changedBy: citizen.id,
        status: "REPORTED",
        note: "Issue reported by a citizen",
        createdAt: hoursAgo(120),
      },
      {
        issueId: resolved.id,
        changedBy: admin.id,
        status: "ASSIGNED",
        note: `Assigned to ${officer.name}`,
        createdAt: hoursAgo(110),
      },
      {
        issueId: resolved.id,
        changedBy: officer.id,
        status: "ACKNOWLEDGED",
        note: "Authority accepted the assignment",
        createdAt: hoursAgo(104),
      },
      {
        issueId: resolved.id,
        changedBy: officer.id,
        status: "IN_PROGRESS",
        note: "Replacement fittings collected from the depot",
        createdAt: hoursAgo(40),
      },
      {
        issueId: resolved.id,
        changedBy: officer.id,
        status: "RESOLVED",
        note: "All six lights replaced and tested. Please verify.",
        createdAt: hoursAgo(6),
      },
    ],
  });

  // 4. CLOSED — verified by the citizen with a rating,
  //    so stats, ratings and the leaderboard have data
  const closed = await prisma.issue.create({
    data: {
      title:
        "Uncollected construction debris blocking half the road",
      description:
        "A pile of rubble from a private build has been sitting on the public road for two weeks.",
      category: "GARBAGE",
      severity: "MEDIUM",
      status: "CLOSED",
      latitude: 28.6175,
      longitude: 77.2035,
      address:
        "Nehru Colony Main Road, New Delhi",
      aiConfidence: 0.83,
      wardId: ward7.id,
      departmentId: sanitation.id,
      resolutionImageUrl: photo("civicfix-debris-proof"),
      createdAt: hoursAgo(260),
    },
  });

  await prisma.complaint.create({
    data: {
      citizenId: citizen.id,
      issueId: closed.id,
      imageUrl: photo("civicfix-debris-a"),
      photos: [photo("civicfix-debris-a")],
      description:
        "A pile of rubble from a private build has been sitting on the public road for two weeks.",
      latitude: 28.6175,
      longitude: 77.2035,
      createdAt: hoursAgo(260),
    },
  });

  await prisma.assignment.create({
    data: {
      issueId: closed.id,
      authorityId: officer.id,
      departmentId: sanitation.id,
      wardId: ward7.id,
      assignedAt: hoursAgo(250),
      acceptedAt: hoursAgo(244),
      completedAt: hoursAgo(200),
    },
  });

  await prisma.statusHistory.createMany({
    data: [
      {
        issueId: closed.id,
        changedBy: citizen.id,
        status: "REPORTED",
        note: "Issue reported by a citizen",
        createdAt: hoursAgo(260),
      },
      {
        issueId: closed.id,
        changedBy: admin.id,
        status: "ASSIGNED",
        note: `Assigned to ${officer.name}`,
        createdAt: hoursAgo(250),
      },
      {
        issueId: closed.id,
        changedBy: officer.id,
        status: "ACKNOWLEDGED",
        note: "Authority accepted the assignment",
        createdAt: hoursAgo(244),
      },
      {
        issueId: closed.id,
        changedBy: officer.id,
        status: "IN_PROGRESS",
        note: "Clearance vehicle scheduled",
        createdAt: hoursAgo(220),
      },
      {
        issueId: closed.id,
        changedBy: officer.id,
        status: "RESOLVED",
        note: "Debris cleared and road swept",
        createdAt: hoursAgo(200),
      },
      {
        issueId: closed.id,
        changedBy: citizen.id,
        status: "CLOSED",
        note: "Citizen verified the resolution",
        createdAt: hoursAgo(196),
      },
    ],
  });

  await prisma.sLA.create({
    data: {
      issueId: closed.id,
      durationMin: 4320,
      deadline: hoursAgo(188),
    },
  });

  await prisma.resolutionVerification.create({
    data: {
      issueId: closed.id,
      citizenId: citizen.id,
      verified: true,
      stars: 5,
      comment:
        "Cleared the very next morning. Excellent response.",
      createdAt: hoursAgo(196),
    },
  });

  // A few upvotes so the community signals are not empty
  await prisma.upvote.createMany({
    data: [
      { userId: citizen.id, issueId: inProgress.id },
      { userId: officer.id, issueId: reported.id },
      { userId: admin.id, issueId: reported.id },
    ],
  });

  // Opening notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: citizen.id,
        title: "Issue Resolved",
        message: `Your civic issue "${resolved.title}" has been marked as resolved. Please verify whether the issue has actually been fixed.`,
        createdAt: hoursAgo(6),
      },
      {
        userId: citizen.id,
        title: "Progress Update",
        message: `Update on "${inProgress.title}": Base layer laid. Final surfacing scheduled for tomorrow morning.`,
        createdAt: hoursAgo(5),
      },
      {
        userId: officer.id,
        title: "New Issue Assigned",
        message: `A new civic issue "${reported.title}" needs attention in your ward.`,
        createdAt: hoursAgo(7),
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    issues: await prisma.issue.count(),
    complaints: await prisma.complaint.count(),
    departments: await prisma.department.count(),
    wards: await prisma.ward.count(),
  };

  console.log("\nSeed complete:", counts);
  console.log(`
=========================================================
  ACCOUNTS
=========================================================
  ADMIN      ${ADMIN.email}         ${ADMIN.password}
  AUTHORITY  ${AUTHORITY.email}  ${AUTHORITY.password}
  CITIZEN    ${CITIZEN.email}    ${CITIZEN.password}
=========================================================
  Change the admin password after the first login.
`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
