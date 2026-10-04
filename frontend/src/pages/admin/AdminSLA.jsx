import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CircleCheck,
  Hourglass,
  Search,
  ShieldAlert,
  Timer,
  TimerOff,
  TimerReset,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { Meter } from "../../components/charts";
import {
  EmptyState,
  Loading,
  PageHeader,
  Segmented,
  SectionHeader,
  SeverityBadge,
  StatTile,
  StatusBadge,
} from "../../components/ui";
import { OPEN_STATUSES } from "../../lib/labels";
import { formatDateTime, formatNumber, timeAgo } from "../../lib/format";
import Modal from "../../components/ui/Modal";
import { Notice } from "./adminKit";
import {
  apiError,
  fixClock,
  formatClockLength,
  formatSpan,
  shortId,
  useNow,
} from "./adminUtils";

const VIEWS = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "soon", label: "Due in 24 h" },
  { value: "late", label: "Late" },
  { value: "none", label: "No clock" },
  { value: "done", label: "Stopped" },
];

const LATE = ["overdue", "breached", "escalated"];

const PRESETS = [
  { minutes: 240, label: "4 h", hint: "Red Alert" },
  { minutes: 1440, label: "24 h", hint: "Urgent" },
  { minutes: 4320, label: "3 d", hint: "Standard" },
  { minutes: 10080, label: "7 d", hint: "Planned" },
];

const UNITS = { min: 1, h: 60, d: 1440 };

function canSetClock(issue) {
  return !issue.sla && !["CLOSED", "DUPLICATE"].includes(issue.status);
}

function matchesView(view, clock) {
  if (view === "all") return true;
  if (view === "running") return clock.state === "running" || clock.state === "soon";
  if (view === "late") return LATE.includes(clock.state);

  return clock.state === view;
}

export default function AdminSLA() {
  const { can } = useAuth();
  const canManage = can("sla:manage");
  const now = useNow(15000);

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [checking, setChecking] = useState(false);
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const fetchIssues = useCallback(async () => {
    try {
      // Deadlines only matter for open cases.
      const response = await api.get("/issues/admin/all", {
        params: { view: "open", limit: 500 },
      });

      setIssues(response.data.issues || []);
      setError("");
    } catch (fetchError) {
      console.error("Fetch Fix Clock error:", fetchError);
      setError(apiError(fetchError, "Unable to load deadlines."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // State is only set after the request resolves.
    async function load() {
      await fetchIssues();
    }

    load();
  }, [fetchIssues]);

  async function checkBreaches() {
    try {
      setChecking(true);
      setNotice(null);

      const response = await api.post("/sla/check-breaches");
      const count = response.data.breachedCount || 0;

      setNotice({
        tone: "success",
        text:
          count > 0
            ? `${count} ${count === 1 ? "case" : "cases"} just breached the ${FEATURES.fixClock}.`
            : "Breach check done. No new breaches.",
      });

      await fetchIssues();
    } catch (checkError) {
      console.error("Breach check error:", checkError);
      setNotice({ tone: "error", text: apiError(checkError, "Unable to run the breach check.") });
    } finally {
      setChecking(false);
    }
  }

  const rows = useMemo(
    () =>
      issues
        .filter((issue) => issue.status !== "DUPLICATE")
        .map((issue) => ({ issue, clock: fixClock(issue, now) })),
    [issues, now]
  );

  const stats = useMemo(() => {
    const withClock = rows.filter((row) => row.issue.sla);
    const breached = withClock.filter((row) =>
      ["breached", "escalated"].includes(row.clock.state)
    ).length;

    return {
      running: rows.filter((row) => ["running", "soon"].includes(row.clock.state)).length,
      soon: rows.filter((row) => row.clock.state === "soon").length,
      late: rows.filter((row) => LATE.includes(row.clock.state)).length,
      none: rows.filter(
        (row) => !row.issue.sla && OPEN_STATUSES.includes(row.issue.status)
      ).length,
      total: withClock.length,
      breached,
      compliance: withClock.length
        ? ((withClock.length - breached) / withClock.length) * 100
        : null,
    };
  }, [rows]);

  const dueNext = rows
    .filter((row) => ["running", "soon", "overdue"].includes(row.clock.state))
    .sort((a, b) => a.clock.left - b.clock.left)
    .slice(0, 5);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows
      .filter(({ clock }) => matchesView(view, clock))
      .filter(
        ({ issue }) =>
          !needle ||
          [issue.title, issue.id, issue.ward?.name, issue.address]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)
      )
      .sort((a, b) => {
        const left = (row) => (row.issue.sla ? row.clock.left : Infinity);

        return left(a) - left(b);
      });
  }, [rows, view, query]);

  if (loading) {
    return <Loading label={`Loading the ${FEATURES.fixClock}…`} />;
  }

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow={FEATURES.fixClock}
        title="Deadlines the city keeps"
        description="Every case gets a clock that starts when it was reported. Miss it and the case breaches, then escalates up the chain."
        actions={
          canManage && (
            <button
              type="button"
              className="btn-accent"
              onClick={checkBreaches}
              disabled={checking}
            >
              <ShieldAlert aria-hidden="true" />
              {checking ? "Checking…" : "Run breach check"}
            </button>
          )
        }
      />

      {error && <div className="form-error" role="alert">{error}</div>}
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <section className="kpi-row" aria-label="Deadline counts">
        <StatTile
          label="Clocks running"
          value={formatNumber(stats.running)}
          hint="still inside their deadline"
          icon={Timer}
          tone="navy"
        />
        <StatTile
          label="Due in 24 hours"
          value={formatNumber(stats.soon)}
          hint="about to run out"
          icon={Hourglass}
          tone="warning"
        />
        <StatTile
          label="Late"
          value={formatNumber(stats.late)}
          hint="overdue, breached or escalated"
          icon={AlertTriangle}
          tone="danger"
        />
        <StatTile
          label="No clock yet"
          value={formatNumber(stats.none)}
          hint="open cases without a deadline"
          icon={TimerOff}
        />
      </section>

      <section className="grid-2">
        <div className="card deck-health">
          <SectionHeader eyebrow="Promises" title="Deadlines met so far" />

          <Meter
            label={
              stats.total
                ? `${stats.total - stats.breached} of ${stats.total} deadlines met`
                : "No deadlines set yet"
            }
            value={stats.compliance}
          />

          <p className="clock-explainer">
            <TimerReset aria-hidden="true" />
            <span>
              The server checks every minute, marks late cases as breached and escalates
              them. Run a check by hand after changing deadlines.
            </span>
          </p>
        </div>

        <div className="card">
          <SectionHeader title="Due next" description="Open clocks, closest deadline first." />

          {dueNext.length === 0 ? (
            <EmptyState icon={CircleCheck} title="Nothing ticking">
              No running clocks right now.
            </EmptyState>
          ) : (
            <ul className="list-divided waiting-list">
              {dueNext.map(({ issue, clock }) => (
                <li key={issue.id}>
                  <span className="person-stack due-main">
                    <Link to={`/issues/${issue.id}`} className="case-link">
                      {issue.title}
                    </Link>
                    <span>Due {formatDateTime(issue.sla.deadline)}</span>
                  </span>
                  <ClockChip clock={clock} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="stack" aria-label="Cases and deadlines">
        <div className="filters-bar admin-filters">
          <label className="search-field">
            <span className="sr-only">Search cases</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, ward or ID"
            />
          </label>
        </div>

        <div className="admin-table-toolbar">
          <Segmented label="Show clocks" options={VIEWS} value={view} onChange={setView} />
          <p className="admin-count" aria-live="polite">
            {formatNumber(visible.length)} {visible.length === 1 ? "case" : "cases"}
          </p>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={Timer} title="No cases in this view">
            Try another view or search.
          </EmptyState>
        ) : (
          <div className="table-scroll admin-table-scroll">
            <table className="data-table admin-table">
              <caption className="sr-only">Cases and their deadlines</caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Status</th>
                  <th scope="col">Severity</th>
                  <th scope="col" className="num">Clock</th>
                  <th scope="col">Deadline</th>
                  <th scope="col">Countdown</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ issue, clock }) => (
                  <tr key={issue.id}>
                    <td>
                      <div className="case-cell">
                        <Link to={`/issues/${issue.id}`} className="case-link">
                          {issue.title || "Untitled case"}
                        </Link>
                        <span className="case-meta">
                          <span className="mono">#{shortId(issue.id)}</span>
                          {issue.ward?.name && <span>{issue.ward.name}</span>}
                          <span>reported {timeAgo(issue.createdAt, now)}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={issue.status} />
                    </td>
                    <td>
                      <SeverityBadge severity={issue.severity} />
                    </td>
                    <td className="num">
                      {issue.sla ? formatClockLength(issue.sla.durationMin) : "—"}
                    </td>
                    <td className="nowrap">
                      {issue.sla ? (
                        <>
                          {formatDateTime(issue.sla.deadline)}
                          {issue.sla.breachedAt && (
                            <span className="cell-sub">
                              Breached {formatDateTime(issue.sla.breachedAt)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <ClockChip clock={clock} />
                    </td>
                    <td>
                      <div className="row-actions">
                        {canManage && canSetClock(issue) && (
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => setSelected(issue)}
                            aria-label={`Set clock: ${issue.title}`}
                          >
                            <Timer aria-hidden="true" />
                            Set clock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <SetClockDialog
          issue={selected}
          now={now}
          onClose={() => setSelected(null)}
          onDone={async (message) => {
            setSelected(null);
            setNotice({ tone: "success", text: message });
            await fetchIssues();
          }}
        />
      )}
    </div>
  );
}

function ClockChip({ clock }) {
  if (clock.state === "none") {
    return <span className="muted nowrap">No clock</span>;
  }

  const Icon =
    clock.tone === "danger" ? AlertTriangle : clock.tone === "success" ? CircleCheck : Timer;

  return (
    <span className={`chip ${clock.tone ? `chip-${clock.tone}` : ""}`}>
      <Icon aria-hidden="true" />
      {clock.label}
    </span>
  );
}

function SetClockDialog({ issue, now, onClose, onDone }) {
  const [preset, setPreset] = useState(issue.isEmergency ? 240 : 4320);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("h");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const custom = amount !== "";
  const durationMin = custom ? Math.round(Number(amount) * UNITS[unit]) : preset;
  const valid = Number.isInteger(durationMin) && durationMin > 0;
  const deadline = new Date(new Date(issue.createdAt).getTime() + durationMin * 60000);
  const left = deadline.getTime() - now;

  async function submit(event) {
    event.preventDefault();

    if (!valid) {
      setError("Use a positive length of time.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const response = await api.post("/sla", { issueId: issue.id, durationMin });

      await onDone(
        response.data.message ||
          `${FEATURES.fixClock} set: ${formatClockLength(durationMin)} for "${issue.title}".`
      );
    } catch (submitError) {
      console.error("Set Fix Clock error:", submitError);
      setError(apiError(submitError, "Unable to set the clock."));
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow={`Set ${FEATURES.fixClock}`}
      title={issue.title || "Untitled case"}
      description={`The clock counts from when the case was reported (${timeAgo(issue.createdAt, now)}).`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset className="preset-group" disabled={busy}>
          <legend>Length</legend>
          <div className="preset-options">
            {PRESETS.map((option) => (
              <label
                key={option.minutes}
                className={`preset ${!custom && preset === option.minutes ? "is-picked" : ""}`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={option.minutes}
                  checked={!custom && preset === option.minutes}
                  onChange={() => {
                    setPreset(option.minutes);
                    setAmount("");
                  }}
                />
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-row clock-custom">
          <div className="field">
            <label htmlFor="clock-amount">Or a custom length</label>
            <input
              id="clock-amount"
              type="number"
              min="1"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 36"
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="clock-unit">Unit</label>
            <select
              id="clock-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              disabled={busy}
            >
              <option value="min">Minutes</option>
              <option value="h">Hours</option>
              <option value="d">Days</option>
            </select>
          </div>
        </div>

        {valid && (
          <p className={`clock-preview ${left <= 0 ? "is-late" : ""}`} aria-live="polite">
            {left <= 0 ? <AlertTriangle aria-hidden="true" /> : <Timer aria-hidden="true" />}
            <span>
              Deadline <strong>{formatDateTime(deadline)}</strong>
              {left <= 0
                ? `, already ${formatSpan(left)} ago. It will breach on the next check.`
                : `, ${formatSpan(left)} from now.`}
            </span>
          </p>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-accent" disabled={busy || !valid}>
            <Timer aria-hidden="true" />
            {busy ? "Starting…" : "Start the clock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
