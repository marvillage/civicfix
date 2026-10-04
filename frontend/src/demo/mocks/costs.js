// Demo-mode responses for the Cost Ledger (CONTRACT-v2 § Cost Ledger).
// Return [status, data] to answer, or null to fall through.
//
// GET  /issues/:id/costs  → deterministic sample entries derived from the
//                           issue id (0–3 rows), plus anything logged this
//                           session, minus anything deleted.
// POST /issues/:id/costs  → echoes the new cost, loggedBy = the demo account.
// DELETE /costs/:id       → { message }.

const KINDS = ["MATERIAL", "LABOUR", "EQUIPMENT", "CONTRACTOR"];

const SAMPLES = {
  MATERIAL: {
    items: [
      "Bitumen cold mix, 12 bags",
      "Cement, sand and aggregate for slab bedding",
      "Cast-iron drain cover, 600 mm",
      "LED street fitting, 40 W, with driver",
      "PVC pipe and couplers, 6 m",
    ],
    min: 1800,
    max: 18000,
  },
  LABOUR: {
    items: [
      "Patching crew, 4 workers for a day",
      "Two electricians, night shift",
      "Desilting gang, half day",
      "Masons for slab relaying, 2 days",
    ],
    min: 2400,
    max: 12000,
  },
  EQUIPMENT: {
    items: [
      "Road roller hire, 4 hours",
      "Hydraulic ladder truck, 3 hours",
      "Suction pump hire, 1 day",
      "Mini excavator with operator, 5 hours",
    ],
    min: 3500,
    max: 15000,
  },
  CONTRACTOR: {
    items: [
      "Resurfacing by Shree Infra Works",
      "Pipe joint repair by Jal Seva Contractors",
      "Pole replacement by Prakash Electricals",
    ],
    min: 25000,
    max: 120000,
  },
};

const DAY_MS = 24 * 3_600_000;

// Session-only edits so a refresh of the ledger reflects them.
const added = new Map(); // issueId → WorkCost[]
const deleted = new Set(); // cost ids

let counter = 0;

// FNV-1a — small, stable string hash.
function hash(text) {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

function userRef(account) {
  if (!account) return null;

  return {
    id: account.id,
    name: account.name,
    avatarUrl: account.avatarUrl ?? null,
    role: account.role,
    designation: account.designation ?? null,
  };
}

const SAMPLE_OFFICER = {
  id: "demo-officer-sunil",
  name: "Sunil Kumar",
  avatarUrl: null,
  role: "AUTHORITY",
  designation: "Junior Engineer",
};

function sampleCosts(issueId, ctx) {
  const seed = hash(issueId);
  const count = seed % 4;
  const now = ctx.now instanceof Date ? ctx.now.getTime() : Date.now();
  const logger =
    ctx.role === "AUTHORITY" ? userRef(ctx.account) : SAMPLE_OFFICER;

  return Array.from({ length: count }, (_, index) => {
    const step = hash(`${issueId}:${index}`);
    const kind = KINDS[(seed + index) % KINDS.length];
    const sample = SAMPLES[kind];
    const raw = sample.min + (step % (sample.max - sample.min));
    const amount = Math.round(raw / 50) * 50;
    // Newest first; the first entry lands inside the 24 h delete window.
    const hoursAgo = 3 + index * 20 + (step % 5);

    return {
      id: `demo-cost-${issueId.slice(-6)}-${index}`,
      issueId,
      kind,
      description: sample.items[step % sample.items.length],
      amount,
      createdAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
      loggedBy: logger,
    };
  });
}

function canDo(ctx, permission) {
  return !!ctx.account?.permissions?.includes(permission);
}

function listCosts(issueId, ctx) {
  const costs = [...(added.get(issueId) ?? []), ...sampleCosts(issueId, ctx)]
    .filter((cost) => !deleted.has(cost.id))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  return {
    costs,
    total: costs.reduce((sum, cost) => sum + cost.amount, 0),
  };
}

function logCost(issueId, ctx) {
  const body = ctx.body ?? {};
  const kind = String(body.kind ?? "").toUpperCase();
  const description = String(body.description ?? "").trim();
  const amount = Number(body.amount);

  if (!KINDS.includes(kind)) {
    return [400, { message: "Pick what the money was for." }];
  }

  if (description.length < 3 || description.length > 200) {
    return [
      400,
      { message: "Describe the cost in 3 to 200 characters." },
    ];
  }

  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
    return [
      400,
      { message: "Amount must be whole rupees between ₹1 and ₹1,00,00,000." },
    ];
  }

  counter += 1;

  const cost = {
    id: `demo-cost-new-${Date.now().toString(36)}-${counter}`,
    issueId,
    kind,
    description,
    amount,
    createdAt: (ctx.now instanceof Date ? ctx.now : new Date()).toISOString(),
    loggedBy: userRef(ctx.account),
  };

  added.set(issueId, [cost, ...(added.get(issueId) ?? [])]);

  return [201, { cost }];
}

function deleteCost(costId, ctx) {
  const all = [...added.values()].flat();
  const mine = all.find((cost) => cost.id === costId);
  const isAdmin = canDo(ctx, "issue:read:all");

  if (mine && !isAdmin) {
    const age =
      Date.now() - new Date(mine.createdAt).getTime();

    if (mine.loggedBy?.id !== ctx.account?.id) {
      return [403, { message: "You can only remove costs you logged" }];
    }

    if (age > DAY_MS) {
      return [
        403,
        { message: "Costs can only be removed within 24 hours of logging" },
      ];
    }
  }

  deleted.add(costId);

  for (const [issueId, list] of added) {
    added.set(
      issueId,
      list.filter((cost) => cost.id !== costId)
    );
  }

  return [200, { message: "Cost entry removed. Demo mode — changes aren't saved." }];
}

export function handleCosts(ctx) {
  const { method, segments = [] } = ctx;

  // /issues/:id/costs
  if (
    segments.length === 3 &&
    segments[0] === "issues" &&
    segments[2] === "costs"
  ) {
    const issueId = segments[1];

    if (method === "GET") {
      if (!canDo(ctx, "cost:read")) {
        return [403, { message: "You don't have access to work costs" }];
      }

      return [200, listCosts(issueId, ctx)];
    }

    if (method === "POST") {
      if (!canDo(ctx, "cost:log")) {
        return [403, { message: "You can't log costs on this case" }];
      }

      return logCost(issueId, ctx);
    }

    return null;
  }

  // /costs/:id
  if (
    segments.length === 2 &&
    segments[0] === "costs" &&
    method === "DELETE"
  ) {
    if (!canDo(ctx, "cost:log")) {
      return [403, { message: "You can't remove work costs" }];
    }

    return deleteCost(segments[1], ctx);
  }

  return null;
}
