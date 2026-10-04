import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import { Loading } from "./components/ui";
import { DEMO_MODE } from "./api/axios";
import DemoBadge from "./demo/DemoBadge";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AuthoritySignup from "./pages/auth/AuthoritySignup";

// Route-level code splitting: each area downloads on first visit.
const PublicIssues = lazy(() => import("./pages/public/PublicIssues"));
const PublicIssueDetails = lazy(() => import("./pages/public/PublicIssueDetails"));
const PublicReport = lazy(() => import("./pages/public/PublicReport"));
const CityPulse = lazy(() => import("./pages/pulse/CityPulse"));

const Bulletins = lazy(() => import("./pages/community/Bulletins"));
const WatchZones = lazy(() => import("./pages/community/WatchZones"));
const Polls = lazy(() => import("./pages/community/Polls"));
const PollDetail = lazy(() => import("./pages/community/PollDetail"));
const Drives = lazy(() => import("./pages/community/Drives"));
const DriveDetail = lazy(() => import("./pages/community/DriveDetail"));
const DriveNew = lazy(() => import("./pages/community/DriveNew"));

const Profile = lazy(() => import("./pages/Profile"));

const CitizenDashboard = lazy(() => import("./pages/citizen/CitizenDashboard"));
const ReportIssue = lazy(() => import("./pages/citizen/ReportIssue"));
const MyComplaints = lazy(() => import("./pages/citizen/MyComplaints"));
const ComplaintDetails = lazy(() => import("./pages/citizen/ComplaintDetails"));

const AuthorityDashboard = lazy(() => import("./pages/authority/AuthorityDashboard"));
const AuthorityIssueDetails = lazy(() => import("./pages/authority/AuthorityIssueDetails"));
const FieldReport = lazy(() => import("./pages/authority/FieldReport"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminIssues = lazy(() => import("./pages/admin/AdminIssues"));
const AdminAssignments = lazy(() => import("./pages/admin/AdminAssignments"));
const AdminOrganization = lazy(() => import("./pages/admin/AdminOrganization"));
const AdminSLA = lazy(() => import("./pages/admin/AdminSLA"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AccessMatrix = lazy(() => import("./pages/admin/AccessMatrix"));
const Budgets = lazy(() => import("./pages/admin/Budgets"));

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

      <p className="not-found-code">ERROR 404 · ROAD CLOSED</p>

      <h1>Wrong turn</h1>

      <p>
        This page doesn't exist. Head back to safer roads.
      </p>

      <Link to="/" className="btn btn-accent">
        Go home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {DEMO_MODE && <DemoBadge />}

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Stand-alone pages with their own chrome */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/register/authority"
            element={<AuthoritySignup />}
          />

          {/* Everything else: workspace when signed in, public chrome otherwise */}
          <Route element={<Layout />}>
            {/* PUBLIC */}
            <Route path="/issues" element={<PublicIssues />} />
            <Route path="/issues/:id" element={<PublicIssueDetails />} />
            <Route path="/report" element={<PublicReport />} />
            <Route path="/pulse" element={<CityPulse />} />
            <Route path="/stats" element={<Navigate to="/pulse" replace />} />
            <Route path="/bulletins" element={<Bulletins />} />
            <Route path="/polls" element={<Polls />} />
            <Route path="/polls/:id" element={<PollDetail />} />
            <Route path="/drives" element={<Drives />} />
            <Route path="/drives/:id" element={<DriveDetail />} />

            {/* ANY SIGNED-IN ROLE */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route element={<ProtectedRoute permission="watchzone:manage" />}>
              <Route path="/watch-zones" element={<WatchZones />} />
            </Route>

            <Route element={<ProtectedRoute permission="drive:propose" />}>
              <Route path="/drives/new" element={<DriveNew />} />
            </Route>

            <Route element={<ProtectedRoute permission="budget:read" />}>
              <Route path="/budgets" element={<Budgets />} />
            </Route>

            {/* CITIZEN */}
            <Route element={<ProtectedRoute allowedRoles={["CITIZEN"]} />}>
              <Route path="/citizen" element={<CitizenDashboard />} />
              <Route path="/citizen/report" element={<ReportIssue />} />
              <Route path="/citizen/complaints" element={<MyComplaints />} />
              <Route path="/citizen/complaints/:id" element={<ComplaintDetails />} />
            </Route>

            {/* OFFICERS (admins may open officer views too) */}
            <Route element={<ProtectedRoute permission="assignment:work" />}>
              <Route path="/authority" element={<AuthorityDashboard />} />
              <Route path="/authority/issues/:id" element={<AuthorityIssueDetails />} />
            </Route>

            <Route element={<ProtectedRoute permission="field:report" />}>
              <Route path="/authority/report" element={<FieldReport />} />
            </Route>

            {/* ADMIN */}
            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute permission="issue:read:all" />}>
              <Route path="/admin/issues" element={<AdminIssues />} />
            </Route>

            <Route element={<ProtectedRoute permission="assignment:read:all" />}>
              <Route path="/admin/assignments" element={<AdminAssignments />} />
            </Route>

            <Route element={<ProtectedRoute permission="org:manage" />}>
              <Route path="/admin/organization" element={<AdminOrganization />} />
            </Route>

            <Route element={<ProtectedRoute permission="sla:manage" />}>
              <Route path="/admin/sla" element={<AdminSLA />} />
            </Route>

            <Route element={<ProtectedRoute permission="user:manage" />}>
              <Route path="/admin/users" element={<AdminUsers />} />
            </Route>

            <Route element={<ProtectedRoute permission="audit:read" />}>
              <Route path="/admin/audit" element={<AdminAudit />} />
            </Route>

            <Route element={<ProtectedRoute permission="rbac:read" />}>
              <Route path="/admin/access" element={<AccessMatrix />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
