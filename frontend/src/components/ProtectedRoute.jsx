import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";
import { BRAND } from "../brand";

// Route guard. Pass `permission` (preferred) or `allowedRoles`.
// This is UX only — every API route checks the same permission.
export default function ProtectedRoute({
  allowedRoles,
  permission,
}) {
  const { user, loading, isAuthenticated, can, homePath } =
    useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading {BRAND.name}…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  const roleOk =
    !allowedRoles || allowedRoles.includes(user.role);
  const permissionOk = !permission || can(permission);

  if (!roleOk || !permissionOk) {
    return <Navigate to={homePath} replace />;
  }

  return <Outlet />;
}
