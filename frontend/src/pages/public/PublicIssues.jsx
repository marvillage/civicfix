import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Camera,
  Clock,
  Flame,
  List,
  LocateFixed,
  MapIcon,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
  SearchX,
  Siren,
  ThumbsUp,
  X,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import IssueMap from "../../components/IssueMap";
import { FixClockChip } from "../../components/IssueExtras";
import { BarList, ChartFrame } from "../../components/charts";
import {
  CategoryChip,
  EmptyState,
  PageHeader,
  Segmented,
  StatusBadge,
} from "../../components/ui";
import {
  CATEGORIES,
  CATEGORY_META,
  STATUS_LABEL,
} from "../../lib/labels";
import { formatDateTime, formatNumber, timeAgo } from "../../lib/format";

const PAGE_SIZE = 24;
const MAP_PAGE_SIZE = 200;
const EMPTY = [];

const STATUSES = [
  "REPORTED",
  "AI_VERIFIED",
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "SLA_BREACHED",
  "ESCALATED",
  "REOPENED",
  "RESOLVED",
  "CITIZEN_VERIFICATION",
  "CLOSED",
];

const VIEWS = [
  { value: "list", label: "List", icon: List },
  { value: "map", label: "Map", icon: MapIcon },
  { value: "hotspots", label: "Hotspots", icon: Flame },
];

const RADII = [
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
  { value: 2000, label: "2 km" },
  { value: 5000, label: "5 km" },
];

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "upvotes", label: "Most backed" },
  { value: "oldest", label: "Oldest first" },
];

function formatDistance(meters) {
  if (meters == null) return "";

  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function isOverdue(issue) {
  const deadline = issue.sla?.deadline
    ? new Date(issue.sla.deadline).getTime()
    : NaN;

  return (
    ["SLA_BREACHED", "ESCALATED"].includes(issue.status) ||
    (!!issue.sla?.breached &&
      !["RESOLVED", "CLOSED", "CITIZEN_VERIFICATION"].includes(issue.status)) ||
    (Number.isFinite(deadline) &&
      deadline < Date.now() &&
      !["RESOLVED", "CLOSED", "CITIZEN_VERIFICATION", "DUPLICATE"].includes(
        issue.status
      ))
  );
}

export default function PublicIssues() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();

  const view = VIEWS.some((v) => v.value === params.get("view"))
    ? params.get("view")
    : "list";
  const category = params.get("category") || "";
  const status = params.get("status") || "";
  const wardId = params.get("ward") || "";
  const sort = params.get("sort") || "newest";
  const search = params.get("q") || "";

  const [q, setQ] = useState(search);
  const [nearMe, setNearMe] = useState(null);
  const [radius, setRadius] = useState(1000);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [publicWards, setPublicWards] = useState(EMPTY);

  // One result per request key; "loading" is simply "the result on
  // screen belongs to an older key".
  const [result, setResult] = useState({
    key: null,
    issues: EMPTY,
    nextCursor: null,
    error: "",
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState({ key: null, message: "" });

  const update = useCallback(
    (patch) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }

          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  // Search as you type (debounced) — the URL holds the applied query.
  useEffect(() => {
    const trimmed = q.trim();

    if (trimmed === search) return undefined;

    const timer = setTimeout(() => update({ q: trimmed }), 400);

    return () => clearTimeout(timer);
  }, [q, search, update]);

  // Ward options come from the public ward list (the case list is
  // paginated, so it can't be the source). Falls back to the wards
  // seen in loaded cases when the list is unavailable.
  useEffect(() => {
    api
      .get("/organization/public-wards")
      .then((response) => setPublicWards(response.data.wards || []))
      .catch(() => setPublicWards([]));
  }, []);

  const query = useMemo(
    () => ({
      q: search || undefined,
      category: category || undefined,
      status: status || undefined,
      wardId: wardId || undefined,
      sort: sort === "newest" ? undefined : sort,
      // Maps read better with many pins; the list pages in 24s.
      limit: view === "list" ? PAGE_SIZE : MAP_PAGE_SIZE,
    }),
    [search, category, status, wardId, sort, view]
  );

  const requestKey = JSON.stringify([query, nearMe, radius, reloadKey]);
  const loading = result.key !== requestKey;
  const issues = loading ? EMPTY : result.issues;
  const nextCursor = loading ? null : result.nextCursor;
  const error = geoError || (loading ? "" : result.error);

  useEffect(() => {
    let cancelled = false;

    const request = nearMe
      ? api.get("/issues/nearby", {
          params: {
            lat: nearMe.lat,
            lng: nearMe.lng,
            radius,
            limit: 50,
            category: query.category,
          },
        })
      : api.get("/issues", { params: query });

    request
      .then((response) => {
        if (cancelled) return;

        setResult({
          key: requestKey,
          issues: response.data.issues || [],
          nextCursor: nearMe ? null : response.data.nextCursor ?? null,
          error: "",
        });
      })
      .catch((fetchError) => {
        if (cancelled) return;

        console.error("Fetch City Radar error:", fetchError);
        setResult({
          key: requestKey,
          issues: EMPTY,
          nextCursor: null,
          error:
            fetchError.response?.data?.message ||
            "Couldn't load cases. Check your connection and try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, query, nearMe, radius]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;

    const key = requestKey;

    setLoadingMore(true);
    setMoreError({ key: null, message: "" });

    try {
      const response = await api.get("/issues", {
        params: { ...query, cursor: nextCursor },
      });

      setResult((previous) => {
        if (previous.key !== key) return previous;

        const seen = new Set(previous.issues.map((issue) => issue.id));

        return {
          ...previous,
          issues: [
            ...previous.issues,
            ...(response.data.issues || []).filter(
              (issue) => !seen.has(issue.id)
            ),
          ],
          nextCursor: response.data.nextCursor ?? null,
        };
      });
    } catch (fetchError) {
      setMoreError({
        key,
        message:
          fetchError.response?.data?.message || "Couldn't load more cases.",
      });
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleNearMe() {
    setGeoError("");

    if (nearMe) {
      setNearMe(null);
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Your browser can't share its location.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setNearMe({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setGeoError(
          "Couldn't get your location. Allow location access and try again."
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function clearFilters() {
    setQ("");
    update({ q: "", category: "", status: "", ward: "", sort: "" });
  }

  // The nearby endpoint only filters by category; apply the rest here.
  const visible = useMemo(() => {
    if (!nearMe) return issues;

    const needle = search.toLowerCase();

    return issues.filter(
      (issue) =>
        (!status || issue.status === status) &&
        (!wardId || issue.wardId === wardId || issue.ward?.id === wardId) &&
        (!needle ||
          [issue.title, issue.description, issue.address]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(needle)))
    );
  }, [issues, nearMe, search, status, wardId]);

  const wards = useMemo(() => {
    const map = new Map();

    if (publicWards.length > 0) {
      publicWards.forEach((ward) => {
        if (ward?.id) {
          map.set(ward.id, ward.code ? `${ward.name} (${ward.code})` : ward.name);
        }
      });
    } else {
      issues.forEach((issue) => {
        if (issue.ward?.id) map.set(issue.ward.id, issue.ward.name);
      });
    }

    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [publicWards, issues]);

  const alerts = visible.filter((issue) => issue.isEmergency).length;
  const overdue = visible.filter(isOverdue).length;
  const hasFilters = !!(search || category || status || wardId);
  const reportPath = can("issue:report") ? "/citizen/report" : "/report";

  const wardRows = useMemo(() => {
    const counts = new Map();

    visible.forEach((issue) => {
      const name = issue.ward?.name || "No ward";
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [visible]);

  const categoryRows = useMemo(() => {
    const counts = new Map();

    visible.forEach((issue) => {
      const key = CATEGORY_META[issue.category] ? issue.category : "OTHER";
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([key, value]) => {
        const meta = CATEGORY_META[key];
        const Icon = meta.icon;

        return {
          key,
          label: meta.short,
          value,
          color: meta.series,
          icon: <Icon aria-hidden="true" />,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [visible]);

  return (
    <div className="page radar">
      <PageHeader
        eyebrow={FEATURES.radar}
        title="What's broken, and where"
        description="Every public case in the city, live. Filter it, map it, find what's near you, and back the ones that matter."
        actions={
          <>
            <button
              type="button"
              className={nearMe ? "btn-accent" : "btn-secondary"}
              onClick={toggleNearMe}
              disabled={locating}
              aria-pressed={!!nearMe}
            >
              {locating ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <LocateFixed aria-hidden="true" />
              )}
              {locating ? "Locating…" : "Near me"}
            </button>

            <Segmented
              label="View"
              options={VIEWS}
              value={view}
              onChange={(value) =>
                update({ view: value === "list" ? "" : value })
              }
            />
          </>
        }
      />

      <div className="radar-controls">
        <div
          className="radar-cats"
          role="group"
          aria-label="Filter by category"
        >
          <button
            type="button"
            className={`radar-cat ${category ? "" : "is-active"}`}
            aria-pressed={!category}
            onClick={() => update({ category: "" })}
          >
            All categories
          </button>

          {CATEGORIES.map((key) => {
            const meta = CATEGORY_META[key];
            const Icon = meta.icon;

            return (
              <button
                key={key}
                type="button"
                className={`radar-cat ${category === key ? "is-active" : ""}`}
                aria-pressed={category === key}
                onClick={() =>
                  update({ category: category === key ? "" : key })
                }
              >
                <span className={`cat-dot cat-${key}`} aria-hidden="true" />
                <Icon aria-hidden="true" />
                {meta.short}
              </button>
            );
          })}
        </div>

        <div className="filters-bar radar-filters">
          <div className="search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search title, description or address"
              aria-label="Search cases"
            />
          </div>

          <select
            value={status}
            onChange={(event) => update({ status: event.target.value })}
            aria-label="Filter by status"
          >
            <option value="">All active statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>

          <select
            value={wardId}
            onChange={(event) => update({ ward: event.target.value })}
            aria-label="Filter by ward"
          >
            <option value="">All wards</option>
            {wards.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) =>
              update({
                sort: event.target.value === "newest" ? "" : event.target.value,
              })
            }
            aria-label="Sort cases"
            disabled={!!nearMe}
            title={nearMe ? "Near me sorts by distance" : undefined}
          >
            {nearMe ? (
              <option value={sort}>Nearest first</option>
            ) : (
              SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
          </select>

          {hasFilters && (
            <button
              type="button"
              className="btn-ghost"
              onClick={clearFilters}
            >
              <RotateCcw aria-hidden="true" />
              Clear
            </button>
          )}
        </div>

        {nearMe && (
          <div className="radar-near" role="status">
            <span className="radar-near-label">
              <Navigation aria-hidden="true" />
              Cases within
            </span>

            <Segmented
              label="Search radius"
              options={RADII}
              value={radius}
              onChange={setRadius}
            />

            <button
              type="button"
              className="btn-ghost btn-sm radar-near-off"
              onClick={() => setNearMe(null)}
            >
              <X aria-hidden="true" />
              Turn off
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="form-error radar-error">
          <span>{error}</span>
          <button
            type="button"
            className="btn-sm btn-secondary"
            onClick={() => {
              setGeoError("");
              setReloadKey((key) => key + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <p className="radar-summary" aria-live="polite">
          <strong>
            {formatNumber(visible.length)}
            {nextCursor ? "+" : ""}
          </strong>{" "}
          {visible.length === 1 ? "case" : "cases"}
          {nearMe && ` within ${formatDistance(radius)}`}
          {alerts > 0 && (
            <span className="radar-summary-alert">
              <Siren aria-hidden="true" />
              {alerts} {FEATURES.redAlert}
            </span>
          )}
          {overdue > 0 && (
            <span className="radar-summary-late">
              <Clock aria-hidden="true" />
              {overdue} past their {FEATURES.fixClock}
            </span>
          )}
        </p>
      )}

      {loading ? (
        <div className="radar-list" aria-busy="true" aria-label="Loading cases">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="issue-card radar-skeleton">
              <span className="skeleton" style={{ width: "40%", height: 22 }} />
              <span className="skeleton" style={{ width: "85%", height: 20 }} />
              <span className="skeleton" style={{ width: "100%", height: 38 }} />
              <span className="skeleton" style={{ width: "60%", height: 16 }} />
            </div>
          ))}
        </div>
      ) : error ? null : visible.length === 0 ? (
        nearMe ? (
          <EmptyState
            icon={Navigation}
            title={`Nothing within ${formatDistance(radius)}`}
            action={
              radius < 5000 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRadius(5000)}
                >
                  Widen to 5 km
                </button>
              )
            }
          >
            No active cases near you{hasFilters ? " match these filters" : ""}.
            Spotted something? Report it and it'll show up here.
          </EmptyState>
        ) : hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="No cases match"
            action={
              <button
                type="button"
                className="btn-secondary"
                onClick={clearFilters}
              >
                <RotateCcw aria-hidden="true" />
                Clear filters
              </button>
            }
          >
            Try another category or status, or search for a street name.
          </EmptyState>
        ) : (
          <EmptyState
            icon={MapPin}
            title="Quiet streets"
            action={
              <Link to={reportPath} className="btn btn-accent">
                <Camera aria-hidden="true" />
                Report an issue
              </Link>
            }
          >
            There are no active public cases right now.
          </EmptyState>
        )
      ) : view === "map" ? (
        <section className="radar-map-view">
          <IssueMap
            issues={visible}
            center={nearMe}
            radius={nearMe ? radius : null}
            height="clamp(420px, 64vh, 660px)"
            label={`${FEATURES.radar} map`}
          />

          <ul className="radar-legend" aria-label="Category colors">
            {CATEGORIES.map((key) => (
              <li key={key}>
                <span className={`radar-legend-pin cat-${key}`} aria-hidden="true" />
                {CATEGORY_META[key].label}
              </li>
            ))}
            <li>
              <span className="radar-legend-pin is-alert" aria-hidden="true" />
              {FEATURES.redAlert}
            </li>
          </ul>
        </section>
      ) : view === "hotspots" ? (
        <section className="grid-main-side radar-hotspots">
          <IssueMap
            issues={visible}
            heat
            center={nearMe}
            radius={nearMe ? radius : null}
            height="clamp(420px, 64vh, 640px)"
            label={`${FEATURES.radar} hotspots`}
          />

          <div className="stack">
            <ChartFrame
              title="Busiest wards"
              subtitle={`Of the ${visible.length} cases shown`}
              table={{
                columns: [
                  { key: "label", label: "Ward" },
                  { key: "value", label: "Cases", numeric: true },
                ],
                rows: wardRows,
              }}
            >
              <BarList data={wardRows} />
            </ChartFrame>

            <ChartFrame
              title="By category"
              subtitle="What the hotspots are made of"
              table={{
                columns: [
                  { key: "label", label: "Category" },
                  { key: "value", label: "Cases", numeric: true },
                ],
                rows: categoryRows,
              }}
            >
              <BarList data={categoryRows} />
            </ChartFrame>
          </div>
        </section>
      ) : (
        <section className="radar-list" aria-label="Cases">
          {visible.map((issue) => (
            <RadarCard key={issue.id} issue={issue} />
          ))}
        </section>
      )}

      {!loading && !error && nextCursor && (
        <div className="radar-more">
          {moreError.key === requestKey && (
            <p className="text-danger">{moreError.message}</p>
          )}

          <button
            type="button"
            className="btn-secondary btn-lg"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore && <span className="spinner" aria-hidden="true" />}
            {loadingMore ? "Loading…" : "Load more cases"}
          </button>
        </div>
      )}
    </div>
  );
}

function RadarCard({ issue }) {
  const cat = CATEGORY_META[issue.category] ? issue.category : "OTHER";
  const backers = issue._count?.upvotes ?? 0;

  return (
    <article className={`issue-card radar-card cat-${cat}`}>
      <div className="radar-card-top">
        <CategoryChip category={cat} short />
        {issue.isEmergency && (
          <span className="red-alert">
            <Siren aria-hidden="true" />
            {FEATURES.redAlert}
          </span>
        )}
        <span className="radar-card-status">
          <StatusBadge status={issue.status} />
        </span>
      </div>

      <h3>
        <Link to={`/issues/${issue.id}`} className="radar-card-link">
          {issue.title || "Untitled case"}
        </Link>
      </h3>

      {issue.description && (
        <p className="issue-description">{issue.description}</p>
      )}

      {(issue.address || issue.ward?.name) && (
        <p className="radar-card-place">
          <MapPin aria-hidden="true" />
          <span>
            {issue.address}
            {issue.address && issue.ward?.name ? " · " : ""}
            {issue.ward?.name}
          </span>
        </p>
      )}

      <div className="radar-card-foot">
        <span title={formatDateTime(issue.createdAt)}>
          <Clock aria-hidden="true" />
          {timeAgo(issue.createdAt)}
        </span>

        <span>
          <ThumbsUp aria-hidden="true" />
          {backers} {backers === 1 ? "backer" : "backers"}
        </span>

        {issue.distanceMeters != null && (
          <span>
            <Navigation aria-hidden="true" />
            {formatDistance(issue.distanceMeters)} away
          </span>
        )}

        <FixClockChip issue={issue} />
      </div>
    </article>
  );
}
