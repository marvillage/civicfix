import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Clock,
  Inbox,
  List,
  Map as MapIcon,
  MapPin,
  Siren,
  Star,
  TimerOff,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import IssueMap from "../../components/IssueMap";
import {
  BarList,
  ChartFrame,
  ColumnChart,
  Meter,
} from "../../components/charts";
import {
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  SectionHeader,
  Segmented,
  SeverityBadge,
  StatTile,
  StatusBadge,
} from "../../components/ui";
import { formatHours, formatNumber } from "../../lib/format";
import { FixClockChip } from "../CaseKit";
import { firstName, fixClock, greeting, useNow } from "../caseUtils";

const DONE = ["RESOLVED", "CITIZEN_VERIFICATION", "CLOSED"];

function bucketOf(assignment) {
  const status = assignment.issue?.status;

  if (assignment.completedAt || DONE.includes(status)) return "RESOLVED";
  if (!assignment.acceptedAt) return "PENDING";

  return "ACTIVE";
}

function stageOf(assignment) {
  const status = assignment.issue?.status;

  if (status === "CLOSED") return "Signed off";
  if (assignment.completedAt || DONE.includes(status)) {
    return `Waiting for ${FEATURES.signOff}`;
  }
  if (!assignment.acceptedAt) return "Waiting for you to accept";
  if (status === "REOPENED") return "Reopened: restart work";
  if (status === "IN_PROGRESS") return "On site";
  if (status === "ESCALATED" || status === "SLA_BREACHED") return "Escalated";

  return "Accepted, not started";
}

// Most urgent first: Red Alerts, then the most overdue, then the
// nearest deadline, then no deadline; finished jobs last.
function urgency(row) {
  if (row.bucket === "RESOLVED") return Number.MAX_SAFE_INTEGER;
  if (row.issue.isEmergency) return -4e15 + (row.clock?.remainingMs ?? 0);
  if (!row.clock) return Number.MAX_SAFE_INTEGER - 1;
  if (row.clock.state === "breached") return -2e15 + row.clock.remainingMs;

  return row.clock.remainingMs;
}

// Stage → short chart label, in pipeline order.
const STAGE_ORDER = [
  ["Waiting for you to accept", "To accept"],
  ["Accepted, not started", "Not started"],
  ["On site", "On site"],
  ["Reopened: restart work", "Reopened"],
  ["Escalated", "Escalated"],
  [`Waiting for ${FEATURES.signOff}`, "To sign off"],
  ["Signed off", "Signed off"],
];

function RatingStars({ value }) {
  const rounded = Math.round(value ?? 0);

  return (
    <span className="cq-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={star <= rounded ? "is-on" : ""} />
      ))}
    </span>
  );
}

const QUEUE_PAGE = 15;

export default function AuthorityDashboard() {
  const { user } = useAuth();
  const now = useNow(30_000);

  const [assignments, setAssignments] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("OPEN");
  const [shown, setShown] = useState(QUEUE_PAGE);
  const [view, setView] = useState("list");

  useEffect(() => {
    let cancelled = false;

    async function fetchQueue() {
      const [assignRes, perfRes] = await Promise.allSettled([
        api.get("/assignments/my"),
        api.get("/dashboard/my-performance"),
      ]);

      if (cancelled) return;

      if (assignRes.status === "fulfilled") {
        setAssignments(assignRes.value.data.assignments || []);
      } else {
        console.error("Fetch assignments error:", assignRes.reason);
        setError(
          assignRes.reason?.response?.data?.message ||
            "Unable to load your jobs."
        );
      }

      if (perfRes.status === "fulfilled") {
        setPerformance(perfRes.value.data.performance || null);
      }

      setLoading(false);
    }

    fetchQueue();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Loading label={`Loading your ${FEATURES.crewQueue}…`} />;
  }

  const rows = assignments
    .filter((assignment) => assignment.issue)
    .map((assignment) => {
      const bucket = bucketOf(assignment);

      return {
        assignment,
        issue: assignment.issue,
        bucket,
        stage: stageOf(assignment),
        clock: fixClock(
          {
            sla: assignment.issue.sla,
            status: assignment.issue.status,
            createdAt: assignment.issue.createdAt,
            done: bucket === "RESOLVED",
          },
          now
        ),
      };
    })
    .sort((a, b) => urgency(a) - urgency(b));

  const counts = rows.reduce(
    (acc, row) => ({ ...acc, [row.bucket]: acc[row.bucket] + 1 }),
    { PENDING: 0, ACTIVE: 0, RESOLVED: 0 }
  );
  const open = rows.filter((row) => row.bucket !== "RESOLVED");
  const breached = open.filter((row) => row.clock?.state === "breached");
  const urgent = open.filter((row) => row.clock?.state === "urgent");

  const matching = rows.filter((row) =>
    filter === "OPEN" ? row.bucket !== "RESOLVED" : row.bucket === filter
  );
  // Officers accumulate years of finished jobs; show a page at a time.
  const visible = matching.slice(0, shown);
  const hiddenCount = matching.length - visible.length;

  function chooseFilter(next) {
    setFilter(next);
    setShown(QUEUE_PAGE);
  }
  const mapIssues = visible
    .map((row) => row.issue)
    .filter(
      (issue) =>
        Number.isFinite(issue.latitude) && Number.isFinite(issue.longitude)
    );

  // Officer Scorecard
  const stageRows = STAGE_ORDER.map(([stage, short]) => ({
    key: stage,
    label: short,
    value: rows.filter((row) => row.stage === stage).length,
  })).filter((row) => row.value > 0);

  const series = (performance?.monthly ?? performance?.series ?? []).filter(
    (point) => point && (point.month || point.label)
  );

  let lede = "Nothing open. New jobs land here the moment they're dispatched.";

  if (open.length) {
    const parts = [`${open.length} open ${open.length === 1 ? "job" : "jobs"}`];

    if (breached.length) parts.push(`${breached.length} past the ${FEATURES.fixClock}`);
    if (urgent.length) parts.push(`${urgent.length} due within 4 hours`);
    if (counts.PENDING) parts.push(`${counts.PENDING} waiting for you to accept`);

    lede = `${parts.join(" · ")}.`;
  }

  const filterLabel = (label, count) => (
    <>
      {label}
      <span className="cq-count">{count}</span>
    </>
  );

  return (
    <div className="page crew-queue">
      <PageHeader
        eyebrow={FEATURES.crewQueue}
        title={`${greeting()}, ${firstName(user?.name, "officer")}`}
        description={lede}
      />

      {error && <div className="form-error">{error}</div>}

      <section className="kpi-row" aria-label="Your jobs at a glance">
        <StatTile
          label="Open jobs"
          value={formatNumber(open.length)}
          hint={
            counts.PENDING
              ? `${counts.PENDING} to accept`
              : "all accepted"
          }
          icon={ClipboardList}
          tone="navy"
        />
        <StatTile
          label="Due within 4 hours"
          value={formatNumber(urgent.length)}
          hint={`on the ${FEATURES.fixClock}`}
          icon={AlarmClock}
          tone="warning"
        />
        <StatTile
          label={`Past the ${FEATURES.fixClock}`}
          value={formatNumber(breached.length)}
          hint={breached.length ? "escalated to admins" : "none overdue"}
          icon={TimerOff}
          tone="danger"
        />
        <StatTile
          label="Fixed this month"
          value={formatNumber(performance?.completedThisMonth ?? 0)}
          hint={
            performance?.completed != null
              ? `${formatNumber(performance.completed)} all time`
              : undefined
          }
          icon={CircleCheck}
          tone="success"
        />
      </section>

      <div className="grid-main-side cq-layout">
        <section className="card cq-queue" aria-labelledby="queue-title">
          <SectionHeader
            eyebrow="Your jobs"
            title={<span id="queue-title">Most urgent first</span>}
            actions={
              <Segmented
                label="View"
                value={view}
                onChange={setView}
                options={[
                  { value: "list", label: "List", icon: List },
                  { value: "map", label: FEATURES.routeMap, icon: MapIcon },
                ]}
              />
            }
          />

          <div className="cq-filters">
            <Segmented
              label="Filter jobs"
              value={filter}
              onChange={chooseFilter}
              options={[
                { value: "OPEN", label: filterLabel("Open", open.length) },
                { value: "PENDING", label: filterLabel("To accept", counts.PENDING) },
                { value: "ACTIVE", label: filterLabel("Active", counts.ACTIVE) },
                { value: "RESOLVED", label: filterLabel("Resolved", counts.RESOLVED) },
              ]}
            />
          </div>

          {rows.length === 0 && !error ? (
            <EmptyState icon={Inbox} title="No jobs yet">
              Cases dispatched to you show up here, sorted by how close
              they are to their {FEATURES.fixClock}.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Nothing here"
              action={
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => chooseFilter("RESOLVED")}
                >
                  Show finished jobs
                </button>
              }
            >
              {filter === "OPEN"
                ? "Nothing open. New jobs land here the moment they're dispatched."
                : "No jobs in this view right now."}
            </EmptyState>
          ) : view === "map" ? (
            <div className="cq-route">
              <div className="cq-map">
                {mapIssues.length > 0 ? (
                  <IssueMap issues={mapIssues} linkBase="/authority/issues" />
                ) : (
                  <p className="empty-inline">None of these jobs has a pin.</p>
                )}
              </div>

              <ol className="cq-stops" aria-label="Stops, most urgent first">
                {visible.map((row, index) => (
                  <li key={row.assignment.id}>
                    <span className="cq-stop-num" aria-hidden="true">
                      {index + 1}
                    </span>
                    <Link
                      to={`/authority/issues/${row.issue.id}`}
                      className="cq-stop-link"
                    >
                      <strong>{row.issue.title}</strong>
                      <span>{row.issue.address || row.issue.ward?.name}</span>
                    </Link>
                    {row.clock && <FixClockChip clock={row.clock} />}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <ul className="cq-list">
              {visible.map((row) => {
                const { assignment, issue, clock } = row;
                const tone = issue.isEmergency
                  ? "breached"
                  : (clock?.state ?? "none");

                return (
                  <li key={assignment.id}>
                    <Link
                      to={`/authority/issues/${issue.id}`}
                      className={`cq-job cq-job-${tone} ${
                        row.bucket === "RESOLVED" ? "is-done" : ""
                      }`}
                    >
                      <span className="cq-job-main">
                        <span className="cq-job-chips">
                          {row.bucket === "PENDING" && (
                            <span className="chip chip-accent">New</span>
                          )}
                          {issue.isEmergency && (
                            <span className="red-alert">
                              <Siren aria-hidden="true" />
                              {FEATURES.redAlert}
                            </span>
                          )}
                          <StatusBadge status={issue.status} />
                          {issue.category && (
                            <CategoryChip category={issue.category} short />
                          )}
                          <SeverityBadge severity={issue.severity} />
                        </span>

                        <strong className="cq-job-title">{issue.title}</strong>

                        <span className="meta-row">
                          <span className="cq-stage">{row.stage}</span>
                          {(issue.address || assignment.ward?.name) && (
                            <span className="cq-job-place">
                              <MapPin aria-hidden="true" />
                              {issue.address || assignment.ward?.name}
                            </span>
                          )}
                        </span>
                      </span>

                      <span className="cq-job-clock">
                        {clock ? (
                          <>
                            <span className="cq-clock-big">
                              {clock.state === "done"
                                ? "Done"
                                : clock.state === "breached"
                                  ? "Overdue"
                                  : clock.short}
                            </span>
                            <span className="cq-clock-sub">
                              {clock.state === "done"
                                ? clock.label
                                : clock.state === "breached"
                                  ? clock.label.replace("Breached · ", "")
                                  : "left"}
                            </span>
                          </>
                        ) : (
                          <span className="cq-clock-sub">
                            <Clock aria-hidden="true" />
                            No deadline
                          </span>
                        )}
                      </span>

                      <ChevronRight className="cq-job-arrow" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {hiddenCount > 0 && (
            <button
              type="button"
              className="btn-secondary btn-block cq-more"
              onClick={() => setShown((count) => count + QUEUE_PAGE)}
            >
              Show {Math.min(QUEUE_PAGE, hiddenCount)} more
              <span className="muted">({hiddenCount} left)</span>
            </button>
          )}
        </section>

        <aside className="cq-side">
          <section className="card cq-score" aria-labelledby="score-title">
            <SectionHeader
              eyebrow={FEATURES.scorecard}
              title={<span id="score-title">How you're doing</span>}
            />

            {performance ? (
              <>
                <Meter
                  label={`${FEATURES.fixClock} hit rate`}
                  value={performance.slaHitRate ?? null}
                />

                <div className="cq-figures">
                  <div>
                    <span className="detail-label">Average fix</span>
                    <strong>{formatHours(performance.avgResolutionHours)}</strong>
                  </div>
                  <div>
                    <span className="detail-label">Citizen rating</span>
                    <strong>
                      {performance.avgRating != null
                        ? Number(performance.avgRating).toFixed(1)
                        : "—"}
                      {performance.avgRating != null && (
                        <RatingStars value={performance.avgRating} />
                      )}
                    </strong>
                    <small>
                      {performance.ratingsCount
                        ? `${formatNumber(performance.ratingsCount)} ${
                            performance.ratingsCount === 1 ? "rating" : "ratings"
                          }`
                        : "No ratings yet"}
                    </small>
                  </div>
                  <div>
                    <span className="detail-label">Assigned</span>
                    <strong>{formatNumber(performance.totalAssigned ?? rows.length)}</strong>
                  </div>
                  <div>
                    <span className="detail-label">Completed</span>
                    <strong>{formatNumber(performance.completed ?? counts.RESOLVED)}</strong>
                  </div>
                </div>
              </>
            ) : (
              <p className="empty-inline">
                Your numbers appear after your first finished job.
              </p>
            )}
          </section>

          {series.length > 1 && (
            <ChartFrame
              title="Fixes per month"
              subtitle="Jobs you resolved"
              table={{
                columns: [
                  { key: "label", label: "Month" },
                  { key: "value", label: "Fixes", numeric: true },
                ],
                rows: series.map((point) => ({
                  label: point.month ?? point.label,
                  value: point.completed ?? point.count ?? point.value ?? 0,
                })),
              }}
            >
              <ColumnChart
                data={series.map((point, index) => ({
                  label: point.month ?? point.label,
                  value: point.completed ?? point.count ?? point.value ?? 0,
                  seriesLabel: "Fixes",
                  color:
                    index === series.length - 1
                      ? "var(--series-2)"
                      : "var(--series-1)",
                }))}
                height={180}
                ariaLabel="Fixes per month"
              />
            </ChartFrame>
          )}

          {stageRows.length > 0 && (
            <ChartFrame
              title="Where your jobs are"
              subtitle="Every assignment, by stage"
              table={{
                columns: [
                  { key: "label", label: "Stage" },
                  { key: "value", label: "Jobs", numeric: true },
                ],
                rows: stageRows,
              }}
            >
              <BarList data={stageRows} />
            </ChartFrame>
          )}
        </aside>
      </div>
    </div>
  );
}
