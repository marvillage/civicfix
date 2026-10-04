import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { notFound } from "../lib/http";
import { can } from "../auth/permissions";
import { recordAudit } from "./audit.service";
import { clearPulseCache } from "./pulse.service";
import { monthBounds, monthKey } from "./pulse.helpers";
import type { Actor } from "./cost.service";

// ─────────────────────────────────────────────
// DEPARTMENT BUDGETS
// Monthly allocation per department vs. what was logged
// on that department's cases. Months are IST calendar
// months, "YYYY-MM". Money is whole rupees.
// ─────────────────────────────────────────────

export function currentMonth() {
  return monthKey(new Date());
}

// Budget managers see every department; other staff
// (officers) only their own.
async function visibleDepartments(actor: Actor) {
  if (can(actor.role, "budget:manage")) {
    return prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      department: { select: { id: true, name: true } },
    },
  });

  return user?.department ? [user.department] : [];
}

export async function getBudgets(actor: Actor, month: string) {
  const departments = await visibleDepartments(actor);
  const ids = departments.map((department) => department.id);

  if (ids.length === 0) {
    return { month, departments: [] };
  }

  const { from, to } = monthBounds(month);

  const [budgets, spendRows] = await Promise.all([
    prisma.departmentBudget.findMany({
      where: { month, departmentId: { in: ids } },
      select: { departmentId: true, amount: true },
    }),

    prisma.$queryRaw<
      { departmentId: string; spent: number; issues: number }[]
    >`
      SELECT i."departmentId" AS "departmentId",
             sum(c.amount)::float8 AS spent,
             count(DISTINCT c."issueId")::int AS issues
      FROM "WorkCost" c
      JOIN "Issue" i ON i.id = c."issueId"
      WHERE c."createdAt" >= ${from} AND c."createdAt" < ${to}
        AND i."departmentId" IN (${Prisma.join(ids)})
      GROUP BY 1`,
  ]);

  const budgetMap = new Map(
    budgets.map((row) => [row.departmentId, row.amount])
  );
  const spendMap = new Map(
    spendRows.map((row) => [row.departmentId, row])
  );

  return {
    month,
    departments: departments.map((department) => ({
      department,
      budget: budgetMap.get(department.id) ?? null,
      spent: spendMap.get(department.id)?.spent ?? 0,
      issues: spendMap.get(department.id)?.issues ?? 0,
    })),
  };
}

export interface BudgetInput {
  departmentId: string;
  month: string;
  amount: number;
}

export async function setBudget(
  actor: Actor,
  data: BudgetInput,
  ip?: string | null
) {
  const department = await prisma.department.findUnique({
    where: { id: data.departmentId },
    select: { id: true, name: true },
  });

  if (!department) throw notFound("Department");

  const key = {
    departmentId_month: {
      departmentId: data.departmentId,
      month: data.month,
    },
  };

  const previous = await prisma.departmentBudget.findUnique({
    where: key,
    select: { amount: true },
  });

  const budget = await prisma.departmentBudget.upsert({
    where: key,
    create: {
      departmentId: data.departmentId,
      month: data.month,
      amount: data.amount,
    },
    update: { amount: data.amount },
    select: {
      id: true,
      departmentId: true,
      month: true,
      amount: true,
    },
  });

  clearPulseCache();

  await recordAudit({
    actorId: actor.userId,
    action: "budget.set",
    entityType: "DepartmentBudget",
    entityId: budget.id,
    meta: {
      departmentId: department.id,
      department: department.name,
      month: data.month,
      amount: data.amount,
      previous: previous?.amount ?? null,
    },
    ip,
  });

  return budget;
}
