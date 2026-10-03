import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

export async function registerUser(
  name: string,
  email: string,
  password: string
) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}

interface AuthoritySignup {
  name: string;
  email: string;
  password: string;
  employeeId: string;
  designation?: string;
  phone?: string;
  departmentId?: string;
}

// Authority self-signup: the account is created but stays
// unverified until an admin approves it, so nobody can grant
// themselves staff access.
export async function registerAuthority(
  data: AuthoritySignup
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

  const passwordHash = await bcrypt.hash(
    data.password,
    12
  );

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: "AUTHORITY",
      isVerified: false,
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
      isVerified: true,
    },
  });

  // Alert every admin that an approval is waiting.
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        title: "Authority Account Pending Approval",
        message: `${user.name} (${user.employeeId}${
          user.designation ? `, ${user.designation}` : ""
        }) registered as an authority and is waiting for approval.`,
      },
    });
  }

  return user;
}

export async function loginUser(
  email: string,
  password: string
) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  // Staff accounts must be approved by an admin first.
  if (!user.isVerified) {
    throw new Error("ACCOUNT_PENDING_APPROVAL");
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      ward: user.ward,
      phone: user.phone,
      employeeId: user.employeeId,
      designation: user.designation,
      createdAt: user.createdAt,
    },
  };
}

interface ProfileUpdate {
  name?: string;
  bio?: string | null;
  ward?: string | null;
  phone?: string | null;
  avatarUrl?: string;
}

export const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  points: true,
  avatarUrl: true,
  bio: true,
  ward: true,
  phone: true,
  employeeId: true,
  designation: true,
  department: {
    select: { id: true, name: true },
  },
  createdAt: true,
} as const;

export async function updateProfile(
  userId: string,
  data: ProfileUpdate
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: PROFILE_SELECT,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const passwordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash
  );

  if (!passwordValid) {
    throw new Error("INVALID_CURRENT_PASSWORD");
  }

  if (newPassword.length < 8) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const passwordHash = await bcrypt.hash(
    newPassword,
    12
  );

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { changed: true };
}