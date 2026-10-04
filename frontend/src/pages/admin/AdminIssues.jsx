import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  CopyCheck,
  Inbox,
  MapPin,
  Receipt,
  RefreshCw,
  Search,
  Siren,
  Timer,
  UserPlus,
  UserRoundX,
} from "lucide-react";
import api from "../../api/axios";
import CostLedger from "../../components/CostLedger";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import {
  Avatar,
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  Segmented,
  SeverityBadge,
  StatTile,
  StatusBadge,
} from "../../components/ui";
import {
  CATEGORY_META,
  CATEGORIES,
  OPEN_STATUSES,
  STATUS_LABEL,
} from "../../lib/labels";
import { formatDate, formatNumber, timeAgo } from "../../lib/format";
import Modal from "../../components/ui/Modal";
import { Notice } from "./adminKit";
import {
  apiError,
  fixClock,
  shortId,
  useNow,
} from "./adminUtils";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "unassigned", label: "Unassigned" },
  { value: "late", label: "Late" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

const SORTS = {
  newest: "Newest first",
  oldest: "Oldest first",
  severity: "Most severe",
  deadline: "Deadline soonest",
};

const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Open cases are loaded whole (they're the working set); closed and
// "all" views page through the archive on the server.
const ARCHIVE_VIEWS = ["closed", "all"];
const ARCHIVE_PAGE = 50;
const LATE_STATES = ["breached", "escalated", "overdue"];
const FINAL = ["CLOSED", "DUPLICATE"];

// Statuses an admin may set by hand (Duplicate goes through Echo Check).
const SETTABLE_STATUSES = Object.keys(STATUS_LABEL).filter(
  (status) => status !== "DUPLICATE"
);

function activeAssignment(issue) {
  return issue?.assignments?.find((assignment) => !assignment.completedAt) ?? null;
}

function isOpen(issue) {
  return OPEN_STATUSES.includes(issue.status);
}

const EMPTY_ROWS = [];

export default function AdminIssues() {
  const { can } = useAuth();
  const now = useNow();

  const [issues, setIssues] = useState([]); // open cases
  const [totals, setTotals] = useState(null);
  const [archive, setArchive] = useState({
    key: "",
    rows: [],
    nextCursor: null,
    total: 0,
    loading: false,
  });
  const [archiveVersion, setArchiveVersion] = useState(0);
  const [authorities, setAuthorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [view, setView] = useState("open");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [wardId, setWardId] = useState("");
  const [sort, setSort] = useState("newest");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);

    return () => clearTimeout(timer);
  }, [query]);

  // { type: "assign" | "status" | "duplicate" | "costs", issue }
  const [dialog, setDialog] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [issuesRes, authoritiesRes, departmentsRes, wardsRes] =
        await Promise.all([
          api.get("/issues/admin/all", {
            params: { view: "open", limit: 500 },
          }),
          api.get("/organization/authorities"),
          api.get("/organization/departments"),
          api.get("/organization/wards"),
        ]);

      setIssues(issuesRes.data.issues || []);
      setTotals(issuesRes.data.totals ?? null);
      setArchiveVersion((version) => version + 1);
      setAuthorities(authoritiesRes.data.authorities || []);
      setDepartments(departmentsRes.data.departments || []);
      setWards(wardsRes.data.wards || []);
      setError("");
    } catch (fetchError) {
      console.error("Fetch Case Desk error:", fetchError);
      setError(apiError(fetchError, "Unable to load cases."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // State is only set after the request resolves.
    async function load() {
      await fetchData();
    }

    load();
  }, [fetchData]);

  const isArchive = ARCHIVE_VIEWS.includes(view);
  const archiveKey = JSON.stringify([
    view,
    debouncedQuery,
    category,
    wardId,
    archiveVersion,
  ]);

  useEffect(() => {
    if (!ARCHIVE_VIEWS.includes(view)) return undefined;

    let cancelled = false;

    api
      .get("/issues/admin/all", {
        params: {
          view,
          q: debouncedQuery || undefined,
          category: category || undefined,
          wardId: wardId || undefined,
          limit: ARCHIVE_PAGE,
        },
      })
      .then((response) => {
        if (cancelled) return;

        setArchive({
          key: archiveKey,
          rows: response.data.issues || [],
          nextCursor: response.data.nextCursor ?? null,
          total: response.data.total ?? 0,
          loading: false,
        });
      })
      .catch((fetchError) => {
        if (cancelled) return;

        setArchive({
          key: archiveKey,
          rows: [],
          nextCursor: null,
          total: 0,
          loading: false,
        });
        setError(apiError(fetchError, "Unable to load cases."));
      });

    return () => {
      cancelled = true;
    };
  }, [view, debouncedQuery, category, wardId, archiveKey]);

  async function loadMoreArchive() {
    if (!archive.nextCursor) return;

    setArchive((current) => ({ ...current, loading: true }));

    try {
      const response = await api.get("/issues/admin/all", {
        params: {
          view,
          q: debouncedQuery || undefined,
          category: category || undefined,
          wardId: wardId || undefined,
          limit: ARCHIVE_PAGE,
          cursor: archive.nextCursor,
        },
      });

      setArchive((current) => ({
        ...current,
        rows: [...current.rows, ...(response.data.issues || [])],
        nextCursor: response.data.nextCursor ?? null,
        loading: false,
      }));
    } catch (fetchError) {
      setArchive((current) => ({ ...current, loading: false }));
      setError(apiError(fetchError, "Unable to load more cases."));
    }
  }

  function refresh() {
    setRefreshing(true);
    fetchData();
  }

  async function afterAction(message) {
    setDialog(null);
    setNotice({ tone: "success", text: message });
    await fetchData();
  }

  const counts = useMemo(() => {
    const open = issues.filter(isOpen);

    return {
      open: open.length,
      unassigned: open.filter((issue) => !activeAssignment(issue)).length,
      redAlert: open.filter((issue) => issue.isEmergency).length,
      late: open.filter((issue) =>
        LATE_STATES.includes(fixClock(issue, now).state)
      ).length,
    };
  }, [issues, now]);

  const archiveReady = archive.key === archiveKey;
  const archiveRows = isArchive && archiveReady ? archive.rows : EMPTY_ROWS;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = isArchive ? archiveRows : issues;

    const rows = source.filter((issue) => {
      if (isArchive) return true;
      if (view === "open" && !isOpen(issue)) return false;
      if (view === "unassigned" && (!isOpen(issue) || activeAssignment(issue))) return false;
      if (
        view === "late" &&
        (!isOpen(issue) || !LATE_STATES.includes(fixClock(issue, now).state))
      )
        return false;
      if (view === "closed" && isOpen(issue)) return false;
      if (category && issue.category !== category) return false;
      if (wardId && (issue.ward?.id ?? issue.wardId) !== wardId) return false;

      if (needle) {
        const haystack = [
          issue.title,
          issue.address,
          issue.ward?.name,
          issue.id,
          activeAssignment(issue)?.authority?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) return false;
      }

      return true;
    });

    const byDate = (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    return rows.sort((a, b) => {
      if (sort === "oldest") return -byDate(a, b);
      if (sort === "severity") {
        return (
          (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
          byDate(a, b)
        );
      }
      if (sort === "deadline") {
        const da = a.sla ? new Date(a.sla.deadline).getTime() : Infinity;
        const db = b.sla ? new Date(b.sla.deadline).getTime() : Infinity;

        return da - db || byDate(a, b);
      }

      return byDate(a, b);
    });
  }, [issues, archiveRows, isArchive, view, query, category, wardId, sort, now]);

  if (loading) {
    return <Loading label={`Loading the ${FEATURES.caseDesk}…`} />;
  }

  const filtersActive = Boolean(query || category || wardId);

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow={FEATURES.caseDesk}
        title="Every case, one desk"
        description="Route each case to the right officer, keep statuses honest, and fold repeat reports into the original."
        actions={
          <button
            type="button"
            className="btn-secondary"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw aria-hidden="true" className={refreshing ? "is-spinning" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error && <div className="form-error" role="alert">{error}</div>}
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <section className="kpi-row" aria-label="Case counts">
        <StatTile
          label="Open cases"
          value={formatNumber(counts.open)}
          hint={`${formatNumber(totals?.all ?? issues.length)} on file`}
          icon={Inbox}
          tone="navy"
        />
        <StatTile
          label="Waiting for an officer"
          value={formatNumber(counts.unassigned)}
          hint="open and unassigned"
          icon={UserRoundX}
          tone="warning"
        />
        <StatTile
          label={FEATURES.redAlert}
          value={formatNumber(counts.redAlert)}
          hint="open emergencies"
          icon={Siren}
          tone="danger"
        />
        <StatTile
          label={`Past the ${FEATURES.fixClock}`}
          value={formatNumber(counts.late)}
          hint="breached, overdue or escalated"
          icon={Timer}
          tone="danger"
          to={can("sla:manage") ? "/admin/sla" : undefined}
        />
      </section>

      <section className="stack" aria-label="Cases">
        <div className="filters-bar admin-filters">
          <label className="search-field">
            <span className="sr-only">Search cases</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, address, ward, officer or ID"
            />
          </label>

          <label className="admin-select">
            <span className="sr-only">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_META[key].label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-select">
            <span className="sr-only">Ward</span>
            <select value={wardId} onChange={(event) => setWardId(event.target.value)}>
              <option value="">All wards</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-select">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-table-toolbar">
          <Segmented
            label="Show cases"
            options={VIEWS}
            value={view}
            onChange={setView}
          />
          <p className="admin-count" aria-live="polite">
            {isArchive && !archiveReady ? (
              "Loading…"
            ) : isArchive ? (
              <>
                {formatNumber(visible.length)} of {formatNumber(archive.total)}{" "}
                {archive.total === 1 ? "case" : "cases"}
                {filtersActive ? " match" : ""}
              </>
            ) : (
              <>
                {formatNumber(visible.length)}{" "}
                {visible.length === 1 ? "case" : "cases"}
                {filtersActive ? " match" : ""}
              </>
            )}
          </p>
        </div>

        {isArchive && !archiveReady ? (
          <Loading label="Loading cases…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={filtersActive ? "No cases match" : "Nothing here"}
            action={
              filtersActive ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setWardId("");
                  }}
                >
                  Clear filters
                </button>
              ) : null
            }
          >
            {filtersActive
              ? "Try a different search or clear the filters."
              : "No cases in this view right now."}
          </EmptyState>
        ) : (
          <div className="table-scroll admin-table-scroll">
            <table className="data-table admin-table">
              <caption className="sr-only">
                Cases, {VIEWS.find((v) => v.value === view)?.label.toLowerCase()} view
              </caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Category</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Officer</th>
                  <th scope="col">{FEATURES.fixClock}</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((issue) => {
                  const assignment = activeAssignment(issue);
                  const clock = fixClock(issue, now);
                  const title = issue.title || "Untitled case";
                  const final = FINAL.includes(issue.status);

                  return (
                    <tr key={issue.id}>
                      <td>
                        <div className="case-cell">
                          <Link to={`/issues/${issue.id}`} className="case-link">
                            {title}
                          </Link>
                          <span className="case-meta">
                            <span className="mono">#{shortId(issue.id)}</span>
                            {issue.ward && (
                              <span>
                                <MapPin aria-hidden="true" />
                                {issue.ward.name}
                              </span>
                            )}
                            <time dateTime={issue.createdAt} title={formatDate(issue.createdAt)}>
                              {timeAgo(issue.createdAt, now)}
                            </time>
                            {issue.isEmergency && (
                              <span className="red-alert">
                                <Siren aria-hidden="true" />
                                {FEATURES.redAlert}
                              </span>
                            )}
                            {issue.reopenCount > 0 && (
                              <span className="chip chip-warning">
                                Reopened {issue.reopenCount}×
                              </span>
                            )}
                            {issue._count?.upvotes > 0 && (
                              <span>
                                {issue._count.upvotes}{" "}
                                {issue._count.upvotes === 1 ? "backer" : "backers"}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        {issue.category && <CategoryChip category={issue.category} short />}
                      </td>
                      <td>
                        <SeverityBadge severity={issue.severity} />
                      </td>
                      <td>
                        <StatusBadge status={issue.status} />
                      </td>
                      <td>
                        {assignment?.authority ? (
                          <span className="person-cell">
                            <Avatar user={assignment.authority} size={26} />
                            <span>{assignment.authority.name}</span>
                          </span>
                        ) : isOpen(issue) ? (
                          <span className="chip chip-warning">Unassigned</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <ClockChip clock={clock} />
                      </td>
                      <td>
                        <div className="row-actions">
                          {can("issue:assign") && !final && (
                            <button
                              type="button"
                              className="btn-sm"
                              onClick={() => setDialog({ type: "assign", issue })}
                              aria-label={`${assignment ? "Reassign" : "Assign"}: ${title}`}
                            >
                              <UserPlus aria-hidden="true" />
                              {assignment ? "Reassign" : "Assign"}
                            </button>
                          )}
                          {can("issue:status") && issue.status !== "DUPLICATE" && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm row-icon-button"
                              onClick={() => setDialog({ type: "status", issue })}
                              aria-label={`Update status: ${title}`}
                              title="Update status"
                            >
                              <ArrowRightLeft aria-hidden="true" />
                            </button>
                          )}
                          {can("cost:read") && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm row-icon-button"
                              onClick={() => setDialog({ type: "costs", issue })}
                              aria-label={`${FEATURES.costLedger}: ${title}`}
                              title={FEATURES.costLedger}
                            >
                              <Receipt aria-hidden="true" />
                            </button>
                          )}
                          {can("issue:duplicate") && !final && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm row-icon-button"
                              onClick={() => setDialog({ type: "duplicate", issue })}
                              aria-label={`Mark as duplicate: ${title}`}
                              title="Mark as duplicate"
                            >
                              <CopyCheck aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isArchive && archiveReady && archive.nextCursor && (
          <button
            type="button"
            className="btn-secondary btn-block"
            onClick={loadMoreArchive}
            disabled={archive.loading}
          >
            {archive.loading
              ? "Loading…"
              : `Load ${Math.min(ARCHIVE_PAGE, archive.total - archive.rows.length)} more`}
          </button>
        )}
      </section>

      {dialog?.type === "assign" && (
        <AssignDialog
          issue={dialog.issue}
          authorities={authorities}
          departments={departments}
          wards={wards}
          onClose={() => setDialog(null)}
          onDone={afterAction}
        />
      )}

      {dialog?.type === "status" && (
        <StatusDialog
          issue={dialog.issue}
          onClose={() => setDialog(null)}
          onDone={afterAction}
        />
      )}

      {dialog?.type === "costs" && (
        <Modal
          eyebrow={FEATURES.caseFile}
          title={dialog.issue.title || "Untitled case"}
          onClose={() => setDialog(null)}
          size="wide"
        >
          <div className="admin-modal-ledger">
            <CostLedger issueId={dialog.issue.id} canLog={can("cost:log")} />
          </div>
        </Modal>
      )}

      {dialog?.type === "duplicate" && (
        <DuplicateDialog
          issue={dialog.issue}
          issues={[...issues, ...archiveRows]}
          onClose={() => setDialog(null)}
          onDone={afterAction}
        />
      )}
    </div>
  );
}

function ClockChip({ clock }) {
  if (clock.state === "none") {
    return <span className="muted nowrap">No clock</span>;
  }

  const Icon = clock.tone === "danger" ? AlertTriangle : Timer;

  return (
    <span className={`chip ${clock.tone ? `chip-${clock.tone}` : ""}`}>
      <Icon aria-hidden="true" />
      {clock.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Assign / reassign an officer
// ─────────────────────────────────────────────

function AssignDialog({ issue, authorities, departments, wards, onClose, onDone }) {
  const current = activeAssignment(issue);
  const [authorityId, setAuthorityId] = useState("");
  const [departmentId, setDepartmentId] = useState(
    current?.department?.id ?? issue.department?.id ?? issue.departmentId ?? ""
  );
  const [wardId, setWardId] = useState(
    current?.ward?.id ?? issue.ward?.id ?? issue.wardId ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const officers = authorities.filter(
    (authority) => authority.id !== current?.authority?.id
  );

  async function submit(event) {
    event.preventDefault();

    if (!authorityId) {
      setError("Choose an officer.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const response = await api.post("/assignments", {
        issueId: issue.id,
        authorityId,
        departmentId: departmentId || undefined,
        wardId: wardId || undefined,
      });

      await onDone(
        response.data.message ||
          `${current ? "Reassigned" : "Assigned"} "${issue.title}".`
      );
    } catch (submitError) {
      console.error("Assign case error:", submitError);
      setError(apiError(submitError, "Unable to assign the case."));
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow={current ? "Reassign case" : "Assign case"}
      title={issue.title || "Untitled case"}
      description={
        current?.authority
          ? `Currently with ${current.authority.name}. The new officer gets the job in their ${FEATURES.crewQueue}.`
          : `The officer gets the job in their ${FEATURES.crewQueue} and the reporter is notified.`
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="assign-officer">Officer</label>
          <select
            id="assign-officer"
            value={authorityId}
            onChange={(event) => setAuthorityId(event.target.value)}
            disabled={busy}
            required
            data-autofocus
          >
            <option value="">Choose an officer</option>
            {officers.map((authority) => (
              <option key={authority.id} value={authority.id}>
                {authority.name} · {authority.email}
              </option>
            ))}
          </select>
          {officers.length === 0 && (
            <span className="field-hint">
              No other officers yet. Create one in {FEATURES.accessControl}.
            </span>
          )}
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="assign-department">Department</label>
            <select
              id="assign-department"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              disabled={busy}
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="assign-ward">Ward</label>
            <select
              id="assign-ward"
              value={wardId}
              onChange={(event) => setWardId(event.target.value)}
              disabled={busy}
            >
              <option value="">No ward</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name} ({ward.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-accent" disabled={busy || !authorityId}>
            <UserPlus aria-hidden="true" />
            {busy ? "Assigning…" : current ? "Reassign case" : "Assign case"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Status change with a note
// ─────────────────────────────────────────────

function StatusDialog({ issue, onClose, onDone }) {
  const [status, setStatus] = useState(issue.status);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const unchanged = status === issue.status;

  async function submit(event) {
    event.preventDefault();

    if (note.trim().length < 3) {
      setError("Add a short note so the Paper Trail says why.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const response = await api.patch(`/issues/${issue.id}/status`, {
        status,
        note: note.trim(),
      });

      await onDone(
        response.data.message ||
          `Moved "${issue.title}" to ${STATUS_LABEL[status] ?? status}.`
      );
    } catch (submitError) {
      console.error("Status update error:", submitError);
      setError(apiError(submitError, "Unable to update the status."));
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="Update status"
      title={issue.title || "Untitled case"}
      description={`The note is saved to the case timeline and the ${FEATURES.paperTrail}, and followers are notified.`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <p className="status-now">
          <span className="detail-label">Now</span>
          <StatusBadge status={issue.status} />
        </p>

        <div className="field">
          <label htmlFor="status-new">New status</label>
          <select
            id="status-new"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={busy}
            data-autofocus
          >
            {SETTABLE_STATUSES.map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="status-note">Note</label>
          <textarea
            id="status-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
            maxLength={500}
            required
            placeholder="What changed, and why?"
          />
          <span className="field-hint">{note.length}/500</span>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" disabled={busy || unchanged}>
            {busy ? "Saving…" : unchanged ? "Pick a new status" : "Update status"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Echo Check: fold a duplicate into the original
// ─────────────────────────────────────────────

function DuplicateDialog({ issue, issues, onClose, onDone }) {
  const [query, setQuery] = useState("");
  const [originalId, setOriginalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const wardOf = (item) => item.ward?.id ?? item.wardId;

    return issues
      .filter((other) => other.id !== issue.id && other.status !== "DUPLICATE")
      .filter(
        (other) =>
          !needle ||
          [other.title, other.address, other.ward?.name, other.id]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)
      )
      .map((other) => ({
        ...other,
        score:
          (other.category === issue.category ? 2 : 0) +
          (wardOf(other) && wardOf(other) === wardOf(issue) ? 1 : 0),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }, [issues, issue, query]);

  async function submit(event) {
    event.preventDefault();

    if (!originalId) {
      setError("Choose the original case.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const response = await api.post(`/issues/${issue.id}/duplicate`, {
        originalIssueId: originalId,
      });

      await onDone(response.data.message || "Marked as duplicate and merged its backers.");
    } catch (submitError) {
      console.error("Mark duplicate error:", submitError);
      setError(apiError(submitError, "Unable to mark as duplicate."));
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow={FEATURES.echoCheck}
      title="Which case is the original?"
      description={`"${issue.title}" will be closed as a duplicate and its backers move to the original.`}
      onClose={onClose}
      busy={busy}
      size="wide"
    >
      <form onSubmit={submit}>
        <label className="search-field pick-search">
          <span className="sr-only">Search cases</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, address or ID"
            data-autofocus
          />
        </label>

        <fieldset className="pick-list" disabled={busy}>
          <legend className="sr-only">Original case</legend>
          {candidates.length === 0 ? (
            <p className="empty-inline">No other cases match.</p>
          ) : (
            candidates.map((other) => (
              <label
                key={other.id}
                className={`pick-row ${originalId === other.id ? "is-picked" : ""}`}
              >
                <input
                  type="radio"
                  name="original"
                  value={other.id}
                  checked={originalId === other.id}
                  onChange={() => setOriginalId(other.id)}
                />
                <span className="pick-main">
                  <strong>{other.title}</strong>
                  <span className="case-meta">
                    <span className="mono">#{shortId(other.id)}</span>
                    {other.ward?.name && <span>{other.ward.name}</span>}
                    <span>{timeAgo(other.createdAt)}</span>
                  </span>
                </span>
                <span className="pick-tags">
                  {other.category === issue.category && (
                    <span className="chip chip-info">Same category</span>
                  )}
                  <StatusBadge status={other.status} />
                </span>
              </label>
            ))
          )}
        </fieldset>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-danger" disabled={busy || !originalId}>
            <CopyCheck aria-hidden="true" />
            {busy ? "Merging…" : "Mark as duplicate"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
