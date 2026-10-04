import "./config/env";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { reverseGeocode } from "./services/geocoding.service";
import { PROFILE_SELECT } from "./services/auth.service";
import { BRAND } from "./config/brand";
import { permissionsFor } from "./auth/permissions";
import { asyncHandler } from "./lib/http";

import authRoutes from "./routes/auth.routes";
import complaintRoutes from "./routes/complaint.routes";
import issueRoutes from "./routes/issue.routes";
import upvoteRoutes from "./routes/upvote.routes";
import assignmentRoutes from "./routes/assignment.routes";
import organizationRoutes from "./routes/organization.routes";
import slaRoutes from "./routes/sla.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import notificationRoutes from "./routes/notification.routes";
import userRoutes from "./routes/user.routes";
import bulletinRoutes from "./routes/bulletin.routes";
import watchZoneRoutes from "./routes/watchzone.routes";
import pollRoutes from "./routes/poll.routes";
import adminRoutes from "./routes/admin.routes";
import costRoutes from "./routes/cost.routes";
import driveRoutes from "./routes/drive.routes";
import pulseRoutes from "./routes/pulse.routes";

import {
  authenticate,
  AuthenticatedRequest,
} from "./middleware/auth.middleware";
import {
  authLimiter,
  requestLogger,
  securityHeaders,
  writeLimiter,
} from "./middleware/security.middleware";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware";

export const app = express();

// Behind Render/Vercel-style proxies, trust the first hop so rate
// limits key on the real client IP.
app.set("trust proxy", 1);

// Comma-separated list of allowed origins, e.g.
// CORS_ORIGIN=https://fixity.vercel.app,https://fixity.city
// Unset means "allow any origin" (local development).
const allowedOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(requestLogger);
app.use(securityHeaders);

app.use(
  cors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
    exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.use("/api", writeLimiter);
app.use(
  ["/api/auth/login", "/api/auth/register"],
  authLimiter
);

// ─────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/issues", upvoteRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/sla", slaRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);

// Fixity v2 features
app.use("/api/bulletins", bulletinRoutes);
app.use("/api/watch-zones", watchZoneRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/drives", driveRoutes);
app.use("/api/pulse", pulseRoutes);
// Cost Ledger spans /api/issues/:issueId/costs, /api/costs/:id
// and /api/budgets, so it mounts at /api.
app.use("/api", costRoutes);

// ─────────────────────────────────────────────
// REVERSE GEOCODING
// ─────────────────────────────────────────────

app.get(
  "/api/geocode",
  asyncHandler(async (req, res) => {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return res.status(400).json({
        message: "Valid lat and lng are required",
      });
    }

    const address = await reverseGeocode(latitude, longitude);

    return res.json({
      address,
    });
  })
);

// ─────────────────────────────────────────────
// SHARE PAGE — OG tags for link previews
// ─────────────────────────────────────────────

app.get("/share/issue/:id", async (req, res) => {
  const frontendUrl =
    process.env.FRONTEND_URL ?? "http://localhost:5173";

  const id = String(req.params.id);
  const target = `${frontendUrl}/issues/${encodeURIComponent(id)}`;

  try {
    const issue = await prisma.issue.findUnique({
      where: {
        id,
      },
      include: {
        complaints: {
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
          select: {
            imageUrl: true,
          },
        },
        ward: true,
      },
    });

    if (!issue) {
      return res.redirect(target);
    }

    const esc = (text: string) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const title = esc(issue.title);
    const description = esc(
      `${issue.category.replace(/_/g, " ")} · ${issue.status.replace(/_/g, " ")}${
        issue.ward ? ` · ${issue.ward.name}` : ""
      } — reported on ${BRAND.name}. Back it to raise its priority.`
    );
    const image = issue.complaints[0]?.imageUrl ?? "";

    return res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — ${BRAND.name}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND.name}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head>
<body>
<p>Redirecting to <a href="${esc(target)}">${BRAND.name}</a>…</p>
</body>
</html>`);
  } catch (error) {
    console.error("Share page error:", error);

    return res.redirect(target);
  }
});

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({
    message: `${BRAND.name} backend is running`,
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

// ─────────────────────────────────────────────
// CURRENT USER (+ effective permissions)
// ─────────────────────────────────────────────

app.get(
  "/api/auth/me",
  authenticate,
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user!.userId,
      },
      select: PROFILE_SELECT,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      user: {
        ...user,
        permissions: permissionsFor(user.role),
      },
    });
  })
);

// ─────────────────────────────────────────────
// FALLTHROUGH
// ─────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);
