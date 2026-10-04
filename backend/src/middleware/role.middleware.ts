import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";
import { can, Permission } from "../auth/permissions";

// Gate a route on one or more permissions (all required).
// Routes ask "may this user do X?", never "is this user role Y?",
// so the role → permission mapping lives in one place:
// src/auth/permissions.ts.
export function requirePermission(...permissions: Permission[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "UNAUTHENTICATED",
      });
    }

    const missing = permissions.filter(
      (permission) => !can(req.user!.role, permission)
    );

    if (missing.length > 0) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
        code: "FORBIDDEN",
        missing,
      });
    }

    next();
  };
}
