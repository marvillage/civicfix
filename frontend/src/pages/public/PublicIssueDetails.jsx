import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { issueShareUrl } from "../../api/axios";
import CommentsSection from "../../components/CommentsSection";
import PhotoGallery from "../../components/PhotoGallery";
import {
  EmergencyBanner,
  ChronicBadge,
  ExpectedFix,
  VoiceNotes,
} from "../../components/IssueExtras";

export default function PublicIssueDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [upvoting, setUpvoting] = useState(false);
  const [upvoteMessage, setUpvoteMessage] = useState("");
  const [upvoteError, setUpvoteError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    async function fetchIssue() {
      try {
        const response = await api.get(`/issues/${id}`);

        setIssue(response.data.issue || response.data);
      } catch (error) {
        console.error("Fetch public issue error:", error);

        setError(
          error.response?.data?.message ||
            "Unable to load this issue."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchIssue();
  }, [id]);

  function formatStatus(status) {
    return (
      status
        ?.replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase()) ||
      "Unknown"
    );
  }

  function formatDate(date) {
    if (!date) return "Unknown";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(date) {
    if (!date) return "Unknown";

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

  async function handleUpvote() {
    setUpvoteMessage("");
    setUpvoteError("");

    const token = localStorage.getItem("civicfix_token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setUpvoting(true);

      await api.post(`/issues/${id}/upvote`);

      setUpvoteMessage("Issue upvoted successfully.");

      setIssue((currentIssue) => ({
        ...currentIssue,
        _count: {
          ...currentIssue?._count,
          upvotes:
            (currentIssue?._count?.upvotes || 0) + 1,
        },
      }));
    } catch (error) {
      console.error("Upvote error:", error);

      if (error.response?.status === 409) {
        setUpvoteError(
          "You have already upvoted this issue."
        );
      } else if (error.response?.status === 401) {
        navigate("/login");
      } else {
        setUpvoteError(
          error.response?.data?.message ||
            "Unable to upvote this issue."
        );
      }
    } finally {
      setUpvoting(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <main className="dashboard-content">
          <div className="empty-state">
            <p>Loading issue...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="dashboard">
        <main className="dashboard-content">
          <div className="form-error">
            {error || "Issue not found."}
          </div>

          <Link to="/issues">
            ‹ Back to Public Issues
          </Link>
        </main>
      </div>
    );
  }

  const assignments = issue.assignments || [];
  const statusHistory = issue.statusHistory || [];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>CivicFix</h1>
          <p>Public Issue Details</p>
        </div>

        <div className="dashboard-user">
          <Link to="/issues">
            Public Issues
          </Link>

          <Link to="/citizen">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="dashboard-content">
        <Link to="/issues">
          ‹ Back to Public Issues
        </Link>

        <section className="welcome-section">
          <p className="eyebrow">CIVIC ISSUE</p>

          <h2>{issue.title}</h2>

          <p>
            Reported on {formatDate(issue.createdAt)}
          </p>
        </section>

        <EmergencyBanner issue={issue} />

        <section className="complaint-card">
          <div className="complaint-card-header">
            <div>
              <h2>Issue Information</h2>

              <p>
                {formatStatus(issue.category)}{" "}
                <ChronicBadge issue={issue} />
              </p>
            </div>

            <span
              className={getStatusClass(issue.status)}
            >
              {formatStatus(issue.status)}
            </span>
          </div>

          <PhotoGallery
            photos={(issue.complaints || []).flatMap(
              (complaint) =>
                complaint.photos?.length
                  ? complaint.photos
                  : [complaint.imageUrl]
            )}
            alt={issue.title}
          />

          <VoiceNotes complaints={issue.complaints} />

          <ExpectedFix issue={issue} />

          <p className="complaint-description">
            {issue.description ||
              "No description provided."}
          </p>

          <div className="complaint-meta">
            <span>
              Severity: {formatStatus(issue.severity)}
            </span>

            <span>
              👍 {issue._count?.upvotes || 0} upvotes
            </span>

            <span>
              👥 {issue._count?.complaints || 0} reports
            </span>
          </div>

          {issue.address && (
            <p className="complaint-address">
              📍 {issue.address}
            </p>
          )}

          <div className="issue-actions-row">
            <button
              type="button"
              onClick={handleUpvote}
              disabled={upvoting}
              className="primary-button"
            >
              {upvoting
                ? "Upvoting..."
                : "👍 Upvote Issue"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const shareUrl = issueShareUrl(issue.id);

                try {
                  await navigator.clipboard.writeText(
                    shareUrl
                  );
                  setShareMessage("Link copied ✓");
                } catch {
                  setShareMessage(shareUrl);
                }

                setTimeout(
                  () => setShareMessage(""),
                  2500
                );
              }}
            >
              🔗 Copy link
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${issue.title} — reported on CivicFix. Upvote it: ${issueShareUrl(issue.id)}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="secondary-button share-anchor"
            >
              Share on WhatsApp
            </a>
          </div>

          {shareMessage && (
            <p className="detail-label">
              {shareMessage}
            </p>
          )}

          {upvoteMessage && (
            <p>
              {upvoteMessage}
            </p>
          )}

          {upvoteError && (
            <div className="form-error">
              {upvoteError}
            </div>
          )}
        </section>

        {issue.sla && (
          <section className="recent-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">SERVICE LEVEL</p>

                <h2>SLA</h2>
              </div>
            </div>

            <div className="complaint-card">
              <div className="complaint-meta">
                <span>
                  Duration: {issue.sla.durationMin} minutes
                </span>

                <span>
                  Deadline:{" "}
                  {formatDateTime(issue.sla.deadline)}
                </span>

                <span>
                  Status:{" "}
                  {issue.sla.breached
                    ? "Breached"
                    : "Active"}
                </span>
              </div>

              {issue.sla.breachedAt && (
                <p>
                  Breached on{" "}
                  {formatDateTime(issue.sla.breachedAt)}
                </p>
              )}
            </div>
          </section>
        )}

        {assignments.length > 0 && (
          <section className="recent-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">RESPONSIBILITY</p>

                <h2>Assignment</h2>
              </div>
            </div>

            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="complaint-card"
              >
                <div className="complaint-meta">
                  <span>
                    Authority:{" "}
                    {assignment.authority?.name ||
                      "Not available"}
                  </span>

                  <span>
                    Department:{" "}
                    {assignment.department?.name ||
                      "Not assigned"}
                  </span>

                  <span>
                    Ward:{" "}
                    {assignment.ward?.name ||
                      "Not assigned"}
                  </span>
                </div>

                <p>
                  Assigned on{" "}
                  {formatDateTime(
                    assignment.assignedAt
                  )}
                </p>

                {assignment.acceptedAt && (
                  <p>
                    Accepted on{" "}
                    {formatDateTime(
                      assignment.acceptedAt
                    )}
                  </p>
                )}

                {assignment.completedAt && (
                  <p>
                    Completed on{" "}
                    {formatDateTime(
                      assignment.completedAt
                    )}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="recent-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">PROGRESS</p>

              <h2>Status History</h2>
            </div>
          </div>

          {statusHistory.length === 0 ? (
            <div className="empty-state">
              <p>
                No status updates have been recorded yet.
              </p>
            </div>
          ) : (
            <div className="complaints-list">
              {statusHistory.map((history) => (
                <div
                  key={history.id}
                  className="complaint-card"
                >
                  <div className="complaint-card-header">
                    <h3>
                      {formatStatus(history.status)}
                    </h3>

                    <span>
                      {formatDateTime(
                        history.createdAt
                      )}
                    </span>
                  </div>

                  {history.note && (
                    <p className="complaint-description">
                      {history.note}
                    </p>
                  )}

                  {history.imageUrl && (
                    <img
                      className="timeline-photo"
                      src={history.imageUrl}
                      alt="Photo attached to this update"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {issue.resolutionImageUrl && (
          <section className="recent-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">PROOF OF WORK</p>

                <h2>Resolution photo</h2>
              </div>
            </div>

            <img
              className="complaint-image"
              src={issue.resolutionImageUrl}
              alt="Photo of the completed work"
            />
          </section>
        )}

        <CommentsSection issueId={issue.id} />
      </main>
    </div>
  );
}