import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import Notifications from "../../components/Notifications";

export default function CitizenDashboard() {
  const { user, logout } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [complaintError, setComplaintError] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [impact, setImpact] = useState(null);
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    async function fetchComplaints() {
      try {
        const response = await api.get("/complaints/my");

        setComplaints(response.data.complaints || []);
      } catch (error) {
        console.error("Fetch complaints error:", error);

        setComplaintError(
          error.response?.data?.message ||
            "Unable to load your recent complaints."
        );
      } finally {
        setLoadingComplaints(false);
      }
    }

    async function fetchLeaderboard() {
      try {
        const response = await api.get(
          "/dashboard/leaderboard"
        );

        setLeaderboard(
          response.data.leaderboard || []
        );
      } catch (error) {
        console.error(
          "Fetch leaderboard error:",
          error
        );
      }
    }

    async function fetchImpact() {
      try {
        const response = await api.get(
          "/dashboard/my-impact"
        );

        setImpact(response.data.impact || null);
      } catch (error) {
        console.error("Fetch impact error:", error);
      }
    }

    async function fetchBadges() {
      try {
        const response = await api.get(
          "/dashboard/my-badges"
        );

        setBadges(response.data.badges || []);
      } catch (error) {
        console.error("Fetch badges error:", error);
      }
    }

    fetchComplaints();
    fetchLeaderboard();
    fetchImpact();
    fetchBadges();
  }, []);

  function formatDate(date) {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatStatus(status) {
    return (
      status
        ?.replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase()) ||
      "Unknown"
    );
  }

  function getStatusClass(status) {
    return `status-badge status-${status
      ?.toLowerCase()
      .replace(/_/g, "-")}`;
  }

  const recentComplaints = complaints.slice(0, 3);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>CivicFix</h1>
          <p>Citizen Portal</p>
        </div>

        <div className="dashboard-user">
          <Link to="/" className="nav-home-link">
            ⌂ Home
          </Link>

          <Link to="/profile" className="nav-user-link">
            {user?.avatarUrl && (
              <img
                className="nav-avatar"
                src={user.avatarUrl}
                alt=""
              />
            )}
            {user?.name || "Citizen"}
          </Link>

          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="welcome-section">
          <p className="eyebrow">CITIZEN DASHBOARD</p>

          <h2>
            Welcome back, {user?.name || "Citizen"} 👋
          </h2>

          <p>
            Report civic problems and help make your
            community better.
          </p>

          {typeof user?.points === "number" && (
            <p className="points-chip">
              ★ {user.points} civic points
            </p>
          )}
        </section>

        {impact && impact.totalReports > 0 && (
          <section className="stats-grid impact-grid">
            <div className="stat-card">
              <h2>{impact.totalReports}</h2>
              <p>Reports filed</p>
            </div>

            <div className="stat-card">
              <h2>{impact.resolved}</h2>
              <p>Fixed because of you</p>
            </div>

            <div className="stat-card">
              <h2>{impact.upvotesReceived}</h2>
              <p>Upvotes on your issues</p>
            </div>
          </section>
        )}

        <section className="dashboard-actions">
          <Link
            to="/citizen/report"
            className="dashboard-card"
          >
            <span className="card-icon">+</span>

            <div>
              <h3>Report an Issue</h3>
              <p>
                Report a civic problem with a photo and
                location.
              </p>
              <span className="card-action">
                Start a report
              </span>
            </div>
          </Link>

          <Link
            to="/citizen/complaints"
            className="dashboard-card"
          >
            <span className="card-icon">✓</span>

            <div>
              <h3>My Complaints</h3>
              <p>
                Track complaints you have submitted.
              </p>
              <span className="card-action">
                View my reports
              </span>
            </div>
          </Link>

          <Link
            to="/issues"
            className="dashboard-card"
          >
            <span className="card-icon">◉</span>

            <div>
              <h3>Public Issues</h3>
              <p>
                See civic issues reported by the
                community.
              </p>
              <span className="card-action">
                Browse the map
              </span>
            </div>
          </Link>
        </section>

        {/* Notifications */}

        <Notifications />

        <section className="recent-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">ACTIVITY</p>

              <h2>Recent complaints</h2>
            </div>

            <Link to="/citizen/complaints">
              View all
            </Link>
          </div>

          {loadingComplaints && (
            <div className="empty-state">
              <p>Loading your recent complaints...</p>
            </div>
          )}

          {!loadingComplaints && complaintError && (
            <div className="form-error">
              {complaintError}
            </div>
          )}

          {!loadingComplaints &&
            !complaintError &&
            recentComplaints.length === 0 && (
              <div className="empty-state">
                <h3>No complaints yet</h3>

                <p>
                  Your submitted complaints will appear
                  here.
                </p>

                <Link
                  to="/citizen/report"
                  className="primary-button"
                >
                  Report your first issue
                </Link>
              </div>
            )}

          {!loadingComplaints &&
            !complaintError &&
            recentComplaints.length > 0 && (
              <div className="complaints-list">
                {recentComplaints.map((complaint) => {
                  const issue = complaint.issue;

                  return (
                    <Link
                      key={complaint.id}
                      to={`/citizen/complaints/${complaint.id}`}
                      className="complaint-card"
                    >
                      <div className="complaint-card-header">
                        <div>
                          <h2>
                            {issue?.title ||
                              "Civic Issue"}
                          </h2>

                          <p>
                            {formatStatus(
                              issue?.category
                            )}
                          </p>
                        </div>

                        <span
                          className={getStatusClass(
                            issue?.status
                          )}
                        >
                          {formatStatus(
                            issue?.status
                          )}
                        </span>
                      </div>

                      <p className="complaint-description">
                        {complaint.description ||
                          issue?.description ||
                          "No description provided."}
                      </p>

                      <div className="complaint-meta">
                        <span>
                          Severity:{" "}
                          {formatStatus(
                            issue?.severity
                          )}
                        </span>

                        <span>
                          {formatDate(
                            complaint.createdAt
                          )}
                        </span>
                      </div>

                      {issue?.address && (
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

        {badges.some((badge) => badge.earned) && (
          <section className="recent-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">ACHIEVEMENTS</p>

                <h2>Your badges</h2>
              </div>
            </div>

            <div className="badge-grid">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`badge-card ${
                    badge.earned
                      ? ""
                      : "badge-locked"
                  }`}
                  title={badge.description}
                >
                  <span className="badge-icon">
                    {badge.icon}
                  </span>

                  <strong>{badge.name}</strong>

                  <small>{badge.description}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {leaderboard.length > 0 && (
          <section className="recent-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">COMMUNITY</p>

                <h2>Top contributors</h2>
              </div>
            </div>

            <div className="leaderboard">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`leaderboard-row ${
                    entry.id === user?.id
                      ? "leaderboard-me"
                      : ""
                  }`}
                >
                  <span className="leaderboard-rank">
                    {index + 1}
                  </span>

                  <span className="leaderboard-name">
                    {entry.name}
                    {entry.id === user?.id && " (you)"}
                  </span>

                  <span className="leaderboard-reports">
                    {entry._count?.complaints || 0}{" "}
                    reports
                  </span>

                  <strong className="leaderboard-points">
                    ★ {entry.points}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}