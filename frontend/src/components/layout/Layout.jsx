import { useAuth } from "../../context/auth";
import AppShell from "./AppShell";
import PublicShell from "./PublicShell";
import { BRAND } from "../../brand";

// Shared pages (City Radar, City Pulse, bulletins…) render inside
// the workspace when signed in and the public chrome otherwise.
export default function Layout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading {BRAND.name}…
      </div>
    );
  }

  return isAuthenticated ? <AppShell /> : <PublicShell />;
}
