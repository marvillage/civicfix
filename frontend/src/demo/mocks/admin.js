// Demo-mode responses for admin endpoints that have no recorded
// fixture (or need logic, e.g. mutations that return updated data).
// Return [status, data] to answer, or null to fall through.
//
// Covers: GET /admin/access-matrix, GET /admin/audit-events,
// GET|PUT /budgets, GET /pulse/budget. Everything is deterministic
// (seeded from names and months), so screenshots are stable.

import fixtures from "../fixtures.json";

// ── Permission matrix ───────────────────────────────────────
// Mirror of backend/src/auth/permissions.ts (Fixity v2).

const ROLES = ["CITIZEN", "AUTHORITY", "ADMIN"];
const ALL = ROLES;
const STAFF = ["AUTHORITY", "ADMIN"];
const ADMIN = ["ADMIN"];
const CITIZEN = ["CITIZEN"];

const PERMISSIONS = [
  ["issue:report", "Cases", "File a report with photos, voice note and location", CITIZEN],
  ["issue:upvote", "Cases", "Back an issue and follow its updates", ALL],
  ["issue:comment", "Cases", "Post in the public Street Talk thread", ALL],
  ["issue:message", "Cases", "Use the private Direct Line on cases you are part of", ALL],
  ["complaint:read:own", "Cases", "See your own cases and their timelines", CITIZEN],
  ["complaint:verify", "Cases", "Sign off (or reopen) a fix on your own case", CITIZEN],
  ["issue:read:all", "Cases", "See every case, including internal fields", ADMIN],
  ["issue:status", "Cases", "Change a case's status with a note", STAFF],
  ["issue:assign", "Cases", "Assign or reassign a case to an officer", ADMIN],
  ["issue:duplicate", "Cases", "Merge a duplicate case into the original", ADMIN],

  ["assignment:work", "Field work", "Accept, start, update and resolve your assigned jobs", STAFF],
  ["assignment:dispatch", "Field work", "Hand a case to an officer, or pass your job on to a colleague", STAFF],
  ["assignment:read:all", "Field work", "See every assignment across departments", ADMIN],
  ["field:report", "Field work", "Log a Patrol Log report spotted on rounds", STAFF],
  ["performance:read:own", "Field work", "See your own officer scorecard", STAFF],

  ["cost:read", "Cost Ledger", "See work costs on cases in your scope", STAFF],
  ["cost:log", "Cost Ledger", "Log material, labour and contractor costs on your jobs", STAFF],
  ["budget:read", "Cost Ledger", "See department budgets and spend (officers: own department)", STAFF],
  ["budget:manage", "Cost Ledger", "Set monthly department budgets", ADMIN],

  ["bulletin:publish", "Community", "Publish Ward Bulletins (officers: for their own department)", STAFF],
  ["bulletin:manage", "Community", "Pin or remove any bulletin", ADMIN],
  ["watchzone:manage", "Community", "Create Watch Zones and get alerts for new cases inside them", ALL],
  ["poll:vote", "Community", "Vote once in each open Ward Vote", CITIZEN],
  ["poll:results", "Community", "See live Ward Vote results before voting or closing", STAFF],
  ["poll:manage", "Community", "Open and close Ward Votes", ADMIN],
  ["drive:propose", "Community", "Propose a Cleanup Drive", CITIZEN],
  ["drive:join", "Community", "RSVP to approved Cleanup Drives", CITIZEN],
  ["drive:moderate", "Community", "Approve or reject proposed Cleanup Drives", ADMIN],

  ["analytics:full", "Insight", "See the full City Pulse, including spend against budget", STAFF],
  ["export:csv", "Insight", "Download every case as CSV", ADMIN],
  ["audit:read", "Insight", "Read the Paper Trail of status changes and admin actions", ADMIN],

  ["sla:manage", "Administration", "Set Fix Clock deadlines and run breach checks", ADMIN],
  ["org:manage", "Administration", "Manage departments, wards and routing rules", ADMIN],
  ["org:read", "Administration", "See departments, wards and officers", STAFF],
  ["user:manage", "Administration", "Change roles, approve staff and provision officer accounts", ADMIN],
  ["rbac:read", "Administration", "View the Access Control matrix", ADMIN],
];

function accessMatrix() {
  return {
    roles: [...ROLES],
    permissions: PERMISSIONS.map(([key, group, description, roles]) => ({
      key,
      group,
      description,
      roles: [...roles],
    })),
  };
}

// ── Helpers ─────────────────────────────────────────────────

const adminData = fixtures.responses?.ADMIN ?? {};

function departments() {
  return (adminData["GET /organization/departments"]?.data?.departments ?? []).map(
    ({ id, name }) => ({ id, name })
  );
}

// Small stable hash → [0, 1)
function seeded(text) {
  let h = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return ((h >>> 0) % 10000) / 10000;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(key, delta) {
  const [year, month] = key.split("-").map(Number);

  return monthKey(new Date(year, month - 1 + delta, 1));
}

function monthDiff(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);

  return (ya - yb) * 12 + (ma - mb);
}

function forbidden() {
  return [403, { message: "You don't have permission to do that." }];
}

// ── Budgets ─────────────────────────────────────────────────
// Base monthly budget by department, in whole rupees.

const BASE_BUDGET = [
  [/road/i, 1800000],
  [/water|drain/i, 1250000],
  [/sanit|waste|garbage/i, 900000],
  [/electr|light/i, 650000],
];

// This month's burn, so the demo shows every meter state.
const CURRENT_BURN = [
  [/road/i, 0.88],
  [/water|drain/i, 1.06],
  [/sanit|waste|garbage/i, 0.64],
  [/electr|light/i, 0.41],
];

const budgetOverrides = new Map(); // "deptId|YYYY-MM" → amount

function match(table, name, fallback) {
  return table.find(([pattern]) => pattern.test(name))?.[1] ?? fallback;
}

function budgetFor(department, month, current) {
  const key = `${department.id}|${month}`;

  if (budgetOverrides.has(key)) return budgetOverrides.get(key);

  const age = monthDiff(current, month); // 0 = this month, >0 = past

  if (age < 0) return null; // next month isn't planned yet

  const base = match(BASE_BUDGET, department.name, 750000);

  // A mid-year revision: older months ran on a smaller budget.
  return age >= 3 ? Math.round((base * 0.92) / 1000) * 1000 : base;
}

function spendFor(department, month, current) {
  const age = monthDiff(current, month);

  if (age < 0) return { spent: 0, issues: 0 };

  const base = match(BASE_BUDGET, department.name, 750000);
  const ratio =
    age === 0
      ? match(CURRENT_BURN, department.name, 0.7)
      : 0.66 + seeded(`${department.name}|${month}`) * 0.44;

  return {
    spent: Math.round((base * ratio) / 100) * 100,
    issues: 3 + Math.floor(seeded(`${month}|${department.name}|n`) * 12),
  };
}

function visibleDepartments(ctx) {
  if (ctx.role === "ADMIN") return departments();

  const own = ctx.account?.department;

  return own?.id ? [{ id: own.id, name: own.name }] : [];
}

function getBudgets(ctx) {
  const current = monthKey(ctx.now);
  const month = /^\d{4}-\d{2}$/.test(ctx.params?.month ?? "") ? ctx.params.month : current;

  return {
    month,
    departments: visibleDepartments(ctx).map((department) => ({
      department,
      budget: budgetFor(department, month, current),
      ...spendFor(department, month, current),
    })),
  };
}

function putBudget(ctx) {
  const { departmentId, month, amount } = ctx.body ?? {};
  const department = departments().find((item) => item.id === departmentId);

  if (!department) return [404, { message: "Department not found" }];
  if (!/^\d{4}-\d{2}$/.test(month ?? "")) {
    return [400, { message: "month must look like YYYY-MM" }];
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000) {
    return [400, { message: "amount must be whole rupees between 0 and ₹1,00,00,00,000" }];
  }

  budgetOverrides.set(`${departmentId}|${month}`, amount);

  return [
    200,
    {
      budget: {
        id: `demo-budget-${departmentId.slice(-6)}-${month}`,
        departmentId,
        month,
        amount,
      },
    },
  ];
}

function budgetPulse(ctx) {
  const current = monthKey(ctx.now);
  const count = Math.min(12, Math.max(3, Number(ctx.params?.months) || 6));
  const months = Array.from({ length: count }, (_, i) =>
    shiftMonth(current, i - (count - 1))
  );

  return {
    months,
    departments: departments().map((department) => ({
      id: department.id,
      name: department.name,
      series: months.map((month) => ({
        month,
        budget: budgetFor(department, month, current),
        spent: spendFor(department, month, current).spent,
      })),
    })),
  };
}

// ── Audit events ────────────────────────────────────────────

function actorRef(role) {
  const account = fixtures.accounts?.[role];

  return account ? { id: account.id, name: account.name, role: account.role } : null;
}

function idsFrom(key, field = "issues") {
  return (adminData[key]?.data?.[field] ?? []).map((item) => item.id);
}

function buildEvents(now) {
  const admin = actorRef("ADMIN");
  const officer = actorRef("AUTHORITY");
  const depts = departments();
  const dept = (pattern) => depts.find((d) => pattern.test(d.name)) ?? depts[0] ?? { id: "dept", name: "Roads & Infrastructure" };
  const issues = idsFrom("GET /issues/admin/all?limit=500&view=open");
  const issue = (i) => issues[i % Math.max(1, issues.length)] ?? `issue-${i}`;
  const users = adminData["GET /users"]?.data?.users ?? [];
  const user = (pattern) => users.find((u) => pattern.test(u.name)) ?? users[0] ?? { id: "user", email: "user@example.test" };
  const wards = adminData["GET /organization/wards"]?.data?.wards ?? [];
  const current = monthKey(now);
  const hours = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString();
  const roads = dept(/road/i);
  const water = dept(/water/i);
  const sanitation = dept(/sanit/i);
  const electrical = dept(/electr/i);
  const meera = user(/meera/i);

  const rows = [
    [2, admin, "budget.set", "DepartmentBudget", `b-${roads.id}`, { departmentId: roads.id, department: roads.name, month: current, amount: 1800000, previous: 1650000 }],
    [5, admin, "user.verify", "User", meera.id, { verified: true }],
    [6.5, admin, "sla.set", "SLA", `sla-${issue(1)}`, { issueId: issue(1), durationMin: 2880, deadline: hours(-41.5) }],
    [9, officer, "bulletin.publish", "Bulletin", "bulletin-night-resurfacing", { title: "Night resurfacing on Station Road", kind: "ROADWORKS", wardId: wards[1]?.id ?? null, departmentId: roads.id, pinned: false }],
    [12, admin, "issue.duplicate", "Issue", issue(2), { originalId: issue(4) }],
    [26, admin, "org.rule.set", "CategoryRule", "rule-drainage", { category: "DRAINAGE", departmentId: water.id }],
    [29, admin, "drive.moderate", "Drive", "drive-ghat", { decision: "APPROVE", note: null, title: "Yamuna ghat clean-up" }],
    [33, admin, "poll.create", "Poll", "poll-resurface", { question: "Which street should be resurfaced first?", wardId: wards[0]?.id ?? null, closesAt: hours(-24 * 6), options: 4 }],
    [49, admin, "user.role.change", "User", user(/rahul/i).id, { from: "CITIZEN", to: "AUTHORITY" }],
    [53, officer, "cost.delete", "WorkCost", "cost-bitumen", { issueId: issue(8), kind: "MATERIAL", description: "Duplicate entry: bitumen, 2 drums", amount: 8400, loggedById: officer?.id ?? null }],
    [74, admin, "budget.set", "DepartmentBudget", `b-${water.id}`, { departmentId: water.id, department: water.name, month: current, amount: 1250000, previous: null }],
    [75, admin, "budget.set", "DepartmentBudget", `b-${sanitation.id}`, { departmentId: sanitation.id, department: sanitation.name, month: current, amount: 900000, previous: 850000 }],
    [76, admin, "budget.set", "DepartmentBudget", `b-${electrical.id}`, { departmentId: electrical.id, department: electrical.name, month: current, amount: 650000, previous: 650000 }],
    [98, admin, "user.authority.create", "User", meera.id, { email: meera.email ?? "engineer@example.test", employeeId: "MCD-2023-0088", departmentId: water.id }],
    [121, admin, "bulletin.delete", "Bulletin", "bulletin-water-cut", { title: "Water supply cut, Sector 4 (ended)", kind: "OUTAGE", authorId: officer?.id ?? null }],
    [146, admin, "poll.close", "Poll", "poll-parking", { question: "Weekend market parking plan", totalVotes: 214 }],
    [170, admin, "sla.set", "SLA", `sla-${issue(6)}`, { issueId: issue(6), durationMin: 1440, deadline: hours(146) }],
    [194, admin, "org.ward.create", "Ward", wards[3]?.id ?? "ward-rp", { name: wards[3]?.name ?? "Rajendra Park", code: wards[3]?.code ?? "W-03" }],
    [218, admin, "drive.moderate", "Drive", "drive-maidan", { decision: "REJECT", note: "Clashes with the Dussehra procession route", title: "Ramlila maidan sweep" }],
    [242, admin, "bulletin.publish", "Bulletin", "bulletin-boil", { title: "Boil water advisory, Nehru Colony", kind: "ADVISORY", wardId: wards[2]?.id ?? null, departmentId: water.id, pinned: true }],
    [266, admin, "issue.duplicate", "Issue", issue(11), { originalId: issue(5) }],
    [336, admin, "org.department.create", "Department", electrical.id, { name: electrical.name }],
    [360, admin, "user.verify", "User", user(/sunil/i).id, { verified: false }],
    [384, admin, "org.rule.set", "CategoryRule", "rule-garbage", { category: "GARBAGE", departmentId: sanitation.id }],
    [432, admin, "user.role.change", "User", user(/priya/i).id, { from: "AUTHORITY", to: "CITIZEN" }],
    [456, admin, "sla.set", "SLA", `sla-${issue(9)}`, { issueId: issue(9), durationMin: 4320, deadline: hours(384) }],
    [480, admin, "org.ward.create", "Ward", wards[0]?.id ?? "ward-gn", { name: wards[0]?.name ?? "Gandhi Nagar", code: wards[0]?.code ?? "W-12" }],
  ];

  return rows.map(([ago, actor, action, entityType, entityId, meta], index) => ({
    id: `demo-audit-${String(rows.length - index).padStart(3, "0")}`,
    action,
    entityType,
    entityId,
    meta,
    ip: `10.20.${4 + (index % 3)}.${11 + ((index * 7) % 40)}`,
    createdAt: hours(ago),
    actor,
  }));
}

function auditEvents(ctx) {
  const limit = Math.min(100, Math.max(1, Number(ctx.params?.limit) || 20));
  const prefix = ctx.params?.action ?? "";
  const all = buildEvents(ctx.now).filter((event) => event.action.startsWith(prefix));
  const start = ctx.params?.cursor
    ? all.findIndex((event) => event.id === ctx.params.cursor) + 1
    : 0;
  const page = all.slice(start, start + limit);
  const more = start + limit < all.length;

  return {
    events: page,
    nextCursor: more && page.length ? page[page.length - 1].id : null,
  };
}

// ── Router ──────────────────────────────────────────────────

export function handleAdmin(ctx) {
  const { role, method, path } = ctx;

  if (method === "GET" && path === "/admin/access-matrix") {
    return role === "ADMIN" ? [200, accessMatrix()] : forbidden();
  }

  if (method === "GET" && path === "/admin/audit-events") {
    return role === "ADMIN" ? [200, auditEvents(ctx)] : forbidden();
  }

  if (path === "/budgets") {
    if (method === "GET") {
      return role === "ADMIN" || role === "AUTHORITY" ? [200, getBudgets(ctx)] : forbidden();
    }

    if (method === "PUT") {
      return role === "ADMIN" ? putBudget(ctx) : forbidden();
    }
  }

  if (method === "GET" && path === "/pulse/budget") {
    return role === "ADMIN" || role === "AUTHORITY" ? [200, budgetPulse(ctx)] : forbidden();
  }

  return null;
}
