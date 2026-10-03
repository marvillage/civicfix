import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
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
  authorizeRoles("ADMIN"),
  getAllUsersController
);

router.post(
  "/authority",
  authenticate,
  authorizeRoles("ADMIN"),
  createAuthorityController
);

router.patch(
  "/:userId/role",
  authenticate,
  authorizeRoles("ADMIN"),
  changeUserRoleController
);

router.patch(
  "/:userId/verify",
  authenticate,
  authorizeRoles("ADMIN"),
  verifyUserController
);

export default router;
