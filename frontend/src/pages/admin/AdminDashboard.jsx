import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

function BarList({ rows }) {
  const max = Math.max(
    ...rows.map((row) => row.count),
    1
  );

  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span className="bar-label">
            {row.label}
          </span>

          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(row.count / max) * 100}%`,
              }}
            />
          </div>

          <strong className="bar-value">
            {row.count}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [chronic, setChronic] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, analyticsRes, chronicRes] =
          await Promise.all([
            api.get("/dashboard/stats"),
            api.get("/dashboard/analytics"),
            api.get("/dashboard/chronic"),
          ]);

        setStats(statsRes.data.stats);
        setAnalytics(analyticsRes.data.analytics);
        setChronic(chronicRes.data.issues || []);
      } catch (error) {
        console.error(
          "Fetch dashboard error:",
          error
        );

        setError(
          error.response?.data?.message ||
            "Unable to load dashboard statistics."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  function formatLabel(value) {
    if (!value) {
      return "";
    }

    return value
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) =>
        char.toUpperCase()
      )
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function handleExport() {
    setExporting(true);

    try {
      const response = await api.get(
        "/dashboard/export/issues.csv",
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(
        response.data
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = `civicfix-issues-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      setError("Unable to export issues.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-block">
          <span className="spinner" />
          <span>Loading dashboard…</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="page">
        <h1>Admin Dashboard</h1>

        <div className="form-error">
          {error}
        </div>
      </div>
    );
  }

  const status = stats?.status || {};

  const monthly = analytics?.monthly || [];
  const monthlyMax = Math.max(
    ...monthly.map((m) => m.count),
    1
  );

  return (
    <div className="page">
      {/* Header */}

      <div className="page-header admin-dash-header">
        <div>
          <p className="eyebrow">
            ADMINISTRATION
          </p>

          <h1>Admin Dashboard</h1>

          <p>
            Monitor CivicFix issues and overall
            platform activity.
          </p>
        </div>

        <div className="issue-card-actions">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting
              ? "Exporting…"
              : "⬇ Export issues (CSV)"}
          </button>

          <Link to="/profile">
            <button
              type="button"
              className="secondary-button"
            >
              My Profile
            </button>
          </Link>

          <Link to="/">
            <button
              type="button"
              className="secondary-button"
            >
              ⌂ Home
            </button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="form-error">{error}</div>
      )}

      {/* Statistics */}

      <section className="stats-grid">
        <div className="stat-card">
          <h2>
            {stats?.totalIssues || 0}
          </h2>
          <p>Total Issues</p>
        </div>

        <div className="stat-card">
          <h2>
            {status.inProgress || 0}
          </h2>
          <p>In Progress</p>
        </div>

        <div className="stat-card">
          <h2>
            {(status.resolved || 0) +
              (status.closed || 0)}
          </h2>
          <p>Resolved + Closed</p>
        </div>

        <div className="stat-card">
          <h2>
            {(status.slaBreached || 0) +
              (status.escalated || 0)}
          </h2>
          <p>Breached / Escalated</p>
        </div>
      </section>

      {/* Insights */}

      <section className="stats-grid insights-grid">
        <div className="stat-card">
          <h2>
            {analytics?.sla?.complianceRate ??
              "—"}
            {analytics?.sla?.complianceRate !=
              null && "%"}
          </h2>
          <p>
            SLA compliance
            {analytics?.sla?.total
              ? ` (${analytics.sla.total - analytics.sla.breached}/${analytics.sla.total} on time)`
              : " (no SLAs yet)"}
          </p>
        </div>

        <div className="stat-card">
          <h2>
            {analytics?.avgResolutionHours ??
              "—"}
            {analytics?.avgResolutionHours !=
              null && "h"}
          </h2>
          <p>Average resolution time</p>
        </div>
      </section>

      {/* Monthly trend */}

      {monthly.length > 0 && (
        <section className="details-card">
          <p className="eyebrow">TREND</p>

          <h2>Issues reported per month</h2>

          <div
            className="column-chart"
            role="img"
            aria-label="Issues reported per month over the last six months"
          >
            {monthly.map((m) => (
              <div
                className="column"
                key={m.month}
                title={`${m.month}: ${m.count} issues`}
              >
                <strong>{m.count}</strong>

                <div className="column-track">
                  <div
                    className="column-bar"
                    style={{
                      height: `${(m.count / monthlyMax) * 100}%`,
                    }}
                  />
                </div>

                <span>{m.month}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category chart */}

      <section className="details-card">
        <p className="eyebrow">
          ISSUE CATEGORIES
        </p>

        <h2>Issues by Category</h2>

        {analytics?.byCategory?.length > 0 ? (
          <BarList
            rows={analytics.byCategory.map(
              (row) => ({
                label: formatLabel(row.category),
                count: row.count,
              })
            )}
          />
        ) : (
          <p>No category data available.</p>
        )}
      </section>

      {/* Ward chart */}

      <section className="details-card">
        <p className="eyebrow">WARDS</p>

        <h2>Issues by Ward</h2>

        {analytics?.byWard?.length > 0 ? (
          <BarList
            rows={analytics.byWard.map((row) => ({
              label: row.ward,
              count: row.count,
            }))}
          />
        ) : (
          <p>No ward data available.</p>
        )}
      </section>

      {/* Severity Statistics */}

      <section className="details-card">
        <p className="eyebrow">
          ISSUE SEVERITY
        </p>

        <h2>Issues by Severity</h2>

        {stats?.severity?.length > 0 ? (
          <BarList
            rows={stats.severity.map((item) => ({
              label: formatLabel(item.severity),
              count: item._count?.id || 0,
            }))}
          />
        ) : (
          <p>No severity data available.</p>
        )}
      </section>

      {/* Chronic issues */}

      {chronic.length > 0 && (
        <section className="details-card chronic-card">
          <p className="eyebrow">NEEDS A RETHINK</p>

          <h2>Chronic issues</h2>

          <p className="verification-intro">
            These issues keep coming back — the fixes
            are not holding. They may need a
            different contractor, budget, or approach.
          </p>

          <div className="stats-list">
            {chronic.map((issue) => (
              <Link
                key={issue.id}
                to={`/issues/${issue.id}`}
                className="stats-list-item chronic-row"
              >
                <span>
                  <strong>{issue.title}</strong>
                  {issue.ward
                    ? ` · ${issue.ward.name}`
                    : ""}
                </span>

                <span className="chronic-badge">
                  ♻ reopened {issue.reopenCount}× ·{" "}
                  {issue._count?.escalations || 0}{" "}
                  escalations
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Admin Tools */}

      <section className="details-card">
        <p className="eyebrow">
          MANAGEMENT
        </p>

        <h2>Admin Tools</h2>

        <div className="admin-actions">
          <Link to="/admin/issues">
            <button type="button">
              Manage Issues
            </button>
          </Link>

          <Link to="/admin/assignments">
            <button type="button">
              Manage Assignments
            </button>
          </Link>

          <Link to="/admin/organization">
            <button type="button">
              Departments & Wards
            </button>
          </Link>

          <Link to="/admin/sla">
            <button type="button">
              SLA Management
            </button>
          </Link>

          <Link to="/admin/users">
            <button type="button">
              Users &amp; Roles
            </button>
          </Link>

          <Link to="/admin/audit">
            <button type="button">
              Audit Log
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
