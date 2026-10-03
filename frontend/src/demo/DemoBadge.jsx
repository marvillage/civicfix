import { Link, useLocation } from "react-router-dom";

// Small fixed pill shown on every page when VITE_DEMO=1.
// The login page has its own demo panel, so the pill steps aside there.
export default function DemoBadge() {
  const { pathname } = useLocation();

  if (pathname === "/login") {
    return null;
  }

  return (
    <div className="demo-badge" role="status">
      <span className="demo-badge-dot" aria-hidden="true" />
      <span>Demo mode · sample data</span>
      <Link to="/login">Switch role</Link>
    </div>
  );
}
