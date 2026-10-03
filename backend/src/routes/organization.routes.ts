import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware";

import { authorizeRoles } from "../middleware/role.middleware";

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
  authorizeRoles("ADMIN"),
  createDepartmentController
);

router.get(
  "/departments",
  authenticate,
  authorizeRoles("ADMIN", "AUTHORITY"),
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

router.post(
  "/wards",
  authenticate,
  authorizeRoles("ADMIN"),
  createWardController
);

router.get(
  "/wards",
  authenticate,
  authorizeRoles("ADMIN", "AUTHORITY"),
  getWardsController
);

// ─────────────────────────────────────────────
// AUTHORITIES
// ─────────────────────────────────────────────

router.get(
  "/authorities",
  authenticate,
  authorizeRoles("ADMIN"),
  getAuthoritiesController
);

// ─────────────────────────────────────────────────
// AUTO-ASSIGNMENT RULES
// ─────────────────────────────────────────────────

router.get(
  "/rules",
  authenticate,
  authorizeRoles("ADMIN"),
  getCategoryRulesController
);

router.put(
  "/rules",
  authenticate,
  authorizeRoles("ADMIN"),
  setCategoryRuleController
);

export default router;