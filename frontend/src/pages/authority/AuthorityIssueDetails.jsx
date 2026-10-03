import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/axios";
import CommentsSection from "../../components/CommentsSection";
import IssueChat from "../../components/IssueChat";
import PhotoGallery from "../../components/PhotoGallery";
import {
  EmergencyBanner,
  ChronicBadge,
  VoiceNotes,
} from "../../components/IssueExtras";

export default function AuthorityIssueDetails() {
  const { id } = useParams();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  const [resolveNote, setResolveNote] = useState("");
  const [resolveProof, setResolveProof] = useState(null);

  const [progressNote, setProgressNote] = useState("");
  const [progressPhoto, setProgressPhoto] = useState(null);
  const [postingProgress, setPostingProgress] = useState(false);

  async function fetchIssue() {
    try {
      setError("");

      const response = await api.get(`/issues/${id}`);

      setIssue(response.data.issue);
    } catch (error) {
      console.error("Fetch issue error:", error);

      setError(
        error.response?.data?.message ||
          "Unable to load issue."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      fetchIssue();
    }
  }, [id]);

  function formatStatus(status) {
    return status
      ?.replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  }

  function formatDate(date) {
    if (!date) {
      return "Not available";
    }

    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getStatusClass(status) {
    return `status-badge status-${status
      ?.toLowerCase()
      .replace(/_/g, "-")}`;
  }

  const assignment =
    issue?.assignments?.[0] || null;

  async function performAssignmentAction(
    action,
    successMessage,
    body
  ) {
    if (!assignment) {
      setActionError(
        "No assignment found for this issue."
      );
      return;
    }

    setActionLoading(true);
    setActionError("");
    setSuccess("");

    try {
      const response = await api.patch(
        `/assignments/${assignment.id}/${action}`,
        body
      );

      setSuccess(
        response.data.message ||
          successMessage
      );

      await fetchIssue();
    } catch (error) {
      console.error(
        `${action} assignment error:`,
        error
      );

      setActionError(
        error.response?.data?.message ||
          `Unable to ${action} assignment.`
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handleAccept() {
  console.log("ACCEPT BUTTON CLICKED");
  console.log("CURRENT ASSIGNMENT:", assignment);

  performAssignmentAction(
    "accept",
    "Assignment accepted successfully."
  );
}

  function handleStart() {
    performAssignmentAction(
      "start",
      "Work started successfully."
    );
  }

  async function handleProgressUpdate(event) {
    event.preventDefault();

    if (!assignment || !progressNote.trim()) {
      return;
    }

    setPostingProgress(true);
    setActionError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("note", progressNote.trim());

    if (progressPhoto) {
      formData.append("photo", progressPhoto);
    }

    try {
      await api.post(
        `/assignments/${assignment.id}/progress`,
        formData
      );

      setSuccess("Progress update posted.");
      setProgressNote("");
      setProgressPhoto(null);

      await fetchIssue();
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
          "Unable to post the progress update."
      );
    } finally {
      setPostingProgress(false);
    }
  }

  function handleResolve(event) {
    event.preventDefault();

    const formData = new FormData();

    if (resolveNote.trim()) {
      formData.append("note", resolveNote.trim());
    }

    if (resolveProof) {
      formData.append("proof", resolveProof);
    }

    performAssignmentAction(
      "resolve",
      "Issue resolved successfully.",
      formData
    );

    setResolveNote("");
    setResolveProof(null);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-block">
          <span className="spinner" />
          <span>Loading issue…</span>
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="page">
        <div className="page-header">
          <Link to="/authority">
            ‹ Back to Authority Dashboard
          </Link>

          <p className="eyebrow">
            AUTHORITY ISSUE
          </p>

          <h1>Issue</h1>
        </div>

        <div className="form-error">
          {error || "Issue not found."}
        </div>
      </div>
    );
  }

  const isAccepted =
    !!assignment?.acceptedAt;

  const isCompleted =
    !!assignment?.completedAt;

  const issueStatus = issue.status;

  const canAccept =
    assignment &&
    !isAccepted &&
    !isCompleted;

  const canStart =
    assignment &&
    isAccepted &&
    !isCompleted &&
    issueStatus === "ACKNOWLEDGED";

  const canResolve =
    assignment &&
    isAccepted &&
    !isCompleted &&
    issueStatus === "IN_PROGRESS";

  return (
    <div className="page">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="page-header">
        <Link to="/authority">
          ‹ Back to Authority Dashboard
        </Link>

        <p className="eyebrow">
          AUTHORITY ISSUE
        </p>

        <div className="issue-detail-title-row">
          <div>
            <h1>
              {issue.title || "Civic Issue"}
            </h1>

            <p>
              Reported on{" "}
              {formatDate(issue.createdAt)}{" "}
              <ChronicBadge issue={issue} />
            </p>
          </div>

          <span className={getStatusClass(issue.status)}>
            {formatStatus(issue.status)}
          </span>
        </div>
      </div>

      <EmergencyBanner issue={issue} />

      {issue.complaints?.length > 0 && (
        <section className="complaint-image-section">
          <div className="section-heading">
            <h2>Reported evidence</h2>
          </div>

          <PhotoGallery
            photos={issue.complaints.flatMap(
              (complaint) =>
                complaint.photos?.length
                  ? complaint.photos
                  : [complaint.imageUrl]
            )}
            alt={issue.title}
          />

          <VoiceNotes complaints={issue.complaints} />
        </section>
      )}

      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {success && (
        <div className="form-success">
          {success}
        </div>
      )}

      {actionError && (
        <div className="form-error">
          {actionError}
        </div>
      )}

      {/* =====================================================
          ASSIGNMENT & WORKFLOW
      ===================================================== */}

      {assignment && (
        <section className="details-card assignment-card">
          <p className="eyebrow">
            ASSIGNMENT
          </p>

          <div className="assignment-header">
            <div>
              <h2>
                {assignment.authority?.name ||
                  "Assigned Authority"}
              </h2>

              <p>
                {assignment.authority?.email ||
                  "Authority email unavailable"}
              </p>
            </div>

            <span
              className={
                isCompleted
                  ? "workflow-badge workflow-complete"
                  : isAccepted
                  ? "workflow-badge workflow-active"
                  : "workflow-badge workflow-pending"
              }
            >
              {isCompleted
                ? "Completed"
                : isAccepted
                ? "Accepted"
                : "Pending Acceptance"}
            </span>
          </div>

          <div className="details-grid">
            <div className="detail-item">
              <span>Assigned</span>

              <strong>
                {formatDate(
                  assignment.assignedAt
                )}
              </strong>
            </div>

            <div className="detail-item">
              <span>Acceptance</span>

              <strong>
                {isAccepted
                  ? "Accepted"
                  : "Pending"}
              </strong>
            </div>

            {assignment.acceptedAt && (
              <div className="detail-item">
                <span>Accepted At</span>

                <strong>
                  {formatDate(
                    assignment.acceptedAt
                  )}
                </strong>
              </div>
            )}

            {assignment.completedAt && (
              <div className="detail-item">
                <span>Completed At</span>

                <strong>
                  {formatDate(
                    assignment.completedAt
                  )}
                </strong>
              </div>
            )}

            {assignment.department && (
              <div className="detail-item">
                <span>Department</span>

                <strong>
                  {assignment.department.name}
                </strong>
              </div>
            )}

            {assignment.ward && (
              <div className="detail-item">
                <span>Ward</span>

                <strong>
                  {assignment.ward.name}
                  {assignment.ward.code
                    ? ` (${assignment.ward.code})`
                    : ""}
                </strong>
              </div>
            )}
          </div>

          <div className="assignment-actions">
            {canAccept && (
              <button
                type="button"
                className="workflow-primary-button"
                onClick={handleAccept}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Processing..."
                  : "Accept Assignment"}
              </button>
            )}

            {canStart && (
              <button
                type="button"
                className="workflow-primary-button"
                onClick={handleStart}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Starting..."
                  : "Start Work"}
              </button>
            )}

            {canResolve && (
              <form
                onSubmit={handleProgressUpdate}
                className="resolve-form progress-form"
              >
                <div className="form-group">
                  <label htmlFor="progress-note">
                    Post a progress update
                  </label>

                  <textarea
                    id="progress-note"
                    value={progressNote}
                    onChange={(event) =>
                      setProgressNote(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Material delivered, patching starts tomorrow morning..."
                    rows={3}
                    disabled={postingProgress}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="progress-photo">
                    Photo (optional)
                  </label>

                  <input
                    id="progress-photo"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setProgressPhoto(
                        event.target.files?.[0] ||
                          null
                      )
                    }
                    disabled={postingProgress}
                  />
                </div>

                <button
                  type="submit"
                  className="workflow-primary-button"
                  disabled={
                    postingProgress ||
                    !progressNote.trim()
                  }
                >
                  {postingProgress
                    ? "Posting…"
                    : "Post update"}
                </button>
              </form>
            )}

            {canResolve && (
              <form
                onSubmit={handleResolve}
                className="resolve-form"
              >
                <div className="form-group">
                  <label htmlFor="resolve-note">
                    Resolution Note
                  </label>

                  <textarea
                    id="resolve-note"
                    value={resolveNote}
                    onChange={(event) =>
                      setResolveNote(
                        event.target.value
                      )
                    }
                    placeholder="Describe the work completed..."
                    rows={4}
                    disabled={actionLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="resolve-proof">
                    Photo of the completed work
                  </label>

                  <input
                    id="resolve-proof"
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      setResolveProof(
                        event.target.files?.[0] || null
                      )
                    }
                    disabled={actionLoading}
                  />

                  {resolveProof && (
                    <p className="detail-label">
                      Selected: {resolveProof.name}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="workflow-success-button"
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? "Resolving..."
                    : "✓ Resolve Issue"}
                </button>
              </form>
            )}

            {!canAccept &&
              !canStart &&
              !canResolve &&
              !isCompleted && (
                <div className="workflow-info">
                  <strong>
                    No action available
                  </strong>

                  <p>
                    The issue is currently in a
                    state where no workflow action
                    can be performed.
                  </p>
                </div>
              )}

            {isCompleted && (
              <div className="workflow-complete-message">
                <span>✓</span>

                <div>
                  <strong>
                    Assignment completed
                  </strong>

                  <p>
                    This issue has been marked as
                    resolved and is now awaiting
                    citizen verification.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {!assignment && (
        <section className="details-card">
          <p className="eyebrow">
            ASSIGNMENT
          </p>

          <div className="workflow-info">
            <strong>
              Not assigned yet
            </strong>

            <p>
              This issue has not been assigned to
              an authority.
            </p>
          </div>
        </section>
      )}

      {/* =====================================================
          ISSUE INFORMATION
      ===================================================== */}

      <section className="details-card">
        <p className="eyebrow">
          ISSUE INFORMATION
        </p>

        <h2>Issue Overview</h2>

        <div className="details-grid">
          <div className="detail-item">
            <span>Category</span>

            <strong>
              {formatStatus(issue.category)}
            </strong>
          </div>

          <div className="detail-item">
            <span>Severity</span>

            <strong>
              {formatStatus(issue.severity)}
            </strong>
          </div>

          <div className="detail-item">
            <span>Reported</span>

            <strong>
              {formatDate(issue.createdAt)}
            </strong>
          </div>

          <div className="detail-item">
            <span>Complaints</span>

            <strong>
              {issue._count?.complaints || 0}
            </strong>
          </div>

          <div className="detail-item">
            <span>Upvotes</span>

            <strong>
              {issue._count?.upvotes || 0}
            </strong>
          </div>
        </div>
      </section>

      {/* =====================================================
          DESCRIPTION
      ===================================================== */}

      <section className="details-card">
        <p className="eyebrow">
          DESCRIPTION
        </p>

        <h2>Reported Problem</h2>

        <p className="details-description">
          {issue.description ||
            "No description provided."}
        </p>
      </section>

      {/* =====================================================
          LOCATION
      ===================================================== */}

      <section className="details-card">
        <p className="eyebrow">
          LOCATION
        </p>

        <h2>Issue Location</h2>

        <div className="location-box">
          <h3>
            📍{" "}
            {issue.address ||
              "Address unavailable"}
          </h3>

          <p>
            Coordinates: {issue.latitude},{" "}
            {issue.longitude}
          </p>
        </div>
      </section>

      {/* =====================================================
          DEPARTMENT
      ===================================================== */}

      {issue.department && (
        <section className="details-card">
          <p className="eyebrow">
            DEPARTMENT
          </p>

          <h2>Responsible Department</h2>

          <div className="organization-highlight">
            <strong>
              {issue.department.name}
            </strong>

            <span>
              Assigned department
            </span>
          </div>
        </section>
      )}

      {/* =====================================================
          WARD
      ===================================================== */}

      {issue.ward && (
        <section className="details-card">
          <p className="eyebrow">
            WARD
          </p>

          <h2>Service Area</h2>

          <div className="organization-highlight">
            <strong>
              {issue.ward.name}
            </strong>

            {issue.ward.code && (
              <span>
                Ward Code: {issue.ward.code}
              </span>
            )}
          </div>
        </section>
      )}

      {/* =====================================================
          SLA
      ===================================================== */}

      {issue.sla && (
        <section className="details-card">
          <p className="eyebrow">
            SERVICE LEVEL
          </p>

          <h2>SLA Information</h2>

          <div className="details-grid">
            <div className="detail-item">
              <span>Resolution Time</span>

              <strong>
                {issue.sla.durationMin} minutes
              </strong>
            </div>

            <div className="detail-item">
              <span>Deadline</span>

              <strong>
                {formatDate(
                  issue.sla.deadline
                )}
              </strong>
            </div>

            <div className="detail-item">
              <span>SLA Status</span>

              <strong
                className={
                  issue.sla.breached
                    ? "text-danger"
                    : "text-success"
                }
              >
                {issue.sla.breached
                  ? "Breached"
                  : "Within SLA"}
              </strong>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          STATUS TIMELINE
      ===================================================== */}

      <section className="details-card">
        <p className="eyebrow">
          PROGRESS
        </p>

        <h2>Status Timeline</h2>

        {issue.statusHistory?.length > 0 ? (
          <div className="timeline">
            {issue.statusHistory.map(
              (history, index) => {
                const isLast =
                  index ===
                  issue.statusHistory.length - 1;

                return (
                  <div
                    className={`timeline-item ${
                      isLast
                        ? "timeline-item-last"
                        : ""
                    }`}
                    key={history.id}
                  >
                    <div className="timeline-marker">
                      {isLast ? "●" : "✓"}
                    </div>

                    <div className="timeline-content">
                      <div className="timeline-title-row">
                        <h3>
                          {formatStatus(
                            history.status
                          )}
                        </h3>

                        {isLast && (
                          <span className="timeline-current">
                            Current
                          </span>
                        )}
                      </div>

                      {history.note && (
                        <p>
                          {history.note}
                        </p>
                      )}

                      {!history.note && (
                        <p>
                          Status updated.
                        </p>
                      )}

                      {history.imageUrl && (
                        <img
                          className="timeline-photo"
                          src={history.imageUrl}
                          alt="Photo attached to this update"
                        />
                      )}

                      <small>
                        {formatDate(
                          history.createdAt
                        )}
                      </small>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        ) : (
          <div className="empty-inline">
            <p>
              No status history available.
            </p>
          </div>
        )}
      </section>

      {issue.resolutionImageUrl && (
        <section className="complaint-image-section">
          <div className="section-heading">
            <h2>Resolution proof</h2>
          </div>

          <img
            className="complaint-image"
            src={issue.resolutionImageUrl}
            alt="Photo of the completed work"
          />
        </section>
      )}

      <IssueChat issueId={issue.id} />

      <CommentsSection issueId={issue.id} />
    </div>
  );
}