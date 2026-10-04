import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

function bearerToken(req: Request) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim() || null;
}

// Verifies the JWT, then reads the user's *current* role from the
// database. The token proves identity; the database decides access,
// so a demoted or deleted account loses its powers immediately
// instead of when its 7-day token expires.
async function resolveUser(token: string) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }

  const decoded = jwt.verify(token, jwtSecret);

  if (typeof decoded === "string" || !decoded.userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: String(decoded.userId) },
    select: { id: true, role: true, isVerified: true },
  });

  if (!user || !user.isVerified) {
    return null;
  }

  return { userId: user.id, role: user.role };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = bearerToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
      code: "UNAUTHENTICATED",
    });
  }

  try {
    const user = await resolveUser(token);

    if (!user) {
      return res.status(401).json({
        message: "Your session is no longer valid. Please log in again.",
        code: "UNAUTHENTICATED",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "JWT_SECRET_NOT_CONFIGURED"
    ) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        message: "Authentication service is not configured correctly",
      });
    }

    return res.status(401).json({
      message: "Invalid or expired authentication token",
      code: "UNAUTHENTICATED",
    });
  }
}

// For public routes that show more to signed-in users (e.g. "your
// vote" on a poll). A missing or bad token just means anonymous.
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const token = bearerToken(req);

  if (token) {
    try {
      req.user = (await resolveUser(token)) ?? undefined;
    } catch {
      req.user = undefined;
    }
  }

  next();
}
