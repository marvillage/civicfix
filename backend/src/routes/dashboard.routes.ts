import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import {
  getDashboardStatsController,
  getAnalyticsController,
  getLeaderboardController,
  exportIssuesCSVController,
  getMyImpactController,
  getMyPerformanceController,
  getAuditLogController,
  getPublicStatsController,
  getMyBadgesController,
  getChronicIssuesController,
} from "../controllers/dashboard.controller";

const router = Router();

router.get(
  "/stats",
  authenticate,
  requirePermission("analytics:full"),
  getDashboardStatsController
);

router.get(
  "/analytics",
  authenticate,
  requirePermission("issue:read:all"),
  getAnalyticsController
);

router.get(
  "/leaderboard",
  getLeaderboardController
);

router.get(
  "/export/issues.csv",
  authenticate,
  requirePermission("export:csv"),
  exportIssuesCSVController
);

router.get(
  "/my-impact",
  authenticate,
  getMyImpactController
);

router.get(
  "/my-performance",
  authenticate,
  requirePermission("performance:read:own"),
  getMyPerformanceController
);

router.get(
  "/audit",
  authenticate,
  requirePermission("audit:read"),
  getAuditLogController
);

router.get(
  "/public-stats",
  getPublicStatsController
);

router.get(
  "/my-badges",
  authenticate,
  getMyBadgesController
);

router.get(
  "/chronic",
  authenticate,
  requirePermission("issue:read:all"),
  getChronicIssuesController
);

export default router;
