import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  getAllUsers,
  changeUserRole,
  createAuthorityAccount,
  setUserVerified,
} from "../services/user.service";

export async function verifyUserController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { userId } = req.params;
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        message: "verified must be true or false",
      });
    }

    const user = await setUserVerified(
      userId,
      verified
    );

    return res.status(200).json({
      message: verified
        ? "Account approved"
        : "Account access suspended",
      user,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "USER_NOT_FOUND"
    ) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    console.error("Verify user error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while updating the account",
    });
  }
}

export async function getAllUsersController(
  _req: AuthenticatedRequest,
  res: Response
) {
  try {
    const users = await getAllUsers();

    return res.status(200).json({
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching users",
    });
  }
}

export async function changeUserRoleController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ["CITIZEN", "AUTHORITY", "ADMIN"];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        message: "Role must be CITIZEN, AUTHORITY or ADMIN",
      });
    }

    const user = await changeUserRole(
      userId,
      role,
      req.user.userId
    );

    return res.status(200).json({
      message: `Role updated to ${role}`,
      user,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CANNOT_CHANGE_OWN_ROLE") {
        return res.status(400).json({
          message: "You cannot change your own role",
        });
      }

      if (error.message === "USER_NOT_FOUND") {
        return res.status(404).json({
          message: "User not found",
        });
      }
    }

    console.error("Change role error:", error);

    return res.status(500).json({
      message: "Something went wrong while changing the role",
    });
  }
}

export async function createAuthorityController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      name,
      email,
      employeeId,
      designation,
      phone,
      departmentId,
    } = req.body;

    if (!name || !email || !employeeId) {
      return res.status(400).json({
        message:
          "Name, email and employee ID are required for authority accounts",
      });
    }

    const result = await createAuthorityAccount({
      name,
      email,
      employeeId,
      designation,
      phone,
      departmentId: departmentId || undefined,
    });

    return res.status(201).json({
      message: "Authority account created",
      user: result.user,
      tempPassword: result.tempPassword,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "EMAIL_ALREADY_EXISTS") {
        return res.status(409).json({
          message: "A user with this email already exists",
        });
      }

      if (
        error.message === "EMPLOYEE_ID_ALREADY_EXISTS"
      ) {
        return res.status(409).json({
          message:
            "An account with this employee ID already exists",
        });
      }

      if (error.message === "DEPARTMENT_NOT_FOUND") {
        return res.status(404).json({
          message: "Department not found",
        });
      }
    }

    console.error("Create authority error:", error);

    return res.status(500).json({
      message:
        "Something went wrong while creating the authority account",
    });
  }
}
