import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
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
  authorizeRoles("ADMIN", "AUTHORITY"),
  getDashboardStatsController
);

router.get(
  "/analytics",
  authenticate,
  authorizeRoles("ADMIN"),
  getAnalyticsController
);

router.get(
  "/leaderboard",
  getLeaderboardController
);

router.get(
  "/export/issues.csv",
  authenticate,
  authorizeRoles("ADMIN"),
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
  authorizeRoles("AUTHORITY", "ADMIN"),
  getMyPerformanceController
);

router.get(
  "/audit",
  authenticate,
  authorizeRoles("ADMIN"),
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
  authorizeRoles("ADMIN"),
  getChronicIssuesController
);

export default router;