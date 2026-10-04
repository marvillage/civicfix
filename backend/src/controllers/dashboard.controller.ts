import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { BRAND } from "../config/brand";
import {
  getDashboardStats,
  getAnalytics,
  getLeaderboard,
  getIssuesCSV,
  getMyImpact,
  getMyPerformance,
  getAuditLog,
  getPublicStats,
  getMyBadges,
  getChronicIssues,
} from "../services/dashboard.service";

export async function getPublicStatsController(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const stats = await getPublicStats();

    return res.status(200).json({ stats });
  } catch (error) {
    console.error("Get public stats error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching stats",
    });
  }
}

export async function getMyBadgesController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const badges = await getMyBadges(req.user.userId);

    return res.status(200).json({ badges });
  } catch (error) {
    console.error("Get badges error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching badges",
    });
  }
}

export async function getChronicIssuesController(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const issues = await getChronicIssues();

    return res.status(200).json({ issues });
  } catch (error) {
    console.error("Get chronic issues error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while fetching chronic issues",
    });
  }
}

export async function getMyImpactController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const impact = await getMyImpact(req.user.userId);

    return res.status(200).json({ impact });
  } catch (error) {
    console.error("Get my impact error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching your impact",
    });
  }
}

export async function getMyPerformanceController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const performance = await getMyPerformance(
      req.user.userId
    );

    return res.status(200).json({ performance });
  } catch (error) {
    console.error("Get performance error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while fetching your performance",
    });
  }
}

export async function getAuditLogController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;

    const audit = await getAuditLog(limit, offset);

    return res.status(200).json(audit);
  } catch (error) {
    console.error("Get audit log error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching the audit log",
    });
  }
}

export async function getDashboardStatsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const stats = await getDashboardStats();

    return res.status(200).json({
      stats,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching dashboard statistics",
    });
  }
}

export async function getAnalyticsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const analytics = await getAnalytics();

    return res.status(200).json({
      analytics,
    });
  } catch (error) {
    console.error("Get analytics error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching analytics",
    });
  }
}

export async function getLeaderboardController(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const leaderboard = await getLeaderboard();

    return res.status(200).json({
      leaderboard,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching the leaderboard",
    });
  }
}

export async function exportIssuesCSVController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const csv = await getIssuesCSV();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${BRAND.name.toLowerCase()}-cases-${new Date().toISOString().slice(0, 10)}.csv"`
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error("Export issues CSV error:", error);

    return res.status(500).json({
      message: "Something went wrong while exporting issues",
    });
  }
}