import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import { DEMO_MODE } from "./api/axios";
import DemoBadge from "./demo/DemoBadge";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AuthoritySignup from "./pages/auth/AuthoritySignup";

import PublicIssues from "./pages/public/PublicIssues";
import PublicIssueDetails from "./pages/public/PublicIssueDetails";
import PublicReport from "./pages/public/PublicReport";
import PublicStats from "./pages/public/PublicStats";
import Landing from "./pages/Landing";
import FieldReport from "./pages/authority/FieldReport";

import CitizenDashboard from "./pages/citizen/CitizenDashboard";
import ReportIssue from "./pages/citizen/ReportIssue";
import MyComplaints from "./pages/citizen/MyComplaints";
import ComplaintDetails from "./pages/citizen/ComplaintDetails";

import AuthorityDashboard from "./pages/authority/AuthorityDashboard";
import AuthorityIssueDetails from "./pages/authority/AuthorityIssueDetails";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminIssues from "./pages/admin/AdminIssues";
import AdminOrganization from "./pages/admin/AdminOrganization";
import AdminSLA from "./pages/admin/AdminSLA";
import AdminAssignments from "./pages/admin/AdminAssignments";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAudit from "./pages/admin/AdminAudit";
import Profile from "./pages/Profile";

function ThemeManager() {
  const { pathname } = useLocation();

  const isNightRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/authority");

  const [dark, setDark] = useState(
    () =>
      localStorage.getItem("civicfix_theme") ===
      "dark"
  );

  useEffect(() => {
    if (isNightRoute) {
      document.documentElement.dataset.theme = "night";
    } else if (dark) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [isNightRoute, dark]);

  if (isNightRoute) {
    return null;
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={
        dark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      onClick={() => {
        const next = !dark;

        setDark(next);

        localStorage.setItem(
          "civicfix_theme",
          next ? "dark" : "light"
        );
      }}
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}

function NotFound() {
  return (
    <div className="not-found">
      <img
        src="/images/pigeon-404.png"
        alt="A confused pigeon on a twisted road sign"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />

      <h1>Wrong turn</h1>

      <p>
        This page doesn't exist. Head back to safer
        roads.
      </p>

      <Link to="/">
        <button type="button">Go home</button>
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeManager />
      {DEMO_MODE && <DemoBadge />}
      <Routes>
        {/* PUBLIC */}

        <Route
          path="/"
          element={<Landing />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/register/authority"
          element={<AuthoritySignup />}
        />

        <Route
          path="/issues"
          element={<PublicIssues />}
        />

        <Route
          path="/issues/:id"
          element={<PublicIssueDetails />}
        />

        <Route
          path="/report"
          element={<PublicReport />}
        />

        <Route
          path="/stats"
          element={<PublicStats />}
        />

        {/* ANY LOGGED-IN ROLE */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "CITIZEN",
                "AUTHORITY",
                "ADMIN",
              ]}
            />
          }
        >
          <Route
            path="/profile"
            element={<Profile />}
          />
        </Route>

        {/* CITIZEN */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["CITIZEN"]}
            />
          }
        >
          <Route
            path="/citizen"
            element={<CitizenDashboard />}
          />

          <Route
            path="/citizen/report"
            element={<ReportIssue />}
          />

          <Route
            path="/citizen/complaints"
            element={<MyComplaints />}
          />

          <Route
            path="/citizen/complaints/:id"
            element={<ComplaintDetails />}
          />
        </Route>

        {/* AUTHORITY */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={[
                "AUTHORITY",
                "ADMIN",
              ]}
            />
          }
        >
          <Route
            path="/authority"
            element={<AuthorityDashboard />}
          />

          <Route
            path="/authority/issues/:id"
            element={<AuthorityIssueDetails />}
          />

          <Route
            path="/authority/report"
            element={<FieldReport />}
          />
        </Route>

        {/* ADMIN */}

        <Route
          element={
            <ProtectedRoute
              allowedRoles={["ADMIN"]}
            />
          }
        >
          <Route
            path="/admin"
            element={<AdminDashboard />}
          />

          <Route
            path="/admin/issues"
            element={<AdminIssues />}
          />

          <Route
            path="/admin/assignments"
            element={<AdminAssignments />}
          />

          <Route
            path="/admin/organization"
            element={<AdminOrganization />}
          />

          <Route
            path="/admin/sla"
            element={<AdminSLA />}
          />

          <Route
            path="/admin/users"
            element={<AdminUsers />}
          />

          <Route
            path="/admin/audit"
            element={<AdminAudit />}
          />
        </Route>

        {/* FALLBACK */}

        <Route
          path="*"
          element={<NotFound />}
        />
      </Routes>
    </BrowserRouter>
  );
}