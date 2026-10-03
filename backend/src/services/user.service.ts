import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

export async function setUserVerified(
  userId: string,
  verified: boolean
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isVerified: verified },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isVerified: true,
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      title: verified
        ? "Account Approved"
        : "Account Access Suspended",
      message: verified
        ? "Your authority account has been verified and approved. You can now sign in and start working on assigned issues."
        : "Your authority account access has been suspended by an administrator.",
    },
  });

  return updated;
}

export async function getAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      points: true,
      isVerified: true,
      employeeId: true,
      designation: true,
      phone: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      createdAt: true,
      _count: {
        select: {
          complaints: true,
          assignments: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function changeUserRole(
  userId: string,
  role: string,
  actingAdminId: string
) {
  if (userId === actingAdminId) {
    throw new Error("CANNOT_CHANGE_OWN_ROLE");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      role: role as any,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

interface CreateAuthorityData {
  name: string;
  email: string;
  employeeId: string;
  designation?: string;
  phone?: string;
  departmentId?: string;
}

export async function createAuthorityAccount(
  data: CreateAuthorityData
) {
  const existingEmail = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingEmail) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const existingEmployee = await prisma.user.findUnique({
    where: { employeeId: data.employeeId },
  });

  if (existingEmployee) {
    throw new Error("EMPLOYEE_ID_ALREADY_EXISTS");
  }

  if (data.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
    });

    if (!department) {
      throw new Error("DEPARTMENT_NOT_FOUND");
    }
  }

  const tempPassword = crypto
    .randomBytes(9)
    .toString("base64url");

  const passwordHash = await bcrypt.hash(
    tempPassword,
    12
  );

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: "AUTHORITY",
      employeeId: data.employeeId,
      designation: data.designation,
      phone: data.phone,
      departmentId: data.departmentId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      employeeId: true,
      designation: true,
      phone: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return { user, tempPassword };
}
