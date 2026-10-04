import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

// Security headers on every response.
export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

const limiterDefaults = {
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  message: {
    message:
      "Too many requests. Please slow down and try again shortly.",
    code: "RATE_LIMITED",
  },
};

// Limits are tunable per deployment (e.g. raised for load tests).
const envLimit = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

// Login and registration: slows down credential stuffing.
export const authLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  limit: envLimit("RATE_LIMIT_AUTH", 30),
});

// Every write across the API.
export const writeLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  limit: envLimit("RATE_LIMIT_WRITES", 120),
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
});

// Request id + one access-log line per request.
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers["x-request-id"];
  const id =
    typeof header === "string" && header.length <= 64
      ? header
      : randomUUID();
  const started = process.hrtime.bigint();

  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);

  res.on("finish", () => {
    if (process.env.NODE_ENV === "test") return;

    const ms = Number(process.hrtime.bigint() - started) / 1e6;

    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms id=${id}`
    );
  });

  next();
}
