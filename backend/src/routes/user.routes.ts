import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import {
  getAllUsersController,
  changeUserRoleController,
  createAuthorityController,
  verifyUserController,
} from "../controllers/user.controller";

const router = Router();

router.get(
  "/",
  authenticate,
  requirePermission("user:manage"),
  getAllUsersController
);

router.post(
  "/authority",
  authenticate,
  requirePermission("user:manage"),
  createAuthorityController
);

router.patch(
  "/:userId/role",
  authenticate,
  requirePermission("user:manage"),
  changeUserRoleController
);

router.patch(
  "/:userId/verify",
  authenticate,
  requirePermission("user:manage"),
  verifyUserController
);

export default router;
