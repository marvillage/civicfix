import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  registerUser,
  registerAuthority,
  loginUser,
  updateProfile,
  changePassword,
} from "../services/auth.service";

export async function registerAuthorityController(
  req: Request,
  res: Response
) {
  try {
    const {
      name,
      email,
      password,
      employeeId,
      designation,
      phone,
      departmentId,
    } = req.body;

    if (!name || !email || !password || !employeeId) {
      return res.status(400).json({
        message:
          "Name, official email, password and government/employee ID are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const user = await registerAuthority({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      employeeId: employeeId.trim(),
      designation: designation?.trim() || undefined,
      phone: phone?.trim() || undefined,
      departmentId: departmentId || undefined,
    });

    return res.status(201).json({
      message:
        "Registration submitted. An admin will verify your government ID and approve the account before you can sign in.",
      user,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "EMAIL_ALREADY_EXISTS") {
        return res.status(409).json({
          message: "An account with this email already exists",
        });
      }

      if (
        error.message === "EMPLOYEE_ID_ALREADY_EXISTS"
      ) {
        return res.status(409).json({
          message:
            "An account with this government/employee ID already exists",
        });
      }

      if (error.message === "DEPARTMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Department not found",
        });
      }
    }

    console.error("Authority registration error:", error);

    return res.status(500).json({
      message: "Something went wrong during registration",
    });
  }
}
import { uploadImage } from "../services/image.service";

export async function updateProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { name, bio, ward, phone } = req.body;

    if (
      name !== undefined &&
      (!name || !name.trim())
    ) {
      return res.status(400).json({
        message: "Name cannot be empty",
      });
    }

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      data.name = name.trim();
    }

    if (bio !== undefined) {
      data.bio = bio?.trim() || null;
    }

    if (ward !== undefined) {
      data.ward = ward?.trim() || null;
    }

    if (phone !== undefined) {
      data.phone = phone?.trim() || null;
    }

    if (req.file) {
      data.avatarUrl = await uploadImage(
        req.file.buffer,
        "civicfix/avatars"
      );
    }

    const user = await updateProfile(
      req.user.userId,
      data
    );

    return res.status(200).json({
      message: "Profile updated",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      message: "Something went wrong while updating the profile",
    });
  }
}

export async function changePasswordController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Current password and new password are required",
      });
    }

    await changePassword(
      req.user.userId,
      currentPassword,
      newPassword
    );

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "INVALID_CURRENT_PASSWORD"
      ) {
        return res.status(400).json({
          message: "Current password is incorrect",
        });
      }

      if (error.message === "PASSWORD_TOO_SHORT") {
        return res.status(400).json({
          message:
            "New password must be at least 8 characters",
        });
      }
    }

    console.error("Change password error:", error);

    return res.status(500).json({
      message: "Something went wrong while changing the password",
    });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const user = await registerUser(name, email, password);

    return res.status(201).json({
      message: "Registration successful",
      user,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const result = await loginUser(email, password);

    return res.status(200).json({
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (
      error instanceof Error &&
      error.message === "ACCOUNT_PENDING_APPROVAL"
    ) {
      return res.status(403).json({
        message:
          "Your authority account is still awaiting admin approval. You will be able to sign in once it is verified.",
      });
    }

    if (
      error instanceof Error &&
      error.message === "JWT_SECRET_NOT_CONFIGURED"
    ) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        message: "Authentication service is not configured correctly",
      });
    }

    console.error("Login error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
}