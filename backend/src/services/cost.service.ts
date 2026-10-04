import { prisma } from "../lib/prisma";
import { badRequest, forbidden, notFound } from "../lib/http";
import { can } from "../auth/permissions";
import { CostKind } from "../generated/prisma/client";
import { recordAudit } from "./audit.service";
import { clearPulseCache } from "./pulse.service";

// ─────────────────────────────────────────────
// COST LEDGER
// What each fix cost, logged by the officer doing the job.
//
// Scope (on top of the cost:read / cost:log route gates):
//   read   — citywide staff: any case; officers: cases they
//            are or were assigned to, or their department's
//   log    — citywide staff: any case; officers: only cases
//            where they hold the current assignment
//   delete — whoever logged it, within 24 h; citywide staff
//            any time
// ─────────────────────────────────────────────

export interface Actor {
  userId: string;
  role: string;
}

const DELETE_WINDOW_MS = 24 * 3_600_000;

export const USER_REF_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
  designation: true,
} as const;

const COST_SELECT = {
  id: true,
  issueId: true,
  kind: true,
  description: true,
  amount: true,
  createdAt: true,
  loggedBy: { select: USER_REF_SELECT },
} as const;

// Citywide reach over the ledger (admins); everyone else is
// scoped to their own jobs / department.
function hasCitywideScope(role: string) {
  return can(role, "cost:manage");
}

async function loadIssueForScope(issueId: string) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      status: true,
      departmentId: true,
      assignments: {
        select: {
          authorityId: true,
          departmentId: true,
        },
        orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
      },
    },
  });

  if (!issue) throw notFound("Issue");

  return issue;
}

async function departmentOf(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  return user?.departmentId ?? null;
}

// ─────────────────────────────────────────────
// LIST COSTS ON A CASE
// ─────────────────────────────────────────────

export async function listIssueCosts(actor: Actor, issueId: string) {
  const issue = await loadIssueForScope(issueId);

  if (!hasCitywideScope(actor.role)) {
    const assigned = issue.assignments.some(
      (assignment) => assignment.authorityId === actor.userId
    );
    const departmentId = await departmentOf(actor.userId);
    const sameDepartment =
      departmentId !== null &&
      (issue.departmentId === departmentId ||
        issue.assignments.some(
          (assignment) => assignment.departmentId === departmentId
        ));

    if (!assigned && !sameDepartment) {
      throw forbidden(
        "You can only see costs on cases assigned to you or your department"
      );
    }
  }

  const costs = await prisma.workCost.findMany({
    where: { issueId },
    select: COST_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return {
    costs,
    total: costs.reduce((sum, cost) => sum + cost.amount, 0),
  };
}

// ─────────────────────────────────────────────
// LOG A COST
// ─────────────────────────────────────────────

export interface CostInput {
  kind: CostKind;
  description: string;
  amount: number;
}

export async function logIssueCost(
  actor: Actor,
  issueId: string,
  data: CostInput
) {
  const issue = await loadIssueForScope(issueId);

  if (issue.status === "DUPLICATE") {
    throw badRequest(
      "This case was merged as a duplicate — log costs on the original"
    );
  }

  if (!hasCitywideScope(actor.role)) {
    const current = issue.assignments[0];

    if (!current || current.authorityId !== actor.userId) {
      throw forbidden(
        "Only the officer currently assigned to this case can log its costs"
      );
    }
  }

  const cost = await prisma.workCost.create({
    data: {
      issueId,
      loggedById: actor.userId,
      kind: data.kind,
      description: data.description,
      amount: data.amount,
    },
    select: COST_SELECT,
  });

  clearPulseCache();

  return cost;
}

// ─────────────────────────────────────────────
// DELETE A COST
// ─────────────────────────────────────────────

export async function deleteCost(
  actor: Actor,
  costId: string,
  ip?: string | null
) {
  const cost = await prisma.workCost.findUnique({
    where: { id: costId },
    select: {
      id: true,
      issueId: true,
      kind: true,
      description: true,
      amount: true,
      loggedById: true,
      createdAt: true,
    },
  });

  if (!cost) throw notFound("Cost entry");

  if (!hasCitywideScope(actor.role)) {
    if (cost.loggedById !== actor.userId) {
      throw forbidden("You can only remove costs you logged");
    }

    if (Date.now() - cost.createdAt.getTime() > DELETE_WINDOW_MS) {
      throw forbidden(
        "Costs can only be removed within 24 hours of logging. Ask an admin."
      );
    }
  }

  await prisma.workCost.delete({ where: { id: costId } });

  clearPulseCache();

  await recordAudit({
    actorId: actor.userId,
    action: "cost.delete",
    entityType: "WorkCost",
    entityId: cost.id,
    meta: {
      issueId: cost.issueId,
      kind: cost.kind,
      description: cost.description,
      amount: cost.amount,
      loggedById: cost.loggedById,
    },
    ip,
  });
}
