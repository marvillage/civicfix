import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function PublicStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/dashboard/public-stats")
      .then((response) =>
        setStats(response.data.stats)
      )
      .catch((error) =>
        setError(
          error.response?.data?.message ||
            "Unable to load statistics."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  function formatLabel(value) {
    return (
      value
        ?.replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) =>
          char.toUpperCase()
        ) || ""
    );
  }

  const categoryMax = Math.max(
    ...(stats?.byCategory || []).map(
      (row) => row.count
    ),
    1
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>CivicFix</h1>
          <p>Transparency</p>
        </div>

        <div className="dashboard-user">
          <Link to="/">Home</Link>
          <Link to="/issues">Public Issues</Link>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="welcome-section">
          <p className="eyebrow">OPEN DATA</p>

          <h2>How is the city doing?</h2>

          <p>
            Live numbers, no login needed. This is
            every report on CivicFix and how the
            authorities are handling them.
          </p>
        </section>

        {loading && <p>Loading statistics…</p>}

        {error && (
          <div className="form-error">{error}</div>
        )}

        {stats && (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <h2>{stats.total}</h2>
                <p>Issues reported</p>
              </div>

              <div className="stat-card">
                <h2>{stats.resolved}</h2>
                <p>Fixed &amp; verified</p>
              </div>

              <div className="stat-card">
                <h2>{stats.open}</h2>
                <p>Open right now</p>
              </div>

              <div className="stat-card">
                <h2>
                  {stats.avgResolutionHours ?? "—"}
                  {stats.avgResolutionHours != null &&
                    "h"}
                </h2>
                <p>Average time to fix</p>
              </div>
            </section>

            <section className="details-card">
              <p className="eyebrow">WHAT BREAKS</p>

              <h2>Reports by category</h2>

              <div className="bar-list">
                {stats.byCategory.map((row) => (
                  <div
                    className="bar-row"
                    key={row.category}
                  >
                    <span className="bar-label">
                      {formatLabel(row.category)}
                    </span>

                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(row.count / categoryMax) * 100}%`,
                        }}
                      />
                    </div>

                    <strong className="bar-value">
                      {row.count}
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            {stats.wards.length > 0 && (
              <section className="details-card">
                <p className="eyebrow">
                  WARD REPORT CARDS
                </p>

                <h2>
                  Which wards keep their promises?
                </h2>

                <p className="verification-intro">
                  Grades combine resolution rate and
                  SLA compliance. Wards without
                  enough data are ungraded.
                </p>

                <div className="ward-cards">
                  {stats.wards.map((ward) => (
                    <div
                      key={ward.id}
                      className="ward-card"
                    >
                      <span
                        className={`ward-grade ward-grade-${(ward.grade || "na").toLowerCase()}`}
                      >
                        {ward.grade || "–"}
                      </span>

                      <div className="ward-info">
                        <strong>
                          {ward.name}
                          {ward.code
                            ? ` (${ward.code})`
                            : ""}
                        </strong>

                        <small>
                          {ward.totalIssues} issues ·{" "}
                          {ward.resolved} resolved
                          {ward.resolutionRate != null
                            ? ` · ${ward.resolutionRate}% resolution`
                            : ""}
                          {ward.slaCompliance != null
                            ? ` · ${ward.slaCompliance}% on time`
                            : ""}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
