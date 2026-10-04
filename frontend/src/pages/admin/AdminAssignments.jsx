import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CircleCheck,
  Hourglass,
  RefreshCw,
  Route,
  Search,
  Timer,
  Wrench,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { ChartFrame, StackedBars } from "../../components/charts";
import {
  Avatar,
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  SectionHeader,
  StatTile,
} from "../../components/ui";
import { formatDateTime, formatNumber, timeAgo } from "../../lib/format";
import {
  apiError,
  fixClock,
  formatSpan,
  shortId,
  useNow,
} from "./adminUtils";

// Where a job sits in the Job Flow, derived from the assignment
// timestamps and the case status.
const JOB_STATES = {
  PENDING: { label: "Waiting to accept", badge: "workflow-badge workflow-pending", step: 1 },
  ACCEPTED: { label: "Accepted", badge: "status-badge status-assigned", step: 2 },
  IN_PROGRESS: { label: "In progress", badge: "status-badge status-in-progress", step: 3 },
  RESOLVED: { label: "Resolved", badge: "status-badge status-resolved", step: 4 },
  ESCALATED: { label: "Escalated", badge: "status-badge status-escalated", step: 0 },
  BREACHED: { label: "Fix Clock breached", badge: "status-badge status-sla-breached", step: 0 },
};

const FILTERS = [
  ["ALL", "All"],
  ["PENDING", "Waiting"],
  ["ACCEPTED", "Accepted"],
  ["IN_PROGRESS", "In progress"],
  ["RESOLVED", "Resolved"],
  ["ESCALATED", "Escalated"],
  ["BREACHED", "Breached"],
];

const FLOW_STEPS = ["Assigned", "Accepted", "Started", "Resolved"];

function jobState(assignment) {
  const status = assignment.issue?.status;

  if (assignment.completedAt || status === "RESOLVED") return "RESOLVED";
  if (status === "ESCALATED") return "ESCALATED";
  if (status === "SLA_BREACHED") return "BREACHED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (assignment.acceptedAt) return "ACCEPTED";

  return "PENDING";
}

function isLate(state) {
  return state === "ESCALATED" || state === "BREACHED";
}

export default function AdminAssignments() {
  const { can } = useAuth();
  const now = useNow();

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await api.get("/assignments/all");

      setAssignments(response.data.assignments || []);
      setError("");
    } catch (fetchError) {
      console.error("Fetch Dispatch error:", fetchError);
      setError(apiError(fetchError, "Unable to load assignments."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // State is only set after the request resolves.
    async function load() {
      await fetchAssignments();
    }

    load();
  }, [fetchAssignments]);

  const rows = useMemo(
    () =>
      assignments
        .map((assignment) => ({ ...assignment, state: jobState(assignment) }))
        .sort(
          (a, b) =>
            new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()
        ),
    [assignments]
  );

  const counts = useMemo(() => {
    const result = Object.fromEntries(FILTERS.map(([key]) => [key, 0]));

    result.ALL = rows.length;
    rows.forEach((row) => {
      result[row.state] += 1;
    });

    return result;
  }, [rows]);

  const departments = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const department = row.department ?? row.issue?.department;

      if (department?.id) map.set(department.id, department.name);
    });

    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (filter !== "ALL" && row.state !== filter) return false;

      const department = row.department ?? row.issue?.department;

      if (departmentId && department?.id !== departmentId) return false;

      if (needle) {
        const haystack = [
          row.issue?.title,
          row.issue?.id,
          row.authority?.name,
          row.authority?.email,
          row.ward?.name ?? row.issue?.ward?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [rows, filter, query, departmentId]);

  // Workload per officer: active, late and done jobs.
  const workload = useMemo(() => {
    const map = new Map();

    rows.forEach((row) => {
      const officer = row.authority;

      if (!officer?.id) return;

      const entry = map.get(officer.id) ?? {
        label: officer.name,
        values: { active: 0, late: 0, done: 0 },
      };

      if (row.state === "RESOLVED") entry.values.done += 1;
      else if (isLate(row.state)) entry.values.late += 1;
      else entry.values.active += 1;

      map.set(officer.id, entry);
    });

    return [...map.values()].sort(
      (a, b) =>
        b.values.active + b.values.late - (a.values.active + a.values.late) ||
        a.label.localeCompare(b.label)
    );
  }, [rows]);

  const waiting = rows
    .filter((row) => row.state === "PENDING")
    .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime())
    .slice(0, 5);

  if (loading) {
    return <Loading label={`Loading ${FEATURES.dispatch}…`} />;
  }

  const caseLink = (issueId) =>
    can("assignment:work") ? `/authority/issues/${issueId}` : `/issues/${issueId}`;

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow={FEATURES.dispatch}
        title="Who's working on what"
        description={`Every open job handed to an officer (plus anything finished in the last 30 days), where it sits in the ${FEATURES.jobFlow}, and how close it is to its ${FEATURES.fixClock}.`}
        actions={
          <>
            {can("issue:read:all") && (
              <Link to="/admin/issues" className="btn btn-secondary">
                <Route aria-hidden="true" />
                Assign from {FEATURES.caseDesk}
              </Link>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setRefreshing(true);
                fetchAssignments();
              }}
              disabled={refreshing}
            >
              <RefreshCw aria-hidden="true" className={refreshing ? "is-spinning" : ""} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </>
        }
      />

      {error && <div className="form-error" role="alert">{error}</div>}

      <section className="kpi-row" aria-label="Job counts">
        <StatTile
          label="Waiting to accept"
          value={formatNumber(counts.PENDING)}
          hint="assigned, not yet picked up"
          icon={Hourglass}
          tone="warning"
        />
        <StatTile
          label="On the job"
          value={formatNumber(counts.ACCEPTED + counts.IN_PROGRESS)}
          hint={`${formatNumber(counts.IN_PROGRESS)} crews on site`}
          icon={Wrench}
          tone="navy"
        />
        <StatTile
          label="Late"
          value={formatNumber(counts.ESCALATED + counts.BREACHED)}
          hint="breached or escalated"
          icon={AlertTriangle}
          tone="danger"
        />
        <StatTile
          label="Resolved"
          value={formatNumber(counts.RESOLVED)}
          hint={`of ${formatNumber(counts.ALL)} jobs`}
          icon={CircleCheck}
          tone="success"
        />
      </section>

      <section className="grid-2">
        <ChartFrame
          title="Workload by officer"
          subtitle="Jobs per officer, by where they stand"
          legend={WORKLOAD_KEYS.map((key) => ({ label: key.label, color: key.color }))}
          table={{
            columns: [
              { key: "label", label: "Officer" },
              { key: "active", label: "Active", numeric: true },
              { key: "late", label: "Late", numeric: true },
              { key: "done", label: "Done", numeric: true },
            ],
            rows: workload.map((row) => ({ label: row.label, ...row.values })),
          }}
        >
          {workload.length ? (
            <StackedBars rows={workload} keys={WORKLOAD_KEYS} />
          ) : (
            <p className="empty-inline">No jobs handed out yet.</p>
          )}
        </ChartFrame>

        <div className="card">
          <SectionHeader
            eyebrow={FEATURES.jobFlow}
            title="Longest waiting to accept"
            description="Jobs an officer hasn't picked up yet, oldest first."
          />

          {waiting.length === 0 ? (
            <EmptyState icon={CircleCheck} title="Nothing waiting">
              Every assigned job has been accepted.
            </EmptyState>
          ) : (
            <ul className="list-divided waiting-list">
              {waiting.map((row) => (
                <li key={row.id}>
                  <span className="person-cell">
                    <Avatar user={row.authority} size={30} />
                    <span className="person-stack">
                      <Link to={caseLink(row.issue?.id)} className="case-link">
                        {row.issue?.title || "Untitled case"}
                      </Link>
                      <span>{row.authority?.name ?? "Unassigned"}</span>
                    </span>
                  </span>
                  <span className="chip chip-warning">
                    <Hourglass aria-hidden="true" />
                    {formatSpan(now - new Date(row.assignedAt).getTime())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="stack" aria-label="Assignments">
        <div className="tabs admin-tabs" role="group" aria-label="Filter by job state">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`tab ${filter === key ? "is-active" : ""}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="tab-count">{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="filters-bar admin-filters">
          <label className="search-field">
            <span className="sr-only">Search jobs</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case, officer or ward"
            />
          </label>

          <label className="admin-select">
            <span className="sr-only">Department</span>
            <select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <p className="admin-count" aria-live="polite">
            {formatNumber(visible.length)} of {formatNumber(rows.length)} jobs
          </p>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={Route} title="No jobs match">
            Try another state, search or department.
          </EmptyState>
        ) : (
          <div className="table-scroll admin-table-scroll">
            <table className="data-table admin-table">
              <caption className="sr-only">Assignments</caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Officer</th>
                  <th scope="col">Department</th>
                  <th scope="col">Assigned</th>
                  <th scope="col">{FEATURES.jobFlow}</th>
                  <th scope="col">{FEATURES.fixClock}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const meta = JOB_STATES[row.state];
                  const clock = fixClock(row.issue, now);
                  const department = row.department ?? row.issue?.department;
                  const ward = row.ward ?? row.issue?.ward;

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="case-cell">
                          <Link to={caseLink(row.issue?.id)} className="case-link">
                            {row.issue?.title || "Untitled case"}
                          </Link>
                          <span className="case-meta">
                            <span className="mono">#{shortId(row.issue?.id)}</span>
                            {row.issue?.category && (
                              <CategoryChip category={row.issue.category} short />
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        {row.authority ? (
                          <span className="person-cell">
                            <Avatar user={row.authority} size={28} />
                            <span className="person-stack">
                              <strong>{row.authority.name}</strong>
                              <span>{row.authority.email}</span>
                            </span>
                          </span>
                        ) : (
                          <span className="muted">Unassigned</span>
                        )}
                      </td>
                      <td className="nowrap">
                        {department?.name ?? <span className="muted">—</span>}
                        {ward?.name && <span className="cell-sub">{ward.name}</span>}
                      </td>
                      <td className="nowrap">
                        <time dateTime={row.assignedAt} title={formatDateTime(row.assignedAt)}>
                          {timeAgo(row.assignedAt, now)}
                        </time>
                        <span className="cell-sub">{formatDateTime(row.assignedAt)}</span>
                      </td>
                      <td>
                        <div className="flow-cell">
                          <span className={meta.badge}>{meta.label}</span>
                          {meta.step > 0 && <FlowSteps step={meta.step} />}
                        </div>
                      </td>
                      <td>
                        {clock.state === "none" ? (
                          <span className="muted nowrap">No clock</span>
                        ) : (
                          <span className={`chip ${clock.tone ? `chip-${clock.tone}` : ""}`}>
                            {clock.tone === "danger" ? (
                              <AlertTriangle aria-hidden="true" />
                            ) : (
                              <Timer aria-hidden="true" />
                            )}
                            {clock.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const WORKLOAD_KEYS = [
  { key: "active", label: "Active", color: "var(--series-1)" },
  { key: "late", label: "Late", color: "var(--series-8)" },
  { key: "done", label: "Done", color: "var(--series-3)" },
];

// Four-step progress strip: Assigned → Accepted → Started → Resolved.
function FlowSteps({ step }) {
  return (
    <span className="flow-steps" aria-label={`Step ${step} of 4: ${FLOW_STEPS[step - 1]}`} role="img">
      {FLOW_STEPS.map((label, index) => (
        <span key={label} className={index < step ? "is-done" : ""} title={label} />
      ))}
    </span>
  );
}
