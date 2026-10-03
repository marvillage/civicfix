import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function AdminSLA() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedIssue, setSelectedIssue] = useState(null);
  const [durationMin, setDurationMin] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  async function fetchIssues() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/issues/admin/all");

      setIssues(response.data.issues || []);
    } catch (error) {
      console.error("Fetch SLA issues error:", error);

      setError(
        error.response?.data?.message ||
          "Unable to load SLA issue data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchIssues();
  }, []);

  function formatLabel(value) {
    if (!value) return "";

    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(date) {
    if (!date) return "—";

    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getSLAState(issue) {
    if (!issue.sla) {
      return "NOT_SET";
    }

    if (issue.sla.breached || issue.status === "SLA_BREACHED") {
      return "BREACHED";
    }

    if (issue.status === "ESCALATED") {
      return "ESCALATED";
    }

    if (new Date(issue.sla.deadline) < new Date()) {
      return "OVERDUE";
    }

    return "ACTIVE";
  }

  function openCreateSLA(issue) {
    setSelectedIssue(issue);
    setDurationMin("");
    setActionMessage("");
  }

  function closeModal() {
    if (actionLoading) return;

    setSelectedIssue(null);
    setDurationMin("");
    setActionMessage("");
  }

  async function handleCreateSLA(event) {
    event.preventDefault();

    if (!selectedIssue) {
      return;
    }

    const duration = Number(durationMin);

    if (!Number.isInteger(duration) || duration <= 0) {
      setActionMessage(
        "Duration must be a positive whole number."
      );
      return;
    }

    try {
      setActionLoading(true);
      setActionMessage("");

      const response = await api.post("/sla", {
        issueId: selectedIssue.id,
        durationMin: duration,
      });

      setActionMessage(
        response.data.message ||
          "SLA created successfully."
      );

      await fetchIssues();

      setTimeout(() => {
        setSelectedIssue(null);
        setDurationMin("");
        setActionMessage("");
      }, 700);
    } catch (error) {
      console.error("Create SLA error:", error);

      setActionMessage(
        error.response?.data?.message ||
          "Unable to create SLA."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckBreaches() {
    try {
      setActionLoading(true);
      setActionMessage("");

      const response = await api.post(
        "/sla/check-breaches"
      );

      const count = response.data.breachedCount || 0;

      setActionMessage(
        count > 0
          ? `${count} issue${
              count === 1 ? "" : "s"
            } breached the SLA.`
          : "No new SLA breaches found."
      );

      await fetchIssues();
    } catch (error) {
      console.error(
        "Check SLA breaches error:",
        error
      );

      setActionMessage(
        error.response?.data?.message ||
          "Unable to check SLA breaches."
      );
    } finally {
      setActionLoading(false);
    }
  }

  const totalIssues = issues.length;
  const configuredSLAs = issues.filter(
    (issue) => issue.sla
  ).length;
  const breachedSLAs = issues.filter(
    (issue) => getSLAState(issue) === "BREACHED"
  ).length;
  const escalatedIssues = issues.filter(
    (issue) => issue.status === "ESCALATED"
  ).length;

  if (loading) {
    return (
      <div className="page">
        <Link to="/admin">
          ‹ Back to Admin Dashboard
        </Link>

        <h1>Manage SLA</h1>
        <p>Loading SLA data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Link to="/admin">
          ‹ Back to Admin Dashboard
        </Link>

        <h1>Manage SLA</h1>

        <div className="form-error">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/admin">
          ‹ Back to Admin Dashboard
        </Link>

        <p className="eyebrow">
          ADMINISTRATION
        </p>

        <h1>SLA Management</h1>

        <p>
          Set service-level deadlines and monitor
          breached civic issues.
        </p>
      </div>

      <div className="details-card">
        <p className="eyebrow">SLA OVERVIEW</p>

        <div className="issue-meta">
          <span>
            Total Issues: <strong>{totalIssues}</strong>
          </span>

          <span>
            SLA Configured:{" "}
            <strong>{configuredSLAs}</strong>
          </span>

          <span>
            SLA Breached:{" "}
            <strong>{breachedSLAs}</strong>
          </span>

          <span>
            Escalated:{" "}
            <strong>{escalatedIssues}</strong>
          </span>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            onClick={handleCheckBreaches}
            disabled={actionLoading}
          >
            {actionLoading
              ? "Checking..."
              : "Check SLA Breaches"}
          </button>
        </div>

        {actionMessage && (
          <div className="form-success">
            {actionMessage}
          </div>
        )}
      </div>

      {issues.length === 0 ? (
        <div className="details-card">
          <p>No issues found.</p>
        </div>
      ) : (
        <div className="issue-list">
          {issues.map((issue) => {
            const slaState = getSLAState(issue);

            return (
              <article
                className="issue-card"
                key={issue.id}
              >
                <div className="issue-card-header">
                  <div>
                    <p className="eyebrow">
                      CIVIC ISSUE
                    </p>

                    <h2>
                      {issue.title ||
                        "Untitled Issue"}
                    </h2>
                  </div>

                  <span className="status-badge">
                    {formatLabel(issue.status)}
                  </span>
                </div>

                <div className="issue-meta">
                  <span>
                    Category:{" "}
                    {formatLabel(issue.category)}
                  </span>

                  <span>
                    Severity:{" "}
                    {formatLabel(issue.severity)}
                  </span>

                  <span>
                    Reported:{" "}
                    {formatDate(issue.createdAt)}
                  </span>
                </div>

                <div className="issue-assignment">
                  <strong>SLA Status</strong>

                  <p>
                    {slaState === "NOT_SET" &&
                      "No SLA configured"}

                    {slaState === "ACTIVE" &&
                      "Active"}

                    {slaState === "OVERDUE" &&
                      "Deadline passed — breach pending check"}

                    {slaState === "BREACHED" &&
                      "SLA Breached"}

                    {slaState === "ESCALATED" &&
                      "Escalated"}
                  </p>

                  {issue.sla && (
                    <>
                      <p>
                        Duration:{" "}
                        {issue.sla.durationMin} minutes
                      </p>

                      <p>
                        Deadline:{" "}
                        {formatDate(
                          issue.sla.deadline
                        )}
                      </p>

                      {issue.sla.breachedAt && (
                        <p>
                          Breached At:{" "}
                          {formatDate(
                            issue.sla.breachedAt
                          )}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="issue-card-actions">
                  {issue.sla ? (
                    <button
                      type="button"
                      disabled
                    >
                      SLA Configured
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        openCreateSLA(issue)
                      }
                      disabled={
                        issue.status === "CLOSED" ||
                        issue.status === "DUPLICATE"
                      }
                    >
                      Set SLA
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedIssue && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
          }}
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              position: "relative",
              zIndex: 10000,
            }}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  CREATE SLA
                </p>

                <h2>
                  {selectedIssue.title ||
                    "Civic Issue"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={actionLoading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSLA}>
              <div className="form-group">
                <label htmlFor="durationMin">
                  SLA Duration (minutes)
                </label>

                <input
                  id="durationMin"
                  type="number"
                  min="1"
                  step="1"
                  value={durationMin}
                  onChange={(event) =>
                    setDurationMin(
                      event.target.value
                    )
                  }
                  placeholder="Example: 1440"
                  disabled={actionLoading}
                />

                <small>
                  The deadline will be calculated
                  from the issue's reported time.
                </small>
              </div>

              {actionMessage && (
                <div
                  className={
                    actionMessage.includes(
                      "successfully"
                    )
                      ? "form-success"
                      : "form-error"
                  }
                >
                  {actionMessage}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={actionLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    actionLoading ||
                    !durationMin
                  }
                >
                  {actionLoading
                    ? "Creating..."
                    : "Create SLA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}