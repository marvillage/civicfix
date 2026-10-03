import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function AdminIssues() {
  const [issues, setIssues] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [wards, setWards] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [assigningIssue, setAssigningIssue] = useState(null);
  const [selectedAuthority, setSelectedAuthority] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedWard, setSelectedWard] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [
        issuesResponse,
        authoritiesResponse,
        departmentsResponse,
        wardsResponse,
      ] = await Promise.all([
        api.get("/issues/admin/all"),
        api.get("/organization/authorities"),
        api.get("/organization/departments"),
        api.get("/organization/wards"),
      ]);

      setIssues(issuesResponse.data.issues || []);
      setAuthorities(authoritiesResponse.data.authorities || []);
      setDepartments(departmentsResponse.data.departments || []);
      setWards(wardsResponse.data.wards || []);
    } catch (error) {
      console.error("Fetch admin issues error:", error);

      setError(
        error.response?.data?.message ||
          "Unable to load admin issue data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
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

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getActiveAssignment(issue) {
    if (!issue?.assignments?.length) {
      return null;
    }

    return (
      issue.assignments.find(
        (assignment) => !assignment.completedAt
      ) || null
    );
  }

  function openAssignment(event, issue) {
    // Important: prevent any parent/link/card handler
    // from interfering with the button click.
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    console.log("ASSIGN BUTTON CLICKED", issue.id);

    setAssigningIssue(issue);
    setSelectedAuthority("");
    setSelectedDepartment("");
    setSelectedWard("");
    setActionMessage("");
  }

  function closeAssignment() {
    if (actionLoading) return;

    setAssigningIssue(null);
    setSelectedAuthority("");
    setSelectedDepartment("");
    setSelectedWard("");
    setActionMessage("");
  }

  async function handleAssign(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!assigningIssue) {
      setActionMessage("No issue selected.");
      return;
    }

    if (!selectedAuthority) {
      setActionMessage("Please select an authority.");
      return;
    }

    try {
      setActionLoading(true);
      setActionMessage("");

      const response = await api.post("/assignments", {
        issueId: assigningIssue.id,
        authorityId: selectedAuthority,
        departmentId: selectedDepartment || undefined,
        wardId: selectedWard || undefined,
      });

      setActionMessage(
        response.data.message ||
          "Issue assigned successfully."
      );

      await fetchData();

      setTimeout(() => {
        setAssigningIssue(null);
        setSelectedAuthority("");
        setSelectedDepartment("");
        setSelectedWard("");
        setActionMessage("");
      }, 700);
    } catch (error) {
      console.error("Assign issue error:", error);

      setActionMessage(
        error.response?.data?.message ||
          "Unable to assign the issue."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <Link to="/admin">
          ‹ Back to Admin Dashboard
        </Link>

        <h1>Manage Issues</h1>
        <p>Loading issues...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Link to="/admin">
          ‹ Back to Admin Dashboard
        </Link>

        <h1>Manage Issues</h1>

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

        <h1>Manage Issues</h1>

        <p>
          Review CivicFix issues and assign
          them to authorities.
        </p>
      </div>

      <div className="details-card">
        <p className="eyebrow">
          OVERVIEW
        </p>

        <h2>
          {issues.length}{" "}
          {issues.length === 1 ? "Issue" : "Issues"}
        </h2>
      </div>

      {issues.length === 0 ? (
        <div className="details-card">
          <p>No issues found.</p>
        </div>
      ) : (
        <div className="issue-list">
          {issues.map((issue) => {
            const assignment =
              getActiveAssignment(issue);

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

                {issue.description && (
                  <p className="issue-description">
                    {issue.description}
                  </p>
                )}

                <div className="issue-assignment">
                  <strong>
                    Assigned Authority
                  </strong>

                  {assignment?.authority ? (
                    <p>
                      {assignment.authority.name}
                      {" — "}
                      {assignment.authority.email}
                    </p>
                  ) : (
                    <p>Not assigned</p>
                  )}
                </div>

                <div
                  className="issue-card-actions"
                  style={{
                    position: "relative",
                    zIndex: 20,
                  }}
                >
                  <Link
                    to={`/admin/issues/${issue.id}`}
                  >
                    <button type="button">
                      View Details
                    </button>
                  </Link>

                  {issue.status !== "CLOSED" &&
                    issue.status !== "DUPLICATE" && (
                      <button
                        type="button"
                        style={{
                          position: "relative",
                          zIndex: 30,
                          pointerEvents: "auto",
                          cursor: "pointer",
                        }}
                        onClick={(event) =>
                          openAssignment(event, issue)
                        }
                        onMouseDown={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        {assignment
                          ? "Reassign Authority"
                          : "Assign Authority"}
                      </button>
                    )}

                  {issue.status !== "CLOSED" &&
                    issue.status !== "DUPLICATE" && (
                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          position: "relative",
                          zIndex: 30,
                        }}
                        onClick={async (event) => {
                          event.stopPropagation();

                          const originalIssueId =
                            window.prompt(
                              "Paste the ID of the ORIGINAL issue this one duplicates:"
                            );

                          if (!originalIssueId) {
                            return;
                          }

                          try {
                            await api.post(
                              `/issues/${issue.id}/duplicate`,
                              {
                                originalIssueId:
                                  originalIssueId.trim(),
                              }
                            );

                            await fetchData();
                          } catch (error) {
                            window.alert(
                              error.response?.data
                                ?.message ||
                                "Unable to mark as duplicate."
                            );
                          }
                        }}
                      >
                        Mark Duplicate
                      </button>
                    )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ASSIGNMENT MODAL */}
      {assigningIssue && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeAssignment();
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
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "relative",
              zIndex: 10000,
            }}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  {getActiveAssignment(assigningIssue)
                    ? "REASSIGN ISSUE"
                    : "ASSIGN ISSUE"}
                </p>

                <h2>
                  {assigningIssue.title ||
                    "Civic Issue"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeAssignment}
                disabled={actionLoading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssign}>
              <div className="form-group">
                <label htmlFor="authority">
                  Select Authority
                </label>

                <select
                  id="authority"
                  value={selectedAuthority}
                  onChange={(event) =>
                    setSelectedAuthority(
                      event.target.value
                    )
                  }
                  disabled={actionLoading}
                >
                  <option value="">
                    Select an authority
                  </option>

                  {authorities.map((authority) => (
                    <option
                      key={authority.id}
                      value={authority.id}
                    >
                      {authority.name} —{" "}
                      {authority.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="department">
                  Select Department
                </label>

                <select
                  id="department"
                  value={selectedDepartment}
                  onChange={(event) =>
                    setSelectedDepartment(
                      event.target.value
                    )
                  }
                  disabled={actionLoading}
                >
                  <option value="">
                    Select a department
                  </option>

                  {departments.map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="ward">
                  Select Ward
                </label>

                <select
                  id="ward"
                  value={selectedWard}
                  onChange={(event) =>
                    setSelectedWard(
                      event.target.value
                    )
                  }
                  disabled={actionLoading}
                >
                  <option value="">
                    Select a ward
                  </option>

                  {wards.map((ward) => (
                    <option
                      key={ward.id}
                      value={ward.id}
                    >
                      {ward.name} ({ward.code})
                    </option>
                  ))}
                </select>
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
                  onClick={closeAssignment}
                  disabled={actionLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    actionLoading ||
                    !selectedAuthority
                  }
                >
                  {actionLoading
                    ? "Assigning..."
                    : getActiveAssignment(
                        assigningIssue
                      )
                    ? "Reassign Issue"
                    : "Assign Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}