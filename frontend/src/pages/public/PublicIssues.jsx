import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import IssueMap from "../../components/IssueMap";

const CATEGORIES = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "GARBAGE",
  "WATER_LEAKAGE",
  "DRAINAGE",
  "OTHER",
];

const STATUSES = [
  "REPORTED",
  "AI_VERIFIED",
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CITIZEN_VERIFICATION",
  "SLA_BREACHED",
  "ESCALATED",
  "REOPENED",
];

export default function PublicIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("list");

  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [wardId, setWardId] = useState("");
  const [sort, setSort] = useState("newest");

  const [nearMe, setNearMe] = useState(null);
  const [radius, setRadius] = useState(1000);

  useEffect(() => {
    let cancelled = false;

    async function fetchIssues() {
      setLoading(true);
      setError("");

      try {
        const response = nearMe
          ? await api.get("/issues/nearby", {
              params: {
                lat: nearMe.lat,
                lng: nearMe.lng,
                radius,
                limit: 30,
                category: category || undefined,
              },
            })
          : await api.get("/issues", {
              params: {
                q: search || undefined,
                category: category || undefined,
                status: status || undefined,
                wardId: wardId || undefined,
                sort,
              },
            });

        if (!cancelled) {
          setIssues(
            response.data.issues || response.data || []
          );
        }
      } catch (error) {
        console.error("Fetch public issues error:", error);

        if (!cancelled) {
          setError(
            error.response?.data?.message ||
              "Unable to load public issues."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchIssues();

    return () => {
      cancelled = true;
    };
  }, [search, category, status, wardId, sort, nearMe, radius]);

  function toggleNearMe() {
    if (nearMe) {
      setNearMe(null);
      return;
    }

    navigator.geolocation?.getCurrentPosition(
      (position) =>
        setNearMe({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () =>
        setError(
          "Unable to get your location. Please allow location access."
        )
    );
  }

  const wards = useMemo(() => {
    const map = new Map();

    issues.forEach((issue) => {
      if (issue.ward) {
        map.set(issue.ward.id, issue.ward.name);
      }
    });

    return [...map.entries()];
  }, [issues]);

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
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getStatusClass(status) {
    return `status-badge status-${status
      ?.toLowerCase()
      .replace(/_/g, "-")}`;
  }

  const hasActiveFilters =
    search || category || status || wardId;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>CivicFix</h1>
          <p>Public Issues</p>
        </div>

        <div className="dashboard-user">
          <Link to="/citizen">
            Dashboard
          </Link>

          <Link to="/citizen/report">
            Report Issue
          </Link>
        </div>
      </header>

      <main className="dashboard-content">
        <img
          className="page-banner"
          src="/images/ward-map.png"
          alt="Illustrated map of a city ward with issue markers"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

        <section className="welcome-section">
          <p className="eyebrow">COMMUNITY</p>

          <h2>Public Civic Issues</h2>

          <p>
            View civic issues reported by the community
            and track their progress.
          </p>
        </section>

        <section className="filters-bar">
          <form
            className="filters-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(q.trim());
            }}
          >
            <input
              type="search"
              value={q}
              onChange={(event) =>
                setQ(event.target.value)
              }
              placeholder="Search title, description, address…"
              aria-label="Search issues"
            />

            <button type="submit">Search</button>
          </form>

          <div className="filters-row">
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {formatStatus(value)}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              aria-label="Filter by status"
            >
              <option value="">All open statuses</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {formatStatus(value)}
                </option>
              ))}
            </select>

            {wards.length > 0 && (
              <select
                value={wardId}
                onChange={(event) =>
                  setWardId(event.target.value)
                }
                aria-label="Filter by ward"
              >
                <option value="">All wards</option>
                {wards.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value)
              }
              aria-label="Sort issues"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="upvotes">Most upvoted</option>
            </select>

            <div
              className="view-toggle"
              role="group"
              aria-label="Switch between list, map and heatmap view"
            >
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

              <button
                type="button"
                className={
                  view === "heat" ? "active" : ""
                }
                onClick={() => setView("heat")}
              >
                Heat
              </button>
            </div>
          </div>

          <div className="filters-row nearme-row">
            <button
              type="button"
              className={
                nearMe
                  ? "nearme-button active"
                  : "nearme-button"
              }
              onClick={toggleNearMe}
            >
              {nearMe
                ? "✕ Showing issues near you"
                : "📍 Issues near me"}
            </button>

            {nearMe && (
              <select
                value={radius}
                onChange={(event) =>
                  setRadius(Number(event.target.value))
                }
                aria-label="Search radius"
              >
                <option value={500}>Within 500 m</option>
                <option value={1000}>Within 1 km</option>
                <option value={2000}>Within 2 km</option>
                <option value={5000}>Within 5 km</option>
              </select>
            )}
          </div>
        </section>

        {loading && (
          <div className="loading-block">
            <span className="spinner" />
            <span>Loading public issues…</span>
          </div>
        )}

        {!loading && error && (
          <div className="form-error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          issues.length === 0 && (
            <div className="empty-state">
              <h3>
                {hasActiveFilters
                  ? "No issues match these filters"
                  : "No public issues yet"}
              </h3>

              <p>
                {hasActiveFilters
                  ? "Try clearing a filter or searching for something else."
                  : "Civic issues reported by the community will appear here."}
              </p>

              {!hasActiveFilters && (
                <Link
                  to="/citizen/report"
                  className="primary-button"
                >
                  Report an Issue
                </Link>
              )}
            </div>
          )}

        {!loading && !error && issues.length > 0 && (
          <>
            {view === "map" || view === "heat" ? (
              <IssueMap
                issues={issues}
                heat={view === "heat"}
              />
            ) : (
              <section className="complaints-list">
                {issues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="complaint-card"
                  >
                    <div className="complaint-card-header">
                      <div>
                        <h2>
                          {issue.title || "Civic Issue"}
                        </h2>

                        <p>
                          {formatStatus(issue.category)}
                        </p>
                      </div>

                      <span
                        className={getStatusClass(
                          issue.status
                        )}
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
                        Severity:{" "}
                        {formatStatus(issue.severity)}
                      </span>

                      <span>
                        {formatDate(issue.createdAt)}
                      </span>

                      <span>
                        👍 {issue._count?.upvotes || 0}
                      </span>

                      {issue.distanceMeters != null && (
                        <span>
                          📍{" "}
                          {issue.distanceMeters >= 1000
                            ? `${(issue.distanceMeters / 1000).toFixed(1)} km`
                            : `${issue.distanceMeters} m`}{" "}
                          away
                        </span>
                      )}
                    </div>

                    {issue.address && (
                      <p className="complaint-address">
                        📍 {issue.address}
                      </p>
                    )}
                  </Link>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
