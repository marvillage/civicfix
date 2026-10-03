import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

/**
 * Demo seed: mock accounts + realistic data covering every feature
 * and every issue status, so the whole app can be tested by hand.
 *
 *   npm run seed          -> wipe demo data and reseed
 */

const PASSWORDS = {
  citizen: "Citizen@123",
  authority: "Authority@123",
  admin: "Admin@123",
};

const photo = (seed: string) =>
  `https://picsum.photos/seed/${seed}/900/600`;

const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0b5d54&textColor=ffffff`;

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

  const [ward12, ward7, ward3, ward21] = await Promise.all(
    [
      prisma.ward.create({
        data: { name: "Gandhi Nagar", code: "W-12" },
      }),
      prisma.ward.create({
        data: { name: "Nehru Colony", code: "W-07" },
      }),
      prisma.ward.create({
        data: { name: "Rajendra Park", code: "W-03" },
      }),
      prisma.ward.create({
        data: { name: "Model Town", code: "W-21" },
      }),
    ]
  );

  // Auto-assignment rules: category -> department
  await prisma.categoryRule.createMany({
    data: [
      {
        category: "ROAD_DAMAGE",
        departmentId: roads.id,
      },
      {
        category: "GARBAGE",
        departmentId: sanitation.id,
      },
      {
        category: "WATER_LEAKAGE",
        departmentId: water.id,
      },
      {
        category: "DRAINAGE",
        departmentId: water.id,
      },
      {
        category: "STREETLIGHT",
        departmentId: electrical.id,
      },
    ],
  });

  console.log("Seeding users...");

  const citizenHash = await bcrypt.hash(
    PASSWORDS.citizen,
    12
  );
  const authorityHash = await bcrypt.hash(
    PASSWORDS.authority,
    12
  );
  const adminHash = await bcrypt.hash(
    PASSWORDS.admin,
    12
  );

  const citizen = await prisma.user.create({
    data: {
      name: "Kushagra Srivastava",
      email: "citizen@civicfix.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 65,
      avatarUrl: avatar("Kushagra Srivastava"),
      bio: "Resident of Gandhi Nagar. Reporting what I walk past every day.",
      ward: "Gandhi Nagar (W-12)",
      createdAt: hoursAgo(24 * 60),
    },
  });

  const priya = await prisma.user.create({
    data: {
      name: "Priya Menon",
      email: "priya@civicfix.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 120,
      avatarUrl: avatar("Priya Menon"),
      bio: "RWA secretary. Chasing civic fixes since 2019.",
      ward: "Nehru Colony (W-07)",
      createdAt: hoursAgo(24 * 90),
    },
  });

  const rahul = await prisma.user.create({
    data: {
      name: "Rahul Verma",
      email: "rahul@civicfix.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 45,
      avatarUrl: avatar("Rahul Verma"),
      ward: "Model Town (W-21)",
      createdAt: hoursAgo(24 * 40),
    },
  });

  const aisha = await prisma.user.create({
    data: {
      name: "Aisha Khan",
      email: "aisha@civicfix.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 25,
      avatarUrl: avatar("Aisha Khan"),
      ward: "Rajendra Park (W-03)",
      createdAt: hoursAgo(24 * 20),
    },
  });

  const officer = await prisma.user.create({
    data: {
      name: "Sunil Kumar",
      email: "authority@civicfix.test",
      passwordHash: authorityHash,
      role: "AUTHORITY",
      employeeId: "MCD-2024-0147",
      designation: "Junior Engineer",
      phone: "+91 98100 22147",
      departmentId: roads.id,
      avatarUrl: avatar("Sunil Kumar"),
      createdAt: hoursAgo(24 * 200),
    },
  });

  const officer2 = await prisma.user.create({
    data: {
      name: "Meera Joshi",
      email: "engineer@civicfix.test",
      passwordHash: authorityHash,
      role: "AUTHORITY",
      employeeId: "MCD-2023-0088",
      designation: "Assistant Engineer",
      phone: "+91 98100 33088",
      departmentId: water.id,
      avatarUrl: avatar("Meera Joshi"),
      createdAt: hoursAgo(24 * 300),
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "CivicFix Admin",
      email: "admin@civicfix.test",
      passwordHash: adminHash,
      role: "ADMIN",
      avatarUrl: avatar("CivicFix Admin"),
      createdAt: hoursAgo(24 * 365),
    },
  });

  console.log("Seeding issues...");

  interface SeedIssue {
    key: string;
    title: string;
    description: string;
    category: any;
    severity: any;
    status: any;
    lat: number;
    lng: number;
    address: string;
    ward: string;
    dept: string;
    createdHoursAgo: number;
    isEmergency?: boolean;
    reopenCount?: number;
    reporter: string;
    extraReporters?: string[];
    upvoters?: string[];
    photos: string[];
    audio?: boolean;
  }

  const wardMap: Record<string, string> = {
    W12: ward12.id,
    W7: ward7.id,
    W3: ward3.id,
    W21: ward21.id,
  };

  const deptMap: Record<string, string> = {
    roads: roads.id,
    sanitation: sanitation.id,
    water: water.id,
    electrical: electrical.id,
  };

  const userMap: Record<string, string> = {
    citizen: citizen.id,
    priya: priya.id,
    rahul: rahul.id,
    aisha: aisha.id,
  };

  const seedIssues: SeedIssue[] = [
    {
      key: "reported-pothole",
      title: "Deep pothole cluster near Gandhi Market crossing",
      description:
        "Three large potholes fill with water after every rain. Two-wheelers swerve into oncoming traffic to avoid them.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "REPORTED",
      lat: 28.6139,
      lng: 77.209,
      address: "Gandhi Market Road, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "roads",
      createdHoursAgo: 6,
      reporter: "citizen",
      extraReporters: ["rahul"],
      upvoters: ["priya", "rahul", "aisha"],
      photos: [
        photo("civicfix-pothole-a"),
        photo("civicfix-pothole-b"),
      ],
      audio: true,
    },
    {
      key: "reported-garbage",
      title: "Garbage bin overflowing outside school gate",
      description:
        "The bin has not been cleared for four days. Stray dogs are scattering waste across the footpath where children walk.",
      category: "GARBAGE",
      severity: "MEDIUM",
      status: "REPORTED",
      lat: 28.6165,
      lng: 77.2115,
      address: "Near DAV School, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "sanitation",
      createdHoursAgo: 20,
      reporter: "priya",
      upvoters: ["citizen", "aisha"],
      photos: [photo("civicfix-garbage-a")],
    },
    {
      key: "ai-verified",
      title: "Streetlight out on the entire 4th Cross stretch",
      description:
        "Six consecutive streetlights are dead. The lane is pitch dark after 7pm and feels unsafe.",
      category: "STREETLIGHT",
      severity: "HIGH",
      status: "AI_VERIFIED",
      lat: 28.6202,
      lng: 77.2043,
      address: "4th Cross, Nehru Colony, New Delhi",
      ward: "W7",
      dept: "electrical",
      createdHoursAgo: 30,
      reporter: "rahul",
      upvoters: ["citizen", "priya"],
      photos: [photo("civicfix-streetlight-a")],
    },
    {
      key: "assigned",
      title: "Water pipeline leaking at Nehru Colony junction",
      description:
        "Clean water has been running down the road for two days. The road surface is starting to sink near the leak.",
      category: "WATER_LEAKAGE",
      severity: "HIGH",
      status: "ASSIGNED",
      lat: 28.6188,
      lng: 77.2071,
      address: "Nehru Colony Junction, New Delhi",
      ward: "W7",
      dept: "water",
      createdHoursAgo: 48,
      reporter: "citizen",
      upvoters: ["priya"],
      photos: [photo("civicfix-water-a")],
    },
    {
      key: "acknowledged",
      title: "Blocked storm drain floods the lane after rain",
      description:
        "The drain cover is choked with silt and plastic. Even ten minutes of rain leaves knee-deep water for hours.",
      category: "DRAINAGE",
      severity: "MEDIUM",
      status: "ACKNOWLEDGED",
      lat: 28.6094,
      lng: 77.2158,
      address: "Rajendra Park Lane 3, New Delhi",
      ward: "W3",
      dept: "water",
      createdHoursAgo: 72,
      reporter: "aisha",
      upvoters: ["citizen", "rahul"],
      photos: [photo("civicfix-drain-a")],
    },
    {
      key: "in-progress",
      title: "Road surface broken outside the community hall",
      description:
        "Tar has peeled away over a ten metre stretch, exposing loose gravel that keeps causing skids.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "IN_PROGRESS",
      lat: 28.6121,
      lng: 77.2201,
      address: "Community Hall Road, Model Town, New Delhi",
      ward: "W21",
      dept: "roads",
      createdHoursAgo: 96,
      reporter: "citizen",
      upvoters: ["priya", "rahul", "aisha"],
      photos: [
        photo("civicfix-road-a"),
        photo("civicfix-road-b"),
        photo("civicfix-road-c"),
      ],
    },
    {
      key: "emergency",
      title: "EMERGENCY: Open manhole with no cover near bus stop",
      description:
        "The manhole cover is completely missing right where people queue for the bus. Someone will fall in after dark.",
      category: "DRAINAGE",
      severity: "CRITICAL",
      status: "IN_PROGRESS",
      lat: 28.6255,
      lng: 77.2189,
      address: "Model Town Bus Stop, New Delhi",
      ward: "W21",
      dept: "water",
      createdHoursAgo: 5,
      isEmergency: true,
      reporter: "priya",
      upvoters: ["citizen", "rahul", "aisha"],
      photos: [photo("civicfix-manhole-a")],
    },
    {
      key: "resolved-awaiting",
      title: "Cracked footpath slabs near the vegetable market",
      description:
        "Loose slabs tilt when stepped on. An elderly neighbour tripped there last week.",
      category: "ROAD_DAMAGE",
      severity: "MEDIUM",
      status: "RESOLVED",
      lat: 28.6148,
      lng: 77.2098,
      address: "Vegetable Market Lane, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "roads",
      createdHoursAgo: 120,
      reporter: "citizen",
      upvoters: ["priya"],
      photos: [photo("civicfix-footpath-a")],
    },
    {
      key: "resolved-awaiting-2",
      title: "Streetlight flickering all night on Park Road",
      description:
        "The lamp switches on and off every few seconds. It is more disorienting than having no light at all.",
      category: "STREETLIGHT",
      severity: "LOW",
      status: "RESOLVED",
      lat: 28.6081,
      lng: 77.2132,
      address: "Park Road, Rajendra Park, New Delhi",
      ward: "W3",
      dept: "electrical",
      createdHoursAgo: 140,
      reporter: "rahul",
      photos: [photo("civicfix-lamp-a")],
    },
    {
      key: "closed-1",
      title: "Uncollected construction debris blocking half the road",
      description:
        "A pile of rubble from a private build has been sitting on the public road for two weeks.",
      category: "GARBAGE",
      severity: "MEDIUM",
      status: "CLOSED",
      lat: 28.6175,
      lng: 77.2035,
      address: "Nehru Colony Main Road, New Delhi",
      ward: "W7",
      dept: "sanitation",
      createdHoursAgo: 300,
      reporter: "priya",
      upvoters: ["citizen", "rahul"],
      photos: [photo("civicfix-debris-a")],
    },
    {
      key: "closed-2",
      title: "Broken drain cover outside the clinic",
      description:
        "The concrete cover had cracked through and shifted whenever a vehicle passed over it.",
      category: "DRAINAGE",
      severity: "HIGH",
      status: "CLOSED",
      lat: 28.6112,
      lng: 77.2167,
      address: "Clinic Road, Rajendra Park, New Delhi",
      ward: "W3",
      dept: "water",
      createdHoursAgo: 420,
      reporter: "citizen",
      upvoters: ["aisha"],
      photos: [photo("civicfix-cover-a")],
    },
    {
      key: "sla-breached",
      title: "Sewage backing up into the street near Block C",
      description:
        "Raw sewage has been surfacing for over a week. The smell reaches the houses on both sides.",
      category: "DRAINAGE",
      severity: "CRITICAL",
      status: "SLA_BREACHED",
      lat: 28.6221,
      lng: 77.2112,
      address: "Block C, Nehru Colony, New Delhi",
      ward: "W7",
      dept: "water",
      createdHoursAgo: 200,
      reporter: "aisha",
      upvoters: ["citizen", "priya", "rahul"],
      photos: [photo("civicfix-sewage-a")],
    },
    {
      key: "escalated",
      title: "Major road cave-in near the flyover ramp",
      description:
        "A section of the carriageway has sunk by nearly a foot. Heavy vehicles are being diverted informally.",
      category: "ROAD_DAMAGE",
      severity: "CRITICAL",
      status: "ESCALATED",
      lat: 28.6268,
      lng: 77.2064,
      address: "Flyover Ramp, Model Town, New Delhi",
      ward: "W21",
      dept: "roads",
      createdHoursAgo: 260,
      reporter: "rahul",
      upvoters: ["citizen", "priya", "aisha"],
      photos: [photo("civicfix-cavein-a")],
    },
    {
      key: "chronic",
      title: "Same pothole keeps reopening on Station Road",
      description:
        "Patched twice in three months and it breaks apart again within weeks. The base needs proper work, not more tar.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "REOPENED",
      lat: 28.6198,
      lng: 77.2229,
      address: "Station Road, Model Town, New Delhi",
      ward: "W21",
      dept: "roads",
      createdHoursAgo: 500,
      reopenCount: 3,
      reporter: "citizen",
      extraReporters: ["priya"],
      upvoters: ["rahul", "aisha"],
      photos: [photo("civicfix-chronic-a")],
    },
    {
      key: "duplicate",
      title: "Potholes at Gandhi Market (duplicate report)",
      description:
        "Reported separately before I saw the existing report for the same stretch of road.",
      category: "ROAD_DAMAGE",
      severity: "MEDIUM",
      status: "DUPLICATE",
      lat: 28.6141,
      lng: 77.2092,
      address: "Gandhi Market Road, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "roads",
      createdHoursAgo: 10,
      reporter: "aisha",
      photos: [photo("civicfix-dup-a")],
    },
    {
      key: "anon",
      title: "Overflowing bin at the park entrance",
      description:
        "Reported anonymously while walking past. Bin has clearly not been emptied in days.",
      category: "GARBAGE",
      severity: "LOW",
      status: "REPORTED",
      lat: 28.6103,
      lng: 77.2211,
      address: "Central Park Gate, Model Town, New Delhi",
      ward: "W21",
      dept: "sanitation",
      createdHoursAgo: 14,
      reporter: "anonymous",
      upvoters: ["citizen"],
      photos: [photo("civicfix-park-bin")],
    },
  ];

  const created: Record<string, any> = {};

  for (const s of seedIssues) {
    const issue = await prisma.issue.create({
      data: {
        title: s.title,
        description: s.description,
        category: s.category,
        severity: s.severity,
        status: s.status,
        isEmergency: s.isEmergency ?? false,
        reopenCount: s.reopenCount ?? 0,
        latitude: s.lat,
        longitude: s.lng,
        address: s.address,
        aiConfidence: 0.72 + Math.random() * 0.26,
        wardId: wardMap[s.ward],
        departmentId: deptMap[s.dept],
        createdAt: hoursAgo(s.createdHoursAgo),
      },
    });

    created[s.key] = issue;

    // Primary complaint
    await prisma.complaint.create({
      data: {
        citizenId:
          s.reporter === "anonymous"
            ? null
            : userMap[s.reporter],
        issueId: issue.id,
        imageUrl: s.photos[0],
        photos: s.photos,
        audioUrl: s.audio
          ? "https://cdn.jsdelivr.net/gh/anars/blank-audio/2-seconds-of-silence.mp3"
          : null,
        description: s.description,
        latitude: s.lat,
        longitude: s.lng,
        createdAt: hoursAgo(s.createdHoursAgo),
      },
    });

    // Additional reports of the same issue
    for (const extra of s.extraReporters ?? []) {
      await prisma.complaint.create({
        data: {
          citizenId: userMap[extra],
          issueId: issue.id,
          imageUrl: photo(`${s.key}-extra-${extra}`),
          photos: [photo(`${s.key}-extra-${extra}`)],
          description:
            "Reporting the same problem from the other side of the road.",
          latitude: s.lat + 0.0004,
          longitude: s.lng + 0.0004,
          createdAt: hoursAgo(
            Math.max(1, s.createdHoursAgo - 2)
          ),
        },
      });
    }

    // Upvotes
    for (const up of s.upvoters ?? []) {
      await prisma.upvote.create({
        data: {
          userId: userMap[up],
          issueId: issue.id,
          createdAt: hoursAgo(
            Math.max(1, s.createdHoursAgo - 1)
          ),
        },
      });
    }

    // Opening history entry
    await prisma.statusHistory.create({
      data: {
        issueId: issue.id,
        changedBy:
          s.reporter === "anonymous"
            ? null
            : userMap[s.reporter],
        status: "REPORTED",
        note: "Issue reported by a citizen",
        createdAt: hoursAgo(s.createdHoursAgo),
      },
    });
  }

  console.log("Seeding assignments and workflow history...");

  async function assign(
    issue: any,
    officerUser: any,
    deptId: string,
    wardId: string,
    opts: {
      assignedHoursAgo: number;
      acceptedHoursAgo?: number;
      completedHoursAgo?: number;
    }
  ) {
    return prisma.assignment.create({
      data: {
        issueId: issue.id,
        authorityId: officerUser.id,
        departmentId: deptId,
        wardId,
        assignedAt: hoursAgo(opts.assignedHoursAgo),
        acceptedAt: opts.acceptedHoursAgo
          ? hoursAgo(opts.acceptedHoursAgo)
          : null,
        completedAt: opts.completedHoursAgo
          ? hoursAgo(opts.completedHoursAgo)
          : null,
      },
    });
  }

  async function history(
    issue: any,
    status: any,
    note: string,
    hrs: number,
    by?: string,
    imageUrl?: string
  ) {
    return prisma.statusHistory.create({
      data: {
        issueId: issue.id,
        changedBy: by ?? null,
        status,
        note,
        imageUrl,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  // ASSIGNED (waiting for the officer to accept)
  await assign(
    created["assigned"],
    officer2,
    water.id,
    ward7.id,
    { assignedHoursAgo: 20 }
  );
  await history(
    created["assigned"],
    "ASSIGNED",
    "Assigned to Meera Joshi (Water & Drainage)",
    20,
    admin.id
  );

  // ACKNOWLEDGED
  await assign(
    created["acknowledged"],
    officer,
    water.id,
    ward3.id,
    { assignedHoursAgo: 50, acceptedHoursAgo: 44 }
  );
  await history(
    created["acknowledged"],
    "ASSIGNED",
    "Assigned to Sunil Kumar",
    50,
    admin.id
  );
  await history(
    created["acknowledged"],
    "ACKNOWLEDGED",
    "Authority accepted the assignment",
    44,
    officer.id
  );

  // IN_PROGRESS with progress updates
  const inProg = await assign(
    created["in-progress"],
    officer,
    roads.id,
    ward21.id,
    { assignedHoursAgo: 80, acceptedHoursAgo: 74 }
  );
  await history(
    created["in-progress"],
    "ASSIGNED",
    "Assigned to Sunil Kumar",
    80,
    admin.id
  );
  await history(
    created["in-progress"],
    "ACKNOWLEDGED",
    "Authority accepted the assignment",
    74,
    officer.id
  );
  await history(
    created["in-progress"],
    "IN_PROGRESS",
    "Authority started working on the issue",
    50,
    officer.id
  );
  await history(
    created["in-progress"],
    "IN_PROGRESS",
    "Site inspected and measured. Material ordered, patching begins tomorrow morning.",
    26,
    officer.id,
    photo("civicfix-progress-1")
  );
  await history(
    created["in-progress"],
    "IN_PROGRESS",
    "Base layer laid. Final surfacing scheduled for this evening.",
    4,
    officer.id,
    photo("civicfix-progress-2")
  );

  // EMERGENCY in progress, SLA about to breach (tests the urgent countdown chip)
  await assign(
    created["emergency"],
    officer2,
    water.id,
    ward21.id,
    { assignedHoursAgo: 4, acceptedHoursAgo: 3 }
  );
  await history(
    created["emergency"],
    "ASSIGNED",
    "Emergency assigned to Meera Joshi",
    4,
    admin.id
  );
  await history(
    created["emergency"],
    "ACKNOWLEDGED",
    "Authority accepted the emergency assignment",
    3,
    officer2.id
  );
  await history(
    created["emergency"],
    "IN_PROGRESS",
    "Barricades placed around the open manhole. Replacement cover being sourced.",
    2,
    officer2.id,
    photo("civicfix-progress-3")
  );

  // RESOLVED awaiting citizen verification (with proof photos)
  for (const [key, off, deptId, wardId, hrs] of [
    ["resolved-awaiting", officer, roads.id, ward12.id, 110],
    ["resolved-awaiting-2", officer, electrical.id, ward3.id, 130],
  ] as const) {
    await assign(created[key], off, deptId, wardId, {
      assignedHoursAgo: hrs,
      acceptedHoursAgo: hrs - 6,
      completedHoursAgo: 8,
    });
    await history(
      created[key],
      "ASSIGNED",
      "Assigned to Sunil Kumar",
      hrs,
      admin.id
    );
    await history(
      created[key],
      "ACKNOWLEDGED",
      "Authority accepted the assignment",
      hrs - 6,
      off.id
    );
    await history(
      created[key],
      "IN_PROGRESS",
      "Authority started working on the issue",
      hrs - 20,
      off.id
    );
    await history(
      created[key],
      "RESOLVED",
      "Work completed. Please verify the fix.",
      8,
      off.id
    );

    await prisma.issue.update({
      where: { id: created[key].id },
      data: {
        resolutionImageUrl: photo(`${key}-proof`),
      },
    });
  }

  // CLOSED (verified by citizens with star ratings)
  const closedSpecs = [
    {
      key: "closed-1",
      off: officer,
      dept: sanitation.id,
      ward: ward7.id,
      hrs: 280,
      verifier: priya,
      stars: 5,
      comment: "Cleared the very next morning. Excellent response.",
    },
    {
      key: "closed-2",
      off: officer2,
      dept: water.id,
      ward: ward3.id,
      hrs: 400,
      verifier: citizen,
      stars: 4,
      comment: "New cover fitted properly. Took a few days but solid work.",
    },
  ];

  for (const c of closedSpecs) {
    await assign(
      created[c.key],
      c.off,
      c.dept,
      c.ward,
      {
        assignedHoursAgo: c.hrs,
        acceptedHoursAgo: c.hrs - 5,
        completedHoursAgo: c.hrs - 60,
      }
    );
    await history(
      created[c.key],
      "ASSIGNED",
      "Assigned by admin",
      c.hrs,
      admin.id
    );
    await history(
      created[c.key],
      "ACKNOWLEDGED",
      "Authority accepted the assignment",
      c.hrs - 5,
      c.off.id
    );
    await history(
      created[c.key],
      "IN_PROGRESS",
      "Work started on site",
      c.hrs - 30,
      c.off.id
    );
    await history(
      created[c.key],
      "RESOLVED",
      "Work completed with photo proof",
      c.hrs - 60,
      c.off.id
    );
    await history(
      created[c.key],
      "CLOSED",
      "Citizen verified the resolution",
      c.hrs - 55,
      c.verifier.id
    );

    await prisma.issue.update({
      where: { id: created[c.key].id },
      data: {
        resolutionImageUrl: photo(`${c.key}-proof`),
      },
    });

    await prisma.resolutionVerification.create({
      data: {
        issueId: created[c.key].id,
        citizenId: c.verifier.id,
        verified: true,
        stars: c.stars,
        comment: c.comment,
        createdAt: hoursAgo(c.hrs - 55),
      },
    });
  }

  // SLA_BREACHED
  await assign(
    created["sla-breached"],
    officer2,
    water.id,
    ward7.id,
    { assignedHoursAgo: 180, acceptedHoursAgo: 170 }
  );
  await history(
    created["sla-breached"],
    "ASSIGNED",
    "Assigned to Meera Joshi",
    180,
    admin.id
  );
  await history(
    created["sla-breached"],
    "ACKNOWLEDGED",
    "Authority accepted the assignment",
    170,
    officer2.id
  );
  await history(
    created["sla-breached"],
    "SLA_BREACHED",
    "Issue exceeded its SLA deadline",
    24,
    undefined
  );

  // ESCALATED with escalation records
  await assign(
    created["escalated"],
    officer,
    roads.id,
    ward21.id,
    { assignedHoursAgo: 240, acceptedHoursAgo: 230 }
  );
  await history(
    created["escalated"],
    "ASSIGNED",
    "Assigned to Sunil Kumar",
    240,
    admin.id
  );
  await history(
    created["escalated"],
    "SLA_BREACHED",
    "Issue exceeded its SLA deadline",
    60,
    undefined
  );
  await history(
    created["escalated"],
    "ESCALATED",
    "Issue escalated to level 2 after SLA breach",
    48,
    undefined
  );
  await prisma.escalation.createMany({
    data: [
      {
        issueId: created["escalated"].id,
        level: 1,
        reason:
          "SLA deadline exceeded - automatically escalated to level 1",
        escalatedAt: hoursAgo(58),
      },
      {
        issueId: created["escalated"].id,
        level: 2,
        reason:
          "Still unresolved after level 1 escalation",
        escalatedAt: hoursAgo(48),
      },
    ],
  });

  // CHRONIC (reopened repeatedly)
  await assign(
    created["chronic"],
    officer,
    roads.id,
    ward21.id,
    { assignedHoursAgo: 460, acceptedHoursAgo: 450 }
  );
  await history(
    created["chronic"],
    "RESOLVED",
    "Pothole patched with cold mix",
    380,
    officer.id
  );
  await history(
    created["chronic"],
    "REOPENED",
    "Citizen rejected the resolution: patch broke apart within two weeks",
    300,
    citizen.id
  );
  await history(
    created["chronic"],
    "RESOLVED",
    "Repatched with hot mix",
    200,
    officer.id
  );
  await history(
    created["chronic"],
    "REOPENED",
    "Citizen rejected the resolution: cracked again after the rain",
    120,
    citizen.id
  );
  await history(
    created["chronic"],
    "REOPENED",
    "Third failure - the road base itself needs rebuilding",
    40,
    priya.id
  );
  await prisma.escalation.create({
    data: {
      issueId: created["chronic"].id,
      level: 2,
      reason:
        "Repeated failures - requires base reconstruction, not surface patching",
      escalatedAt: hoursAgo(38),
    },
  });

  // DUPLICATE pointing at the original pothole report
  await history(
    created["duplicate"],
    "DUPLICATE",
    `Marked as duplicate of "${created["reported-pothole"].title}"`,
    4,
    admin.id
  );

  console.log("Seeding SLAs...");

  const slaSpecs: Array<[string, number, number, boolean]> =
    [
      // key, durationMin, deadlineHoursFromNow (negative = past), breached
      ["reported-pothole", 2880, 42, false],
      ["assigned", 1440, 12, false],
      ["acknowledged", 2880, 20, false],
      ["in-progress", 4320, 6, false],
      ["emergency", 240, 2, false],
      ["resolved-awaiting", 4320, 30, false],
      ["sla-breached", 2880, -24, true],
      ["escalated", 2880, -60, true],
      ["chronic", 4320, -30, true],
    ];

  for (const [key, duration, deadlineHrs, breached] of slaSpecs) {
    await prisma.sLA.create({
      data: {
        issueId: created[key].id,
        durationMin: duration,
        deadline:
          deadlineHrs >= 0
            ? hoursAhead(deadlineHrs)
            : hoursAgo(-deadlineHrs),
        breached,
        breachedAt: breached
          ? hoursAgo(-deadlineHrs)
          : null,
      },
    });
  }

  console.log("Seeding comments, messages and notifications...");

  const commentSpecs: Array<[string, string, string, number]> =
    [
      [
        "reported-pothole",
        priya.id,
        "This is exactly where my scooter skidded last Tuesday. Adding my upvote.",
        5,
      ],
      [
        "reported-pothole",
        rahul.id,
        "It gets much worse after rain because the whole stretch holds water.",
        4,
      ],
      [
        "reported-pothole",
        officer.id,
        "Noted. The road team will inspect this stretch within 48 hours.",
        2,
      ],
      [
        "in-progress",
        citizen.id,
        "Thanks for the update. Any idea if the lane will be closed during work?",
        20,
      ],
      [
        "in-progress",
        officer.id,
        "Only half the carriageway will be closed. Access to the hall stays open.",
        18,
      ],
      [
        "emergency",
        aisha.id,
        "Barricades are up as of this evening. Thank you for the fast response.",
        1,
      ],
      [
        "sla-breached",
        priya.id,
        "It has been over a week now. Can someone from the department respond here?",
        30,
      ],
      [
        "chronic",
        rahul.id,
        "Third time this year. Patching clearly is not working on this stretch.",
        35,
      ],
    ];

  for (const [key, userId, text, hrs] of commentSpecs) {
    await prisma.comment.create({
      data: {
        issueId: created[key].id,
        userId,
        text,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  const messageSpecs: Array<[string, string, string, number]> =
    [
      [
        "in-progress",
        officer.id,
        "Hello, I am the engineer assigned to your report. Could you confirm whether the damage extends past the hall gate?",
        30,
      ],
      [
        "in-progress",
        citizen.id,
        "Yes, it continues about five metres past the gate towards the water tank.",
        28,
      ],
      [
        "in-progress",
        officer.id,
        "Understood, I have extended the work order to cover that stretch. Thank you.",
        27,
      ],
      [
        "resolved-awaiting",
        officer.id,
        "The slabs have been relaid. Please have a look and verify when you can.",
        7,
      ],
    ];

  for (const [key, senderId, text, hrs] of messageSpecs) {
    await prisma.message.create({
      data: {
        issueId: created[key].id,
        senderId,
        text,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  const notificationSpecs: Array<
    [string, string, string, boolean, number]
  > = [
    [
      citizen.id,
      "Issue Resolved",
      'Your civic issue "Cracked footpath slabs near the vegetable market" has been marked as resolved. Please verify whether the issue has actually been fixed.',
      false,
      8,
    ],
    [
      citizen.id,
      "New Message",
      'Sunil Kumar sent a message on "Road surface broken outside the community hall".',
      false,
      27,
    ],
    [
      citizen.id,
      "Progress Update",
      'Update on "Road surface broken outside the community hall": Base layer laid. Final surfacing scheduled for this evening.',
      false,
      4,
    ],
    [
      citizen.id,
      "Work Started",
      'Work has started on your civic issue "Road surface broken outside the community hall".',
      true,
      50,
    ],
    [
      officer.id,
      "New Issue Assigned",
      'A new civic issue "Deep pothole cluster near Gandhi Market crossing" needs your attention.',
      false,
      6,
    ],
    [
      officer.id,
      "Assigned Issue Escalated",
      'Your assigned issue "Major road cave-in near the flyover ramp" breached its SLA and has been escalated to level 2.',
      false,
      48,
    ],
    [
      officer2.id,
      "New Issue Assigned",
      'A new civic issue "Water pipeline leaking at Nehru Colony junction" has been assigned to you.',
      false,
      20,
    ],
    [
      admin.id,
      "EMERGENCY REPORT",
      'An emergency civic issue was just reported: "EMERGENCY: Open manhole with no cover near bus stop" near Model Town Bus Stop. It needs immediate attention.',
      false,
      5,
    ],
    [
      admin.id,
      "Chronic Issue Detected",
      '"Same pothole keeps reopening on Station Road" has been reopened 3 times. The fixes are not holding.',
      false,
      40,
    ],
    [
      admin.id,
      "Issue Escalated",
      '"Major road cave-in near the flyover ramp" breached its SLA and was automatically escalated to level 2.',
      true,
      48,
    ],
  ];

  for (const [
    userId,
    title,
    message,
    isRead,
    hrs,
  ] of notificationSpecs) {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    issues: await prisma.issue.count(),
    complaints: await prisma.complaint.count(),
    assignments: await prisma.assignment.count(),
    upvotes: await prisma.upvote.count(),
    comments: await prisma.comment.count(),
    messages: await prisma.message.count(),
    notifications: await prisma.notification.count(),
    slas: await prisma.sLA.count(),
    history: await prisma.statusHistory.count(),
  };

  console.log("\nSeed complete:", counts);
  console.log(`
=========================================================
  MOCK LOGIN CREDENTIALS
=========================================================
  CITIZEN    citizen@civicfix.test    ${PASSWORDS.citizen}
             priya@civicfix.test      ${PASSWORDS.citizen}
             rahul@civicfix.test      ${PASSWORDS.citizen}
             aisha@civicfix.test      ${PASSWORDS.citizen}

  AUTHORITY  authority@civicfix.test  ${PASSWORDS.authority}
             engineer@civicfix.test   ${PASSWORDS.authority}

  ADMIN      admin@civicfix.test      ${PASSWORDS.admin}
=========================================================
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
