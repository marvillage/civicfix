import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import api from "../../api/axios";
import CommentsSection from "../../components/CommentsSection";
import IssueChat from "../../components/IssueChat";
import PhotoGallery from "../../components/PhotoGallery";
import {
  EmergencyBanner,
  ChronicBadge,
  ExpectedFix,
} from "../../components/IssueExtras";

export default function ComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  async function handleWithdraw() {
    if (
      !window.confirm(
        "Withdraw this report? This cannot be undone."
      )
    ) {
      return;
    }

    setWithdrawing(true);
    setWithdrawError("");

    try {
      await api.delete(`/complaints/${id}`);

      navigate("/citizen/complaints");
    } catch (error) {
      setWithdrawError(
        error.response?.data?.message ||
          "Unable to withdraw the complaint."
      );
      setWithdrawing(false);
    }
  }

  const [showVerification, setShowVerification] = useState(false);
  const [approved, setApproved] = useState(null);
  const [note, setNote] = useState("");
  const [stars, setStars] = useState(0);
  const [verifying, setVerifying] = useState(false);

  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");

  async function fetchComplaint() {
    try {
      setError("");

      const response = await api.get(`/complaints/${id}`);

      setComplaint(response.data.complaint);
    } catch (error) {
      console.error("Fetch complaint error:", error);

      setError(
        error.response?.data?.message ||
          "Unable to load complaint."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) {
      fetchComplaint();
    }
  }, [id]);

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

  function formatStatus(status) {
    return status
      ?.replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getStatusClass(status) {
    return `status-badge status-${status
      ?.toLowerCase()
      .replace(/_/g, "-")}`;
  }

  function startVerification(value) {
    setApproved(value);
    setNote("");
    setVerificationError("");
    setVerificationSuccess("");
    setShowVerification(true);
  }

  async function handleVerification(event) {
    event.preventDefault();

    if (approved === null) {
      return;
    }

    setVerifying(true);
    setVerificationError("");
    setVerificationSuccess("");

    try {
      const response = await api.patch(
        `/complaints/${id}/verify`,
        {
          approved,
          note,
          stars:
            approved && stars > 0
              ? stars
              : undefined,
        }
      );

      setVerificationSuccess(
        response.data.message ||
          "Complaint updated successfully."
      );

      setShowVerification(false);

      await fetchComplaint();
    } catch (error) {
      console.error("Verification error:", error);

      setVerificationError(
        error.response?.data?.message ||
          "Unable to update the complaint."
      );
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-block">
          <span className="spinner" />
          <span>Loading complaint…</span>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="page">
        <div className="page-header">
          <Link to="/citizen/complaints">
            ‹ Back to My Complaints
          </Link>

          <p className="eyebrow">CIVICFIX</p>

          <h1>Complaint</h1>
        </div>

        <div className="form-error">
          {error || "Complaint not found."}
        </div>
      </div>
    );
  }

  const issue = complaint.issue;

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/citizen/complaints">
          ‹ Back to My Complaints
        </Link>
      </div>

      {verificationSuccess && (
        <div className="form-success">
          {verificationSuccess}
        </div>
      )}

      {/* =====================================================
          COMPLAINT HEADER
      ===================================================== */}

      <EmergencyBanner issue={issue} />

      <section className="details-header">
        <div className="details-header-content">
          <p className="eyebrow">
            CIVIC COMPLAINT
          </p>

          <h1>
            {issue?.title || "Civic Issue"}
          </h1>

          <p>
            Submitted on{" "}
            {formatDate(complaint.createdAt)}{" "}
            <ChronicBadge issue={issue} />
          </p>
        </div>

        <span className={getStatusClass(issue?.status)}>
          {formatStatus(issue?.status)}
        </span>
      </section>

      {issue && <ExpectedFix issue={issue} />}

      {/* =====================================================
          REPORTED MEDIA
      ===================================================== */}

      {complaint.imageUrl && (
        <section className="complaint-image-section">
          <div className="section-heading">
            <p className="eyebrow">
              EVIDENCE
            </p>

            <h2>
              Reported{" "}
              {complaint.photos?.length > 1
                ? "Photos"
                : "Image"}
            </h2>
          </div>

          <PhotoGallery
            photos={
              complaint.photos?.length
                ? complaint.photos
                : [complaint.imageUrl]
            }
            alt="Reported civic issue"
          />

          {complaint.audioUrl && (
            <div className="voice-note-row">
              <span>🎙 Voice note</span>
              <audio
                controls
                src={complaint.audioUrl}
              />
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          CLASSIFICATION
      ===================================================== */}

      <section className="details-card">
        <p className="eyebrow">
          CLASSIFICATION
        </p>

        <h2>Issue Classification</h2>

        <div className="details-grid">
          <div className="detail-item">
            <span>Category</span>

            <strong>
              {formatStatus(
                issue?.category || "OTHER"
              )}
            </strong>
          </div>

          <div className="detail-item">
            <span>Severity</span>

            <strong>
              {formatStatus(
                issue?.severity || "MEDIUM"
              )}
            </strong>
          </div>

          {issue?.aiConfidence !== null &&
            issue?.aiConfidence !== undefined && (
              <div className="detail-item">
                <span>AI Confidence</span>

                <strong>
                  {Math.round(
                    issue.aiConfidence * 100
                  )}
                  %
                </strong>
              </div>
            )}

          <div className="detail-item">
            <span>Current Status</span>

            <strong>
              {formatStatus(issue?.status)}
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

        <h2>What Was Reported</h2>

        <p className="details-description">
          {complaint.description ||
            issue?.description ||
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
            {issue?.address ||
              "Address unavailable"}
          </h3>

          <p>
            Coordinates:{" "}
            {complaint.latitude},{" "}
            {complaint.longitude}
          </p>
        </div>
      </section>

      {/* =====================================================
          DEPARTMENT / WARD
      ===================================================== */}

      {(issue?.department || issue?.ward) && (
        <section className="details-card">
          <p className="eyebrow">
            ASSIGNMENT
          </p>

          <h2>Responsible Organization</h2>

          <div className="details-grid">
            {issue.department && (
              <div className="detail-item">
                <span>Department</span>

                <strong>
                  {issue.department.name}
                </strong>
              </div>
            )}

            {issue.ward && (
              <div className="detail-item">
                <span>Ward</span>

                <strong>
                  {issue.ward.name}
                  {issue.ward.code
                    ? ` (${issue.ward.code})`
                    : ""}
                </strong>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================
          SLA
      ===================================================== */}

      {issue?.sla && (
        <section className="details-card">
          <p className="eyebrow">
            SERVICE LEVEL
          </p>

          <h2>Resolution Timeline</h2>

          <div className="details-grid">
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
                  ? "SLA Breached"
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

        {issue?.statusHistory?.length > 0 ? (
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

                      <p>
                        {history.note ||
                          "Status updated."}
                      </p>

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

      {/* =====================================================
          RESOLUTION VERIFICATION
      ===================================================== */}

      {issue?.status === "RESOLVED" && (
        <section className="details-card verification-card">
          <p className="eyebrow">
            RESOLUTION
          </p>

          <h2>
            Has this issue been resolved?
          </h2>

          <p className="verification-intro">
            The authority has marked this issue
            as resolved. Please confirm whether
            the civic issue has actually been fixed.
          </p>

          {issue?.resolutionImageUrl && (
            <div className="proof-compare">
              <figure>
                <img
                  src={complaint.imageUrl}
                  alt="The issue as originally reported"
                />
                <figcaption>Your report</figcaption>
              </figure>

              <figure>
                <img
                  src={issue.resolutionImageUrl}
                  alt="The completed work photographed by the authority"
                />
                <figcaption>
                  After the work
                </figcaption>
              </figure>
            </div>
          )}

          {!showVerification && (
            <div className="verification-actions">
              <button
                type="button"
                className="verification-success-button"
                onClick={() =>
                  startVerification(true)
                }
              >
                ✓ Yes, it's resolved
              </button>

              <button
                type="button"
                className="verification-danger-button"
                onClick={() =>
                  startVerification(false)
                }
              >
                ✕ No, reopen it
              </button>
            </div>
          )}

          {showVerification && (
            <form
              onSubmit={handleVerification}
              className="verification-form"
            >
              {approved && (
                <div className="form-group">
                  <label>
                    How satisfied are you with the fix?
                  </label>

                  <div
                    className="star-input"
                    role="radiogroup"
                    aria-label="Satisfaction rating"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={
                          value <= stars
                            ? "star-button star-on"
                            : "star-button"
                        }
                        onClick={() =>
                          setStars(value)
                        }
                        aria-label={`${value} star${value > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}

                    {stars > 0 && (
                      <span className="star-label">
                        {stars}/5
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="verification-form-header">
                <h3>
                  {approved
                    ? "Confirm resolution"
                    : "Reopen complaint"}
                </h3>

                <p>
                  {approved
                    ? "Confirm that the civic issue has been properly resolved."
                    : "Tell the authority why the issue is still unresolved."}
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="verificationNote">
                  {approved
                    ? "Additional Note"
                    : "Reason for Reopening"}
                </label>

                <textarea
                  id="verificationNote"
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  placeholder={
                    approved
                      ? "Optional note"
                      : "Please explain what is still wrong..."
                  }
                  rows={4}
                  required={!approved}
                />
              </div>

              {verificationError && (
                <div className="form-error">
                  {verificationError}
                </div>
              )}

              <div className="verification-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowVerification(false);
                    setVerificationError("");
                  }}
                  disabled={verifying}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    approved
                      ? "verification-success-button"
                      : "verification-danger-button"
                  }
                  disabled={verifying}
                >
                  {verifying
                    ? "Updating..."
                    : approved
                    ? "Confirm Resolution"
                    : "Reopen Complaint"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {issue &&
        ["REPORTED", "AI_VERIFIED"].includes(
          issue.status
        ) &&
        !issue.assignments?.some(
          (assignment) => !assignment.completedAt
        ) && (
          <section className="details-card">
            <h2>Withdraw this report</h2>

            <p className="verification-intro">
              Filed by mistake, or already fixed? You
              can withdraw this report while no
              authority has started working on it.
            </p>

            {withdrawError && (
              <div className="form-error">
                {withdrawError}
              </div>
            )}

            <button
              type="button"
              className="verification-danger-button"
              onClick={handleWithdraw}
              disabled={withdrawing}
            >
              {withdrawing
                ? "Withdrawing…"
                : "Withdraw report"}
            </button>
          </section>
        )}

      {issue && <IssueChat issueId={issue.id} />}

      {issue && (
        <CommentsSection issueId={issue.id} />
      )}
    </div>
  );
}