import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

function getAssignmentStatus(assignment) {
  const issueStatus = assignment.issue?.status;

  if (assignment.completedAt || issueStatus === "RESOLVED") {
    return "RESOLVED";
  }

  if (issueStatus === "ESCALATED") {
    return "ESCALATED";
  }

  if (issueStatus === "SLA_BREACHED") {
    return "SLA BREACHED";
  }

  if (issueStatus === "IN_PROGRESS") {
    return "IN PROGRESS";
  }

  if (assignment.acceptedAt) {
    return "ACCEPTED";
  }

  return "PENDING";
}

function getStatusClass(status) {
  switch (status) {
    case "RESOLVED":
      return "status-resolved";

    case "IN PROGRESS":
      return "status-progress";

    case "ACCEPTED":
      return "status-accepted";

    case "ESCALATED":
      return "status-escalated";

    case "SLA BREACHED":
      return "status-breached";

    default:
      return "status-pending";
  }
}

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getSlaStatus(sla) {
  if (!sla) return "NOT SET";

  if (sla.breached) return "BREACHED";

  if (new Date(sla.deadline) < new Date()) {
    return "OVERDUE";
  }

  return "ACTIVE";
}

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  async function fetchAssignments() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/assignments/all");

      setAssignments(response.data.assignments || []);
    } catch (err) {
      console.error("Failed to fetch assignments:", err);

      setError(
        err.response?.data?.message ||
          "Failed to load assignments"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAssignments();
  }, []);

  const filteredAssignments = useMemo(() => {
    if (filter === "ALL") {
      return assignments;
    }

    return assignments.filter(
      (assignment) =>
        getAssignmentStatus(assignment) === filter
    );
  }, [assignments, filter]);

  const stats = useMemo(() => {
    const result = {
      total: assignments.length,
      pending: 0,
      accepted: 0,
      inProgress: 0,
      resolved: 0,
      escalated: 0,
      slaBreached: 0,
    };

    assignments.forEach((assignment) => {
      const status = getAssignmentStatus(assignment);

      if (status === "PENDING") result.pending++;
      if (status === "ACCEPTED") result.accepted++;
      if (status === "IN PROGRESS") result.inProgress++;
      if (status === "RESOLVED") result.resolved++;
      if (status === "ESCALATED") result.escalated++;
      if (status === "SLA BREACHED") result.slaBreached++;
    });

    return result;
  }, [assignments]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          Loading assignments...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* HEADER */}
        <div className="admin-page-header">
          <div>
            <Link
              to="/admin"
              className="admin-back-link"
            >
              ‹ Back to Dashboard
            </Link>

            <h1>Assignments</h1>

            <p>
              Monitor issue assignments and authority
              progress.
            </p>
          </div>

          <button
            className="admin-refresh-btn"
            onClick={fetchAssignments}
          >
            ↻ Refresh
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {/* STATS */}
        <div className="admin-stats-grid">
          <button
            className={`admin-stat-card ${
              filter === "ALL" ? "active" : ""
            }`}
            onClick={() => setFilter("ALL")}
          >
            <span>Total</span>
            <strong>{stats.total}</strong>
          </button>

          <button
            className={`admin-stat-card ${
              filter === "PENDING" ? "active" : ""
            }`}
            onClick={() => setFilter("PENDING")}
          >
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </button>

          <button
            className={`admin-stat-card ${
              filter === "ACCEPTED" ? "active" : ""
            }`}
            onClick={() => setFilter("ACCEPTED")}
          >
            <span>Accepted</span>
            <strong>{stats.accepted}</strong>
          </button>

          <button
            className={`admin-stat-card ${
              filter === "IN PROGRESS" ? "active" : ""
            }`}
            onClick={() => setFilter("IN PROGRESS")}
          >
            <span>In Progress</span>
            <strong>{stats.inProgress}</strong>
          </button>

          <button
            className={`admin-stat-card ${
              filter === "RESOLVED" ? "active" : ""
            }`}
            onClick={() => setFilter("RESOLVED")}
          >
            <span>Resolved</span>
            <strong>{stats.resolved}</strong>
          </button>

          <button
            className={`admin-stat-card ${
              filter === "ESCALATED" ? "active" : ""
            }`}
            onClick={() => setFilter("ESCALATED")}
          >
            <span>Escalated</span>
            <strong>{stats.escalated}</strong>
          </button>

          <button
            className={`admin-stat-card ${
              filter === "SLA BREACHED" ? "active" : ""
            }`}
            onClick={() => setFilter("SLA BREACHED")}
          >
            <span>SLA Breached</span>
            <strong>{stats.slaBreached}</strong>
          </button>
        </div>

        {/* TABLE */}
        <div className="admin-section">
          <div className="admin-section-header">
            <div>
              <h2>Assignment Records</h2>

              <p>
                Showing {filteredAssignments.length} of{" "}
                {assignments.length} assignments
              </p>
            </div>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="admin-empty-state">
              <h3>No assignments found</h3>

              <p>
                There are no assignments matching the
                selected filter.
              </p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Authority</th>
                    <th>Department</th>
                    <th>Ward</th>
                    <th>Assigned</th>
                    <th>Status</th>
                    <th>SLA</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAssignments.map(
                    (assignment) => {
                      const status =
                        getAssignmentStatus(
                          assignment
                        );

                      const slaStatus =
                        getSlaStatus(
                          assignment.issue?.sla
                        );

                      return (
                        <tr key={assignment.id}>
                          {/* ISSUE */}
                          <td>
                            <div className="assignment-issue">
                              <Link
                                to={`/authority/issues/${assignment.issue?.id}`}
                                className="assignment-issue-link"
                              >
                                {assignment.issue?.title ||
                                  "Untitled Issue"}
                              </Link>

                              <span>
                                {assignment.issue
                                  ?.category || "—"}
                              </span>
                            </div>
                          </td>

                          {/* AUTHORITY */}
                          <td>
                            <div className="assignment-person">
                              <strong>
                                {assignment.authority
                                  ?.name || "Unassigned"}
                              </strong>

                              <span>
                                {assignment.authority
                                  ?.email || "—"}
                              </span>
                            </div>
                          </td>

                          {/* DEPARTMENT */}
                          <td>
                            {assignment.department
                              ?.name ||
                              assignment.issue
                                ?.department?.name ||
                              "—"}
                          </td>

                          {/* WARD */}
                          <td>
                            {assignment.ward?.name ||
                              assignment.issue?.ward
                                ?.name ||
                              "—"}
                          </td>

                          {/* ASSIGNED DATE */}
                          <td>
                            {formatDate(
                              assignment.assignedAt
                            )}
                          </td>

                          {/* STATUS */}
                          <td>
                            <span
                              className={`assignment-status ${getStatusClass(
                                status
                              )}`}
                            >
                              {status}
                            </span>
                          </td>

                          {/* SLA */}
                          <td>
                            <div className="assignment-sla">
                              <span
                                className={`sla-badge sla-${slaStatus
                                  .toLowerCase()
                                  .replace(
                                    " ",
                                    "-"
                                  )}`}
                              >
                                {slaStatus}
                              </span>

                              {assignment.issue?.sla && (
                                <small>
                                  Deadline:{" "}
                                  {formatDate(
                                    assignment.issue
                                      .sla.deadline
                                  )}
                                </small>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .admin-page {
          min-height: 100vh;
          background: var(--bg);
          padding: 32px;
        }

        .admin-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .admin-page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
        }

        .admin-back-link {
          display: inline-block;
          margin-bottom: 12px;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }

        .admin-back-link:hover {
          color: var(--text);
        }

        .admin-page-header h1 {
          margin: 0 0 6px;
          font-size: 30px;
          color: var(--text);
        }

        .admin-page-header p {
          margin: 0;
          color: var(--text-muted);
        }

        .admin-refresh-btn {
          border: none;
          background: var(--primary);
          color: var(--primary-ink);
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .admin-refresh-btn:hover {
          background: var(--primary-dark);
        }

        .admin-error {
          background: var(--danger-soft);
          color: var(--danger);
          border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 20px;
        }

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(150px, 1fr)
          );
          gap: 14px;
          margin-bottom: 28px;
        }

        .admin-stat-card {
          text-align: left;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 12px;
          padding: 18px;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .admin-stat-card:hover {
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }

        .admin-stat-card.active {
          border-color: var(--primary);
          box-shadow: 0 0 0 1px var(--primary);
        }

        .admin-stat-card span {
          display: block;
          color: var(--text-muted);
          font-size: 13px;
          margin-bottom: 8px;
        }

        .admin-stat-card strong {
          display: block;
          color: var(--text);
          font-family: var(--font-data);
          font-variant-numeric: tabular-nums;
          font-size: 28px;
        }

        .admin-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }

        .admin-section-header {
          padding: 22px 24px;
          border-bottom: 1px solid var(--border);
        }

        .admin-section-header h2 {
          margin: 0 0 5px;
          font-size: 20px;
          color: var(--text);
        }

        .admin-section-header p {
          margin: 0;
          color: var(--text-muted);
          font-size: 14px;
        }

        .admin-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        .admin-table th {
          background: var(--surface-soft);
          color: var(--text-muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
          text-align: left;
          padding: 13px 16px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }

        .admin-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 14px;
          vertical-align: middle;
        }

        .admin-table tbody tr:hover {
          background: var(--surface-soft);
        }

        .assignment-issue {
          display: flex;
          flex-direction: column;
          gap: 5px;
          max-width: 260px;
        }

        .assignment-issue-link {
          color: var(--text);
          text-decoration: none;
          font-weight: 600;
        }

        .assignment-issue-link:hover {
          text-decoration: underline;
        }

        .assignment-issue span {
          color: var(--text-muted);
          font-size: 12px;
        }

        .assignment-person {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .assignment-person strong {
          color: var(--text);
          font-size: 14px;
        }

        .assignment-person span {
          color: var(--text-muted);
          font-size: 12px;
        }

        .assignment-status,
        .sla-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-pending {
          background: #241d12;
          color: #d9a253;
        }

        .status-accepted {
          background: #1b2436;
          color: #9db4e8;
        }

        .status-progress {
          background: #2a2110;
          color: #ffb224;
        }

        .status-resolved {
          background: #132818;
          color: #63cf77;
        }

        .status-escalated {
          background: #2f1420;
          color: #f27fa5;
        }

        .status-breached {
          background: #2f1416;
          color: #ff8a8e;
        }

        .assignment-sla {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .assignment-sla small {
          color: var(--text-muted);
          font-size: 11px;
          white-space: nowrap;
        }

        .sla-not-set {
          background: #1d222b;
          color: #8a93a0;
        }

        .sla-active {
          background: #132818;
          color: #63cf77;
        }

        .sla-overdue {
          background: #241d12;
          color: #d9a253;
        }

        .sla-breached {
          background: #2f1416;
          color: #ff8a8e;
        }

        .admin-empty-state {
          text-align: center;
          padding: 70px 20px;
        }

        .admin-empty-state h3 {
          margin: 0 0 8px;
          color: var(--text);
        }

        .admin-empty-state p {
          margin: 0;
          color: var(--text-muted);
        }

        .admin-loading {
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 16px;
        }

        @media (max-width: 700px) {
          .admin-page {
            padding: 18px;
          }

          .admin-page-header {
            flex-direction: column;
          }

          .admin-refresh-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}