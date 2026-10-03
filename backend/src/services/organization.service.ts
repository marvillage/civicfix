import { prisma } from "../lib/prisma";

// ─────────────────────────────────────────────
// DEPARTMENTS
// ─────────────────────────────────────────────

export async function createDepartment(
  name: string
) {
  const existing =
    await prisma.department.findUnique({
      where: { name },
    });

  if (existing) {
    throw new Error(
      "DEPARTMENT_ALREADY_EXISTS"
    );
  }

  return prisma.department.create({
    data: {
      name,
    },
  });
}

export async function getDepartments() {
  return prisma.department.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

// ─────────────────────────────────────────────
// AUTO-ASSIGNMENT RULES
// ─────────────────────────────────────────────

export async function getCategoryRules() {
  return prisma.categoryRule.findMany({
    include: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      category: "asc",
    },
  });
}

export async function setCategoryRule(
  category: string,
  departmentId: string | null
) {
  if (!departmentId) {
    await prisma.categoryRule.deleteMany({
      where: {
        category: category as any,
      },
    });

    return null;
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  });

  if (!department) {
    throw new Error("DEPARTMENT_NOT_FOUND");
  }

  return prisma.categoryRule.upsert({
    where: {
      category: category as any,
    },
    create: {
      category: category as any,
      departmentId,
    },
    update: {
      departmentId,
    },
    include: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

// ─────────────────────────────────────────────
// WARDS
// ─────────────────────────────────────────────

export async function createWard(
  name: string,
  code: string
) {
  const existing =
    await prisma.ward.findUnique({
      where: { code },
    });

  if (existing) {
    throw new Error(
      "WARD_ALREADY_EXISTS"
    );
  }

  return prisma.ward.create({
    data: {
      name,
      code,
    },
  });
}

export async function getWards() {
  return prisma.ward.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

// ─────────────────────────────────────────────
// AUTHORITIES
// ─────────────────────────────────────────────

export async function getAuthorities() {
  return prisma.user.findMany({
    where: {
      role: "AUTHORITY",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}