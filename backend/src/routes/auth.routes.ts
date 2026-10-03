import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import upload from "../middleware/upload.middleware";
import {
  register,
  registerAuthorityController,
  login,
  updateProfileController,
  changePasswordController,
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/register/authority", registerAuthorityController);
router.post("/login", login);
router.patch(
  "/profile",
  authenticate,
  upload.single("avatar"),
  updateProfileController
);
router.patch("/password", authenticate, changePasswordController);

export default router;