import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  CopyCheck,
  HandHeart,
  History,
  KeyRound,
  ListFilter,
  MapPinned,
  Megaphone,
  Receipt,
  ScrollText,
  ShieldCheck,
  Timer,
  UserCheck,
  UserCog,
  Vote,
  Wallet,
  Workflow,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { ROLE_LABEL } from "../../components/layout/navigation";
import {
  Avatar,
  EmptyState,
  Loading,
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import { CATEGORY_META, STATUS_LABEL } from "../../lib/labels";
import {
  formatDateTime,
  formatINR,
  formatNumber,
  labelize,
  timeAgo,
} from "../../lib/format";
import {
  apiError,
  formatClockLength,
  formatMonthKey,
  shortId,
} from "./adminUtils";

const TIMELINE_PAGE = 50;
const EVENTS_PAGE = 25;

const TABS = [
  { key: "timeline", label: "Case timeline", icon: History },
  { key: "actions", label: "Admin actions", icon: ShieldCheck },
];

const ACTION_FILTERS = [
  ["", "All actions"],
  ["user.", `People & roles (${FEATURES.accessControl})`],
  ["org.", FEATURES.orgRouting],
  ["sla.", FEATURES.fixClock],
  ["issue.", "Cases"],
  ["budget.", FEATURES.budgets],
  ["cost.", FEATURES.costLedger],
  ["bulletin.", FEATURES.bulletins],
  ["poll.", FEATURES.wardVote],
  ["drive.", FEATURES.drives],
];

// Human wording for each recorded action.
const ACTION_META = {
  "user.role.change": { label: "Changed a role", icon: UserCog },
  "user.verify": {
    label: (meta) => (meta?.verified === false ? "Suspended an account" : "Approved a staff account"),
    icon: UserCheck,
  },
  "user.authority.create": { label: "Created an officer account", icon: KeyRound },
  "bulletin.publish": { label: "Published a bulletin", icon: Megaphone },
  "bulletin.delete": { label: "Removed a bulletin", icon: Megaphone },
  "poll.create": { label: `Opened a ${FEATURES.wardVote}`, icon: Vote },
  "poll.close": { label: `Closed a ${FEATURES.wardVote}`, icon: Vote },
  "budget.set": { label: "Set a department budget", icon: Wallet },
  "drive.moderate": {
    label: (meta) =>
      meta?.decision === "REJECT"
        ? "Turned down a Cleanup Drive"
        : meta?.decision === "APPROVE"
          ? "Approved a Cleanup Drive"
          : "Moderated a Cleanup Drive",
    icon: HandHeart,
  },
  "cost.delete": { label: "Deleted a cost entry", icon: Receipt },
  "issue.duplicate": { label: "Merged a duplicate case", icon: CopyCheck },
  "org.department.create": { label: "Added a department", icon: Building2 },
  "org.ward.create": { label: "Added a ward", icon: MapPinned },
  "org.rule.set": { label: "Changed a routing rule", icon: Workflow },
  "sla.set": { label: `Set a ${FEATURES.fixClock}`, icon: Timer },
};

const ENTITY_LABEL = {
  User: "Person",
  DepartmentBudget: "Budget",
  WorkCost: "Cost",
  CategoryRule: "Routing rule",
  SLA: FEATURES.fixClock,
};

const MONEY_KEYS = ["amount", "previous", "budget", "spent"];
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const KEY_LABEL = {
  durationMin: "Clock",
  closesAt: "Closes",
  originalId: "Original",
  issueId: "Case",
  wardId: "Ward",
  departmentId: "Department",
  authorId: "Author",
  loggedById: "Logged by",
  totalVotes: "Votes",
  employeeId: "Employee ID",
  previous: "Was",
};

function actionLabel(event) {
  const meta = ACTION_META[event.action];

  if (!meta) return labelize(event.action?.replace(/\./g, " ") ?? "Action");

  return typeof meta.label === "function" ? meta.label(event.meta) : meta.label;
}

// camelCase → "Camel case"
function keyLabel(key) {
  return KEY_LABEL[key] ?? labelize(key.replace(/([a-z])([A-Z])/g, "$1 $2"));
}

function formatMetaValue(key, value) {
  if (value == null || value === "") return key === "previous" ? "Not set" : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "number") {
    if (MONEY_KEYS.includes(key)) return formatINR(value);
    if (key === "durationMin") return formatClockLength(value);

    return formatNumber(value);
  }

  if (typeof value === "string") {
    if (ROLE_LABEL[value]) return ROLE_LABEL[value];
    if (STATUS_LABEL[value]) return STATUS_LABEL[value];
    if (CATEGORY_META[value]) return CATEGORY_META[value].label;
    if (ISO_RE.test(value)) return formatDateTime(value);
    if (key === "month" && /^\d{4}-\d{2}$/.test(value)) {
      return formatMonthKey(value, { long: true });
    }
    if (key === "employeeId") return value;
    if (/Id$/.test(key) || key === "id") return `#${shortId(value)}`;
    if (/^[A-Z][A-Z_]+$/.test(value)) return labelize(value);
    if (value.length > 60) return `${value.slice(0, 57)}…`;

    return value;
  }

  if (Array.isArray(value)) return `${value.length} items`;

  return JSON.stringify(value).slice(0, 60);
}

// Compact key/value chips. Raw ids are dropped when a readable
// sibling exists (departmentId next to department).
function metaEntries(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];

  return Object.entries(meta)
    .filter(([key, value]) => {
      // Empty optional fields add noise; "was: not set" is still news.
      if (value == null && key !== "previous") return false;
      if (!/Id$/.test(key)) return true;

      return !(key.replace(/Id$/, "") in meta);
    })
    .slice(0, 6)
    .map(([key, value]) => ({
      key,
      label: keyLabel(key),
      value: formatMetaValue(key, value),
      mono: /Id$/.test(key),
    }));
}

export default function AdminAudit() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "actions" ? "actions" : "timeline";

  function selectTab(key) {
    setParams(key === "timeline" ? {} : { tab: key }, { replace: true });
  }

  function onTabKeyDown(event) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

    event.preventDefault();
    const index = TABS.findIndex((item) => item.key === tab);
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];

    selectTab(next.key);
    document.getElementById(`audit-tab-${next.key}`)?.focus();
  }

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow={FEATURES.paperTrail}
        title="Who did what, and when"
        description="Every status change on every case, and every privileged action taken by staff. Nothing here can be edited."
      />

      <div className="tabs" role="tablist" aria-label={`${FEATURES.paperTrail} views`}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            id={`audit-tab-${key}`}
            type="button"
            role="tab"
            className={`tab tab-with-icon ${tab === key ? "is-active" : ""}`}
            aria-selected={tab === key}
            aria-controls={`audit-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => selectTab(key)}
            onKeyDown={onTabKeyDown}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <section
        id={`audit-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`audit-tab-${tab}`}
        className="stack"
      >
        {tab === "timeline" ? <CaseTimeline /> : <AdminActions />}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// Case timeline — status history across all cases
// ─────────────────────────────────────────────

function CaseTimeline() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchAudit() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/dashboard/audit", {
          params: { limit: TIMELINE_PAGE, offset },
        });

        if (!cancelled) {
          setEntries(response.data.entries || []);
          setTotal(response.data.total || 0);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(apiError(fetchError, "Unable to load the case timeline."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAudit();

    return () => {
      cancelled = true;
    };
  }, [offset]);

  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + entries.length, total);

  return (
    <>
      <div className="audit-toolbar">
        <p className="admin-count" aria-live="polite">
          {loading
            ? "Loading…"
            : `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)} status changes`}
        </p>
        <Pager
          canBack={offset > 0 && !loading}
          canForward={offset + TIMELINE_PAGE < total && !loading}
          onBack={() => setOffset(Math.max(0, offset - TIMELINE_PAGE))}
          onForward={() => setOffset(offset + TIMELINE_PAGE)}
        />
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      {loading && entries.length === 0 ? (
        <Loading label="Loading the case timeline…" />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No status changes yet">
          Every move a case makes will be recorded here.
        </EmptyState>
      ) : (
        <div className={`table-scroll admin-table-scroll ${loading ? "is-loading" : ""}`}>
          <table className="data-table admin-table">
            <caption className="sr-only">Status changes, newest first</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Case</th>
                <th scope="col">New status</th>
                <th scope="col">By</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="nowrap">
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    <span className="cell-sub">{timeAgo(entry.createdAt)}</span>
                  </td>
                  <td>
                    {entry.issue ? (
                      <Link to={`/issues/${entry.issue.id}`} className="case-link audit-case">
                        {entry.issue.title}
                      </Link>
                    ) : (
                      <span className="muted">Deleted case</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={entry.status} />
                  </td>
                  <td>
                    <Actor actor={entry.user} />
                  </td>
                  <td className="audit-note">{entry.note || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Pager({ canBack, canForward, onBack, onForward }) {
  return (
    <div className="pager">
      <button type="button" className="btn-secondary btn-sm" disabled={!canBack} onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        Newer
      </button>
      <button type="button" className="btn-secondary btn-sm" disabled={!canForward} onClick={onForward}>
        Older
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

function Actor({ actor }) {
  if (!actor) {
    return (
      <span className="person-cell">
        <span className="system-avatar" aria-hidden="true">
          <Bot />
        </span>
        <span className="person-stack">
          <strong>System</strong>
          <span>automatic</span>
        </span>
      </span>
    );
  }

  return (
    <span className="person-cell">
      <Avatar user={actor} size={28} />
      <span className="person-stack">
        <strong>{actor.name}</strong>
        {actor.role && <span>{ROLE_LABEL[actor.role] ?? actor.role}</span>}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────
// Admin actions — privileged actions (cursor paged)
// ─────────────────────────────────────────────

function AdminActions() {
  const [action, setAction] = useState("");
  // The loaded pages, tagged with the filter they belong to.
  const [feed, setFeed] = useState(null); // { action, events, nextCursor, error }
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  const loading = feed?.action !== action;
  const events = loading ? [] : feed.events;
  const nextCursor = loading ? null : feed.nextCursor;
  const error = (loading ? "" : feed.error) || moreError;

  const fetchPage = useCallback(
    async (cursor) => {
      const response = await api.get("/admin/audit-events", {
        params: {
          limit: EVENTS_PAGE,
          cursor: cursor || undefined,
          action: action || undefined,
        },
      });

      return {
        events: response.data.events || [],
        nextCursor: response.data.nextCursor ?? null,
      };
    },
    [action]
  );

  useEffect(() => {
    let cancelled = false;

    fetchPage(null)
      .then((page) => {
        if (!cancelled) setFeed({ action, ...page, error: "" });
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setFeed({
            action,
            events: [],
            nextCursor: null,
            error: apiError(fetchError, "Unable to load admin actions."),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPage, action]);

  async function loadMore() {
    try {
      setLoadingMore(true);
      setMoreError("");

      const page = await fetchPage(nextCursor);

      setFeed((current) => ({
        ...current,
        events: [...current.events, ...page.events],
        nextCursor: page.nextCursor,
      }));
    } catch (loadError) {
      setMoreError(apiError(loadError, "Unable to load more actions."));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="filters-bar admin-filters audit-filters">
        <label className="admin-select audit-action-filter">
          <span className="audit-filter-label">
            <ListFilter aria-hidden="true" />
            Action
          </span>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setMoreError("");
            }}
          >
            {ACTION_FILTERS.map(([value, label]) => (
              <option key={value || "all"} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="admin-count" aria-live="polite">
          {loading
            ? "Loading…"
            : `${formatNumber(events.length)} ${events.length === 1 ? "action" : "actions"}${nextCursor ? " so far" : ""}`}
        </p>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      {loading ? (
        <Loading label="Loading admin actions…" />
      ) : events.length === 0 ? (
        <EmptyState icon={ScrollText} title="No actions recorded">
          {action ? "Nothing of this kind yet. Try another action." : "Privileged actions will be recorded here."}
        </EmptyState>
      ) : (
        <div className="table-scroll admin-table-scroll">
          <table className="data-table admin-table">
            <caption className="sr-only">Admin actions, newest first</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const Icon = ACTION_META[event.action]?.icon ?? ScrollText;
                const entries = metaEntries(event.meta);

                return (
                  <tr key={event.id}>
                    <td className="nowrap">
                      <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                      <span className="cell-sub">{timeAgo(event.createdAt)}</span>
                    </td>
                    <td>
                      <Actor actor={event.actor} />
                    </td>
                    <td>
                      <span className="audit-action">
                        <span className="audit-action-icon" aria-hidden="true">
                          <Icon />
                        </span>
                        <span className="person-stack">
                          <strong>{actionLabel(event)}</strong>
                          <span>
                            <code className="audit-code">{event.action}</code>
                            {event.entityType && (
                              <>
                                {" · "}
                                {ENTITY_LABEL[event.entityType] ?? labelize(event.entityType)}
                                {event.entityId && <span className="mono"> #{shortId(event.entityId)}</span>}
                              </>
                            )}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <ul className="meta-chips" aria-label="Details">
                        {entries.map((entry) => (
                          <li key={entry.key} className="meta-chip">
                            <span>{entry.label}</span>
                            <strong className={entry.mono ? "mono" : undefined}>{entry.value}</strong>
                          </li>
                        ))}
                        {event.ip && (
                          <li className="meta-chip meta-chip-quiet">
                            <span>IP</span>
                            <strong className="mono">{event.ip}</strong>
                          </li>
                        )}
                        {entries.length === 0 && !event.ip && <li className="muted">—</li>}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && nextCursor && (
        <div className="load-more">
          <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
