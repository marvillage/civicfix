import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Notifications from "../../components/Notifications";
import IssueMap from "../../components/IssueMap";

function slaInfo(assignment, now) {
  const sla = assignment.issue?.sla;

  if (!sla || assignment.completedAt) {
    return null;
  }

  if (sla.breached) {
    return { breached: true, label: "SLA breached" };
  }

  const remainingMs =
    new Date(sla.deadline).getTime() - now;

  if (remainingMs <= 0) {
    return { breached: true, label: "SLA breached" };
  }

  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor(
    (remainingMs % 3600000) / 60000
  );

  const label =
    hours >= 48
      ? `${Math.floor(hours / 24)}d left`
      : hours > 0
        ? `${hours}h ${minutes}m left`
        : `${minutes}m left`;

  return {
    breached: false,
    urgent: remainingMs < 4 * 3600000,
    remainingMs,
    label,
  };
}

export default function AuthorityDashboard() {
  const [assignments, setAssignments] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [view, setView] = useState("list");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(
      () => setNow(Date.now()),
      60000
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchAssignments() {
      try {
        const [assignRes, perfRes] = await Promise.all([
          api.get("/assignments/my"),
          api.get("/dashboard/my-performance"),
        ]);

        setAssignments(assignRes.data.assignments || []);
        setPerformance(perfRes.data.performance || null);
      } catch (error) {
        console.error("Fetch assignments error:", error);

        setError(
          error.response?.data?.message ||
            "Unable to load assignments."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchAssignments();
  }, []);

  function formatStatus(status) {
    return status
      ?.replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(date) {
    if (!date) return "Not available";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getAssignmentStage(assignment) {
    const status = assignment.issue?.status;

    if (assignment.completedAt || status === "RESOLVED") {
      return "Resolved";
    }

    if (status === "IN_PROGRESS") {
      return "In Progress";
    }

    if (assignment.acceptedAt || status === "ACKNOWLEDGED") {
      return "Accepted";
    }

    return "Pending Acceptance";
  }

  const pending = assignments.filter(
    (assignment) =>
      !assignment.acceptedAt &&
      !assignment.completedAt &&
      assignment.issue?.status !== "RESOLVED"
  ).length;

  const active = assignments.filter(
    (assignment) =>
      !assignment.completedAt &&
      (
        assignment.issue?.status === "ACKNOWLEDGED" ||
        assignment.issue?.status === "IN_PROGRESS"
      )
  ).length;

  const resolved = assignments.filter(
    (assignment) =>
      assignment.completedAt ||
      assignment.issue?.status === "RESOLVED"
  ).length;

  const filteredAssignments = assignments
    .filter((assignment) => {
      const status = assignment.issue?.status;

      if (activeFilter === "PENDING") {
        return (
          !assignment.acceptedAt &&
          !assignment.completedAt &&
          status !== "RESOLVED"
        );
      }

      if (activeFilter === "ACTIVE") {
        return (
          !assignment.completedAt &&
          (
            status === "ACKNOWLEDGED" ||
            status === "IN_PROGRESS"
          )
        );
      }

      if (activeFilter === "RESOLVED") {
        return (
          assignment.completedAt ||
          status === "RESOLVED"
        );
      }

      return true;
    })
    .sort((a, b) => {
      // Most urgent first: breached, then nearest
      // deadline, then no-SLA, completed last.
      const rank = (assignment) => {
        if (assignment.completedAt) {
          return Number.MAX_SAFE_INTEGER;
        }

        if (assignment.issue?.isEmergency) {
          return -2;
        }

        const info = slaInfo(assignment, now);

        if (!info) {
          return Number.MAX_SAFE_INTEGER - 1;
        }

        if (info.breached) {
          return -1;
        }

        return info.remainingMs;
      };

      return rank(a) - rank(b);
    });

  function handleFilter(filter) {
    setActiveFilter(filter);
  }

  function getFilterTitle() {
    if (activeFilter === "PENDING") {
      return "Pending Acceptance";
    }

    if (activeFilter === "ACTIVE") {
      return "Active Issues";
    }

    if (activeFilter === "RESOLVED") {
      return "Resolved Issues";
    }

    return "Assigned Issues";
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <p className="eyebrow">AUTHORITY</p>
          <h1>Authority Dashboard</h1>
          <p>Manage and track your assigned civic issues.</p>
        </div>

        <div className="loading-block">
          <span className="spinner" />
          <span>Loading your assignments…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header admin-dash-header">
        <div>
          <p className="eyebrow">AUTHORITY</p>

          <h1>Authority Dashboard</h1>

          <p>
            Manage and track civic issues assigned to you.
          </p>
        </div>

        <div className="issue-card-actions">
          <Link to="/authority/report">
            <button type="button">
              + Log field issue
            </button>
          </Link>

          <Link to="/profile">
            <button
              type="button"
              className="secondary-button"
            >
              My Profile
            </button>
          </Link>

          <Link to="/">
            <button
              type="button"
              className="secondary-button"
            >
              ⌂ Home
            </button>
          </Link>
        </div>
      </div>

      <section className="stats-grid">
        <button
          type="button"
          className={`stat-card stat-card-button ${
            activeFilter === "ALL" ? "stat-card-active" : ""
          }`}
          onClick={() => handleFilter("ALL")}
        >
          <h2>{assignments.length}</h2>
          <p>Total Assigned</p>
        </button>

        <button
          type="button"
          className={`stat-card stat-card-button ${
            activeFilter === "PENDING" ? "stat-card-active" : ""
          }`}
          onClick={() => handleFilter("PENDING")}
        >
          <h2>{pending}</h2>
          <p>Pending Acceptance</p>
        </button>

        <button
          type="button"
          className={`stat-card stat-card-button ${
            activeFilter === "ACTIVE" ? "stat-card-active" : ""
          }`}
          onClick={() => handleFilter("ACTIVE")}
        >
          <h2>{active}</h2>
          <p>Active Issues</p>
        </button>

        <button
          type="button"
          className={`stat-card stat-card-button ${
            activeFilter === "RESOLVED" ? "stat-card-active" : ""
          }`}
          onClick={() => handleFilter("RESOLVED")}
        >
          <h2>{resolved}</h2>
          <p>Resolved</p>
        </button>
      </section>

      {performance && (
        <section className="stats-grid insights-grid">
          <div className="stat-card">
            <h2>
              {performance.avgResolutionHours ?? "—"}
              {performance.avgResolutionHours != null &&
                "h"}
            </h2>
            <p>My avg. resolution time</p>
          </div>

          <div className="stat-card">
            <h2>{performance.completedThisMonth}</h2>
            <p>Resolved this month</p>
          </div>

          <div className="stat-card">
            <h2>
              {performance.slaHitRate ?? "—"}
              {performance.slaHitRate != null && "%"}
            </h2>
            <p>SLA hit rate</p>
          </div>

          <div className="stat-card">
            <h2>
              {performance.avgRating != null
                ? `★ ${performance.avgRating}`
                : "—"}
            </h2>
            <p>
              Citizen rating
              {performance.ratingsCount
                ? ` (${performance.ratingsCount})`
                : ""}
            </p>
          </div>
        </section>
      )}

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      <Notifications />

      {!error && assignments.length === 0 && (
        <div className="empty-state">
          <h2>No assignments yet</h2>

          <p>
            Issues assigned to you will appear here.
          </p>
        </div>
      )}

      {assignments.length > 0 && (
        <section>
          <div className="page-header">
            <div>
              <p className="eyebrow">MY WORK</p>

              <h2>{getFilterTitle()}</h2>

              <p>
                {activeFilter === "ALL"
                  ? "Select an issue to view its details and update its progress."
                  : `Showing ${filteredAssignments.length} issue${
                      filteredAssignments.length === 1 ? "" : "s"
                    } in this category.`}
              </p>
            </div>

            <div className="view-toggle">
              <button
                type="button"
                className={
                  view === "list" ? "active" : ""
                }
                onClick={() => setView("list")}
              >
                List
              </button>

              <button
                type="button"
                className={
                  view === "map" ? "active" : ""
                }
                onClick={() => setView("map")}
              >
                Map
              </button>
            </div>

            {activeFilter !== "ALL" && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleFilter("ALL")}
              >
                Show All Issues
              </button>
            )}
          </div>

          {view === "map" &&
            filteredAssignments.length > 0 && (
              <IssueMap
                issues={filteredAssignments
                  .map(
                    (assignment) => assignment.issue
                  )
                  .filter(Boolean)}
                linkBase="/authority/issues"
              />
            )}

          {filteredAssignments.length === 0 ? (
            <div className="empty-state">
              <h3>No {getFilterTitle().toLowerCase()}.</h3>

              <p>
                There are currently no issues in this category.
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={() => handleFilter("ALL")}
              >
                View All Assigned Issues
              </button>
            </div>
          ) : view === "map" ? null : (
            <div className="complaints-list">
              {filteredAssignments.map((assignment) => {
                const issue = assignment.issue;

                if (!issue) {
                  return null;
                }

                const stage = getAssignmentStage(assignment);
                const sla = slaInfo(assignment, now);

                return (
                  <Link
                    key={assignment.id}
                    to={`/authority/issues/${issue.id}`}
                    className="complaint-card"
                  >
                    <div className="complaint-card-header">
                      <div>
                        <h2>{issue.title}</h2>

                        <p>
                          {formatStatus(issue.category)}
                        </p>
                      </div>

                      <span
                        className={`status-badge status-${issue.status
                          ?.toLowerCase()
                          .replace(/_/g, "-")}`}
                      >
                        {formatStatus(issue.status)}
                      </span>
                    </div>

                    <p className="complaint-description">
                      {issue.description ||
                        "No description provided."}
                    </p>

                    <div className="complaint-meta">
                      <span>
                        Assigned{" "}
                        {formatDate(assignment.assignedAt)}
                      </span>

                      <span>
                        {stage}
                      </span>

                      {sla && (
                        <span
                          className={`sla-chip ${
                            sla.breached
                              ? "sla-chip-breached"
                              : sla.urgent
                                ? "sla-chip-urgent"
                                : ""
                          }`}
                        >
                          ⏱ {sla.label}
                        </span>
                      )}
                    </div>

                    {(assignment.department ||
                      assignment.ward) && (
                      <div className="complaint-meta">
                        {assignment.department && (
                          <span>
                            Department:{" "}
                            {assignment.department.name}
                          </span>
                        )}

                        {assignment.ward && (
                          <span>
                            Ward: {assignment.ward.name}
                            {assignment.ward.code
                              ? ` (${assignment.ward.code})`
                              : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {issue.address && (
                      <p className="complaint-address">
                        📍 {issue.address}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}