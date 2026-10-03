import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

const PAGE_SIZE = 50;

export default function AdminAudit() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchAudit() {
      setLoading(true);

      try {
        const response = await api.get(
          "/dashboard/audit",
          {
            params: {
              limit: PAGE_SIZE,
              offset,
            },
          }
        );

        if (!cancelled) {
          setEntries(response.data.entries || []);
          setTotal(response.data.total || 0);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error.response?.data?.message ||
              "Unable to load the audit log."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAudit();

    return () => {
      cancelled = true;
    };
  }, [offset]);

  function formatStatus(status) {
    return (
      status
        ?.replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) =>
          char.toUpperCase()
        ) || "Unknown"
    );
  }

  function getStatusClass(status) {
    return `status-badge status-${status
      ?.toLowerCase()
      .replace(/_/g, "-")}`;
  }

  function formatDateTime(date) {
    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/admin">‹ Back to Admin</Link>

        <p className="eyebrow">ACCOUNTABILITY</p>

        <h1>Audit Log</h1>

        <p>
          Every status change across the platform —
          who changed what, and when.
        </p>
      </div>

      {error && (
        <div className="form-error">{error}</div>
      )}

      {loading ? (
        <p>Loading audit log...</p>
      ) : (
        <>
          <section className="details-card">
            <h2>
              {total} recorded changes
            </h2>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Issue</th>
                    <th>New status</th>
                    <th>By</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="nowrap">
                        {formatDateTime(
                          entry.createdAt
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/issues/${entry.issue.id}`}
                          className="text-link"
                        >
                          {entry.issue.title}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={getStatusClass(
                            entry.status
                          )}
                        >
                          {formatStatus(entry.status)}
                        </span>
                      </td>
                      <td className="nowrap">
                        {entry.user
                          ? `${entry.user.name} (${entry.user.role.toLowerCase()})`
                          : "System"}
                      </td>
                      <td>{entry.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="issue-card-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={offset === 0}
              onClick={() =>
                setOffset(
                  Math.max(0, offset - PAGE_SIZE)
                )
              }
            >
              ← Newer
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={
                offset + PAGE_SIZE >= total
              }
              onClick={() =>
                setOffset(offset + PAGE_SIZE)
              }
            >
              Older →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
