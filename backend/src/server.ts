import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { startSLABreachJob } from "./jobs/sla.job";
import { reverseGeocode } from "./services/geocoding.service";
import { PROFILE_SELECT } from "./services/auth.service";

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

import {
  authenticate,
  AuthenticatedRequest,
} from "./middleware/auth.middleware";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Comma-separated list of allowed origins, e.g.
// CORS_ORIGIN=https://civicfix.vercel.app,https://civicfix.com
// Unset means "allow any origin" (local development).
const allowedOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins?.length
      ? allowedOrigins
      : true,
  })
);

app.use(express.json());

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

// ─────────────────────────────────────────────
// REVERSE GEOCODING
// ─────────────────────────────────────────────

app.get("/api/geocode", async (req, res) => {
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

  const address = await reverseGeocode(
    latitude,
    longitude
  );

  return res.json({
    address,
  });
});

// ─────────────────────────────────────────────
// SHARE PAGE — OG tags for link previews
// ─────────────────────────────────────────────

app.get("/share/issue/:id", async (req, res) => {
  const frontendUrl =
    process.env.FRONTEND_URL ?? "http://localhost:5173";

  const target = `${frontendUrl}/issues/${req.params.id}`;

  try {
    const issue = await prisma.issue.findUnique({
      where: {
        id: req.params.id,
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
      } — reported on CivicFix. Upvote it to raise its priority.`
    );
    const image = issue.complaints[0]?.imageUrl ?? "";

    return res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — CivicFix</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="CivicFix">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head>
<body>
<p>Redirecting to <a href="${esc(target)}">CivicFix</a>…</p>
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
    message: "CivicFix backend is running",
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
// CURRENT USER
// ─────────────────────────────────────────────

app.get(
  "/api/auth/me",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
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
        user,
      });
    } catch (error) {
      console.error("Fetch user error:", error);

      return res.status(500).json({
        message: "Something went wrong",
      });
    }
  }
);

startSLABreachJob();

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(
    `CivicFix backend running on http://localhost:${PORT}`
  );
});