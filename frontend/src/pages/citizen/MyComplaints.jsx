import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchComplaints() {
      try {
        const response = await api.get(
          "/complaints/my"
        );

        setComplaints(
          response.data.complaints || []
        );
      } catch (error) {
        console.error(
          "Fetch complaints error:",
          error
        );

        setError(
          error.response?.data?.message ||
            "Unable to load your complaints."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchComplaints();
  }, []);

  function formatDate(date) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  function getStatusClass(status) {
    return `status-badge status-${status
      ?.toLowerCase()
      .replace(/_/g, "-")}`;
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading your complaints...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/citizen">
          ‹ Back to Dashboard
        </Link>

        <h1>My Complaints</h1>

        <p>
          Track the civic issues you have
          reported.
        </p>
      </div>

      {error && (
        <div className="form-error">
          {error}
        </div>
      )}

      {!error && complaints.length === 0 && (
        <div className="empty-state">
          <h2>No complaints yet</h2>

          <p>
            You haven't reported any civic issues.
          </p>

          <Link
            to="/citizen/report"
            className="primary-button"
          >
            Report an Issue
          </Link>
        </div>
      )}

      {complaints.length > 0 && (
        <div className="complaints-list">
          {complaints.map((complaint) => {
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
                      {issue?.category ||
                        "OTHER"}
                    </p>
                  </div>

                  <span
                    className={getStatusClass(
                      issue?.status
                    )}
                  >
                    {issue?.status ||
                      "UNKNOWN"}
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
                    {issue?.severity ||
                      "MEDIUM"}
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
    </div>
  );
}