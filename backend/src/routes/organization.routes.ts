import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";

import { requirePermission } from "../middleware/role.middleware";

import {
  createDepartmentController,
  getDepartmentsController,
  createWardController,
  getWardsController,
  getAuthoritiesController,
  getCategoryRulesController,
  setCategoryRuleController,
} from "../controllers/organization.controller";

const router = Router();

// ─────────────────────────────────────────────
// DEPARTMENTS
// ─────────────────────────────────────────────

router.post(
  "/departments",
  authenticate,
  requirePermission("org:manage"),
  createDepartmentController
);

router.get(
  "/departments",
  authenticate,
  requirePermission("org:read"),
  getDepartmentsController
);

// Public: needed by the authority signup form
router.get(
  "/public-departments",
  getDepartmentsController
);

// ─────────────────────────────────────────────
// WARDS
// ─────────────────────────────────────────────

// Public: ward pickers on City Radar, bulletins and votes
router.get(
  "/public-wards",
  getWardsController
);

router.post(
  "/wards",
  authenticate,
  requirePermission("org:manage"),
  createWardController
);

router.get(
  "/wards",
  authenticate,
  requirePermission("org:read"),
  getWardsController
);

// ─────────────────────────────────────────────
// AUTHORITIES
// The officer picker on the assign screen.
// ─────────────────────────────────────────────

router.get(
  "/authorities",
  authenticate,
  requirePermission("issue:assign"),
  getAuthoritiesController
);

// ─────────────────────────────────────────────────
// AUTO-ASSIGNMENT RULES
// ─────────────────────────────────────────────────

router.get(
  "/rules",
  authenticate,
  requirePermission("org:manage"),
  getCategoryRulesController
);

router.put(
  "/rules",
  authenticate,
  requirePermission("org:manage"),
  setCategoryRuleController
);

export default router;
