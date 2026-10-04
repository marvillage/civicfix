import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CircleCheck,
  Clock,
  IndianRupee,
  Inbox,
  MapPinned,
  Star,
  Timer,
  Wallet,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import {
  BarList,
  ChartFrame,
  ColumnChart,
  Heatmap,
  LineChart,
  Meter,
  Sparkline,
  StackedBars,
} from "../../components/charts";
import {
  EmptyState,
  Loading,
  PageHeader,
  SectionHeader,
  Segmented,
  StatTile,
} from "../../components/ui";
import { CATEGORIES, CATEGORY_META } from "../../lib/labels";
import {
  formatCompact,
  formatHours,
  formatINR,
  formatNumber,
  formatPct,
} from "../../lib/format";
import WardMap from "./WardMap";

const RANGES = [
  { value: "30d", label: "30 days", long: "last 30 days" },
  { value: "90d", label: "90 days", long: "last 90 days" },
  { value: "12m", label: "12 months", long: "last 12 months" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) =>
  h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`
);

const GRADE_TONE = {
  A: "chip-success",
  B: "chip-success",
  C: "chip-warning",
  D: "chip-danger",
  F: "chip-danger",
};

// One hue stepped light → dark for the ordered 1–5 star scale.
function starColor(stars) {
  return `color-mix(in oklab, var(--seq-high) ${30 + stars * 14}%, var(--seq-low))`;
}

function bucketLabel(bucket) {
  return (iso) => {
    const date = new Date(iso);

    if (bucket === "month") {
      return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    }

    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
}

function bucketTooltip(bucket) {
  return (iso) => {
    const date = new Date(iso);

    if (bucket === "month") {
      return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }

    if (bucket === "week") {
      return `Week of ${date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
    }

    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };
}

function pctChange(current, previous) {
  if (!previous) return null;

  return ((current - previous) / previous) * 100;
}

export default function CityPulse() {
  const { can } = useAuth();
  const [range, setRange] = useState("90d");
  const [wardId, setWardId] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState(null);
  const [wardOptions, setWardOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedWard, setSelectedWard] = useState(null);
  const [mixPercent, setMixPercent] = useState("share");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setRefreshing(true);
      setError("");

      try {
        const response = await api.get("/pulse", {
          params: {
            range,
            wardId: wardId || undefined,
            category: category || undefined,
          },
        });

        if (cancelled) return;

        const next = response.data;
        setData(next);

        // Keep the full ward list from unfiltered responses so the
        // ward picker never shrinks to the current selection.
        if (!wardId && next?.wards?.length) {
          setWardOptions(
            [...next.wards]
              .map(({ id, name, code }) => ({ id, name, code }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.response?.data?.message ||
              "City Pulse is unavailable right now."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [range, wardId, category]);

  const focusWard = useCallback((id) => setSelectedWard(id), []);

  const view = useMemo(() => {
    if (!data) return null;

    const bucket = data.range?.bucket ?? "week";
    const flow = data.flow ?? [];
    const kpis = data.kpis ?? {};

    const categoryRows = (data.byCategory ?? [])
      .map((row) => {
        const meta = CATEGORY_META[row.category] ?? CATEGORY_META.OTHER;
        const Icon = meta.icon;

        return {
          key: row.category,
          label: meta.label,
          value: row.reported,
          resolved: row.resolved,
          medianFixHours: row.medianFixHours,
          color: meta.series,
          icon: <Icon aria-hidden="true" />,
          hint: `fixed in ${formatHours(row.medianFixHours)}`,
        };
      })
      .sort((a, b) => b.value - a.value);

    const wards = [...(data.wards ?? [])].sort(
      (a, b) => (b.total || 0) - (a.total || 0)
    );

    const mixKeys = CATEGORIES.map((key) => ({
      key,
      label: CATEGORY_META[key].label,
      color: CATEGORY_META[key].series,
    })).filter((k) =>
      wards.some((ward) => (ward.byCategory?.[k.key] ?? 0) > 0)
    );

    const spendRows = (data.spendByCategory ?? [])
      .filter((row) => row.amount > 0)
      .map((row) => {
        const meta = CATEGORY_META[row.category] ?? CATEGORY_META.OTHER;
        const Icon = meta.icon;

        return {
          key: row.category,
          label: meta.label,
          value: row.amount,
          color: meta.series,
          icon: <Icon aria-hidden="true" />,
        };
      })
      .sort((a, b) => b.value - a.value);

    const ratingTotal = (data.ratings ?? []).reduce(
      (sum, row) => sum + row.count,
      0
    );

    return {
      bucket,
      flow,
      kpis,
      categoryRows,
      wards,
      mixKeys,
      spendRows,
      ratingTotal,
      formatX: bucketLabel(bucket),
      formatTip: bucketTooltip(bucket),
    };
  }, [data]);

  if (loading) {
    return <Loading label="Taking the city's pulse…" />;
  }

  if (!data || !view) {
    return (
      <div className="page">
        <PageHeader eyebrow={FEATURES.pulse} title="How the city is doing" />
        <EmptyState icon={Activity} title="No pulse yet">
          {error || "There isn't enough data to chart yet."}
        </EmptyState>
      </div>
    );
  }

  const rangeMeta = RANGES.find((r) => r.value === range);
  const { kpis, flow } = view;
  const reportedDelta = pctChange(kpis.reported, kpis.reportedPrev);
  const scopeLabel = [
    wardId && wardOptions.find((w) => w.id === wardId)?.name,
    category && CATEGORY_META[category]?.label,
  ]
    .filter(Boolean)
    .join(" · ");

  const selected =
    view.wards.find((ward) => ward.id === selectedWard) ?? view.wards[0];

  return (
    <div className="page pulse-page">
      <PageHeader
        eyebrow={FEATURES.pulse}
        title="How the city is doing"
        description="Every number here comes straight from the cases themselves: how much breaks, where and when, how fast it gets fixed, what it costs, and what residents think of the work."
        actions={
          can("budget:read") ? (
            <Link to="/budgets" className="btn btn-secondary">
              <Wallet aria-hidden="true" />
              {FEATURES.budgets}
            </Link>
          ) : null
        }
      />

      <div className="pulse-filters" role="group" aria-label="Filter City Pulse">
        <Segmented
          label="Time range"
          options={RANGES}
          value={range}
          onChange={setRange}
        />

        <label className="pulse-select">
          <span className="sr-only">Ward</span>
          <select value={wardId} onChange={(e) => setWardId(e.target.value)}>
            <option value="">All wards</option>
            {wardOptions.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.name} ({ward.code})
              </option>
            ))}
          </select>
        </label>

        <label className="pulse-select">
          <span className="sr-only">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_META[key].label}
              </option>
            ))}
          </select>
        </label>

        {(wardId || category) && (
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => {
              setWardId("");
              setCategory("");
            }}
          >
            Clear filters
          </button>
        )}

        <span className="pulse-scope" aria-live="polite">
          {refreshing ? (
            <>
              <span className="spinner" aria-hidden="true" /> Updating…
            </>
          ) : (
            <>
              {rangeMeta?.long}
              {scopeLabel ? ` · ${scopeLabel}` : " · whole city"}
            </>
          )}
        </span>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className={`pulse-body ${refreshing ? "is-refreshing" : ""}`}>
        <section className="kpi-row pulse-kpis" aria-label="Headline numbers">
          <StatTile
            label="Cases reported"
            value={formatNumber(kpis.reported)}
            delta={reportedDelta ?? undefined}
            upIsGood={false}
            hint="vs previous period"
            icon={Inbox}
            tone="navy"
          >
            <Sparkline
              values={flow.map((row) => row.reported)}
              color="var(--yellow-500)"
              label="Reports trend"
            />
          </StatTile>
          <StatTile
            label="Fixed"
            value={formatNumber(kpis.resolved)}
            hint={
              kpis.reported
                ? `${Math.round((kpis.resolved / kpis.reported) * 100)}% of new reports`
                : undefined
            }
            icon={CircleCheck}
            tone="success"
          />
          <StatTile
            label="Open right now"
            value={formatNumber(kpis.open)}
            hint="the backlog"
            icon={MapPinned}
            tone="warning"
          />
          <StatTile
            label="Median time to fix"
            value={formatHours(kpis.medianFixHours)}
            hint="report → resolved"
            icon={Clock}
          />
          <StatTile
            label={`${FEATURES.fixClock} kept`}
            value={formatPct(kpis.slaCompliance)}
            hint="deadlines met"
            icon={Timer}
          />
          <StatTile
            label="Resident rating"
            value={kpis.avgRating != null ? `${kpis.avgRating.toFixed(1)} / 5` : "—"}
            hint={view.ratingTotal ? `${formatNumber(view.ratingTotal)} sign-offs` : "no sign-offs yet"}
            icon={Star}
          />
        </section>

        <section className="pulse-hero">
          <ChartFrame
            title="Reported vs fixed"
            subtitle={`New cases and resolved cases per ${view.bucket}`}
            legend={[
              { label: "Reported", color: "var(--series-1)", shape: "line" },
              { label: "Fixed", color: "var(--series-2)", shape: "line" },
            ]}
            table={{
              columns: [
                { key: "t", label: "Period", format: view.formatTip },
                { key: "reported", label: "Reported", numeric: true },
                { key: "resolved", label: "Fixed", numeric: true },
              ],
              rows: flow,
            }}
          >
            <LineChart
              data={flow}
              series={[
                { key: "reported", label: "Reported", color: "var(--series-1)" },
                { key: "resolved", label: "Fixed", color: "var(--series-2)" },
              ]}
              formatX={view.formatX}
              formatTooltipX={view.formatTip}
              height={270}
              ariaLabel="Reported versus fixed cases over time. Use arrow keys to read values."
            />
          </ChartFrame>

          <ChartFrame
            title="Backlog"
            subtitle={`Open cases at the end of each ${view.bucket}`}
            table={{
              columns: [
                { key: "t", label: "Period", format: view.formatTip },
                { key: "open", label: "Open", numeric: true },
              ],
              rows: data.backlog ?? [],
            }}
          >
            <LineChart
              data={data.backlog ?? []}
              series={[
                { key: "open", label: "Open cases", color: "var(--series-1)", area: true },
              ]}
              formatX={view.formatX}
              formatTooltipX={view.formatTip}
              height={270}
              maxXLabels={3}
              ariaLabel="Open backlog over time"
            />
          </ChartFrame>
        </section>

        <section className="grid-2">
          <ChartFrame
            title="When the city reports problems"
            subtitle="By weekday and hour (IST): commutes are when people notice"
            table={{
              columns: [
                { key: "day", label: "Day" },
                ...HOURS.map((label, h) => ({
                  key: `h${h}`,
                  label,
                  numeric: true,
                })),
              ],
              rows: (data.heatmap ?? []).map((row, d) => ({
                id: d,
                day: WEEKDAYS[d],
                ...Object.fromEntries(row.map((v, h) => [`h${h}`, v])),
              })),
            }}
          >
            <Heatmap
              matrix={data.heatmap ?? []}
              rowLabels={WEEKDAYS}
              colLabels={HOURS}
              colLabelEvery={3}
            />
          </ChartFrame>

          <ChartFrame
            title="What breaks"
            subtitle="Reports by category, with median time to fix"
            table={{
              columns: [
                { key: "label", label: "Category" },
                { key: "value", label: "Reported", numeric: true },
                { key: "resolved", label: "Fixed", numeric: true },
                {
                  key: "medianFixHours",
                  label: "Median fix",
                  numeric: true,
                  format: (v) => formatHours(v),
                },
              ],
              rows: view.categoryRows,
            }}
          >
            <BarList data={view.categoryRows} />
          </ChartFrame>
        </section>

        <section className="card pulse-wards">
          <SectionHeader
            eyebrow="Ward Scorecards"
            title="Which wards keep their promises"
            description="Graded A–F on resolution rate and Fix Clock compliance. Bubble size is the open backlog; tap a ward to inspect it."
          />

          {view.wards.length === 0 ? (
            <EmptyState icon={MapPinned} title="No ward data for this filter" />
          ) : (
            <div className="pulse-wards-grid">
              <WardMap
                wards={view.wards}
                selectedId={selected?.id}
                onSelect={focusWard}
              />

              <ul className="ward-score-list">
                {view.wards.map((ward) => (
                  <li key={ward.id}>
                    <button
                      type="button"
                      className={`ward-score ${ward.id === selected?.id ? "is-selected" : ""}`}
                      onClick={() => focusWard(ward.id)}
                      aria-pressed={ward.id === selected?.id}
                    >
                      <span className={`grade-badge grade-${ward.grade ?? "none"}`}>
                        {ward.grade ?? "–"}
                        <span className="sr-only"> grade</span>
                      </span>

                      <span className="ward-score-main">
                        <strong>
                          {ward.name} <span className="muted">{ward.code}</span>
                        </strong>

                        <Meter
                          label="Resolved"
                          value={ward.resolutionRate}
                        />
                        <Meter
                          label={`${FEATURES.fixClock} kept`}
                          value={ward.slaCompliance}
                        />
                      </span>

                      <span className="ward-score-open">
                        <strong>{formatNumber(ward.open)}</strong>
                        <span>open</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected && !wardId && (
            <div className="ward-focus">
              <span className={`chip ${GRADE_TONE[selected.grade] ?? "chip-outline"}`}>
                Grade {selected.grade ?? "–"}
              </span>
              <span>
                <strong>{selected.name}</strong>: {formatNumber(selected.total)} cases in
                the {rangeMeta?.long}, {formatNumber(selected.resolved)} fixed.
              </span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setWardId(selected.id)}
              >
                Focus the Pulse on {selected.name}
              </button>
            </div>
          )}
        </section>

        {view.mixKeys.length > 0 && view.wards.length > 1 && (
          <ChartFrame
            title="What each ward reports"
            subtitle={
              mixPercent === "share"
                ? "Share of each ward's cases by category"
                : "Cases per ward by category"
            }
            legend={view.mixKeys.map((k) => ({
              label: k.label,
              color: k.color,
              shape: "rect",
            }))}
            actions={
              <Segmented
                label="Scale"
                options={[
                  { value: "share", label: "Share" },
                  { value: "count", label: "Count" },
                ]}
                value={mixPercent}
                onChange={setMixPercent}
              />
            }
            table={{
              columns: [
                { key: "label", label: "Ward" },
                ...view.mixKeys.map((k) => ({
                  key: k.key,
                  label: k.label,
                  numeric: true,
                })),
                { key: "total", label: "Total", numeric: true },
              ],
              rows: view.wards.map((ward) => ({
                id: ward.id,
                label: ward.name,
                total: ward.total,
                ...ward.byCategory,
              })),
            }}
          >
            <StackedBars
              rows={view.wards.map((ward) => ({
                label: ward.name,
                values: ward.byCategory ?? {},
              }))}
              keys={view.mixKeys}
              percent={mixPercent === "share"}
            />
          </ChartFrame>
        )}

        <section className="grid-2">
          <ChartFrame
            title="How residents rate the fixes"
            subtitle={`${formatNumber(view.ratingTotal)} ${FEATURES.signOff}s with a star rating`}
            table={{
              columns: [
                { key: "stars", label: "Stars", numeric: true },
                { key: "count", label: "Sign-offs", numeric: true },
              ],
              rows: data.ratings ?? [],
            }}
          >
            <ColumnChart
              data={(data.ratings ?? []).map((row) => ({
                label: `${row.stars}★`,
                title: `${row.stars} star${row.stars === 1 ? "" : "s"}`,
                seriesLabel: "Sign-offs",
                value: row.count,
                color: starColor(row.stars),
              }))}
              height={220}
              ariaLabel="Distribution of resident star ratings"
            />
          </ChartFrame>

          <ChartFrame
            title="Where the money goes"
            subtitle={`${formatINR(kpis.spend, { compact: true })} logged in the ${FEATURES.costLedger}`}
            table={{
              columns: [
                { key: "label", label: "Category" },
                {
                  key: "value",
                  label: "Spend",
                  numeric: true,
                  format: (v) => formatINR(v),
                },
              ],
              rows: view.spendRows,
            }}
          >
            <BarList
              data={view.spendRows}
              formatValue={(v) => formatINR(v, { compact: true })}
              emptyText="No costs logged in this period."
            />
          </ChartFrame>
        </section>

        {(data.departments ?? []).length > 0 && (
          <section className="card card-flush">
            <div className="pulse-table-head">
              <SectionHeader
                eyebrow="Departments"
                title="Who fixes what, how fast, and for how much"
              />
            </div>

            <div className="table-scroll pulse-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Department</th>
                    <th scope="col" className="num">Fixed</th>
                    <th scope="col" className="num">Median fix</th>
                    <th scope="col">{FEATURES.fixClock} kept</th>
                    <th scope="col" className="num">Rating</th>
                    <th scope="col" className="num">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.departments]
                    .sort((a, b) => (b.resolved || 0) - (a.resolved || 0))
                    .map((dept) => (
                      <tr key={dept.id}>
                        <th scope="row">{dept.name}</th>
                        <td className="num">{formatNumber(dept.resolved)}</td>
                        <td className="num">{formatHours(dept.medianFixHours)}</td>
                        <td>
                          <div className="table-meter">
                            <div
                              className={`meter ${
                                dept.slaCompliance == null
                                  ? ""
                                  : dept.slaCompliance >= 85
                                    ? "meter-good"
                                    : dept.slaCompliance >= 60
                                      ? "meter-warn"
                                      : "meter-bad"
                              }`}
                              aria-hidden="true"
                            >
                              <span style={{ width: `${dept.slaCompliance ?? 0}%` }} />
                            </div>
                            <span>{formatPct(dept.slaCompliance)}</span>
                          </div>
                        </td>
                        <td className="num">
                          {dept.avgRating != null ? `${dept.avgRating.toFixed(1)}★` : "—"}
                        </td>
                        <td className="num">
                          <IndianRupee className="inline-icon" aria-hidden="true" />
                          {formatCompact(dept.spend)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="pulse-note">
          Updated every minute. Duplicate reports are merged and excluded.
          "Fixed" counts cases that reached Resolved in the period; resident
          ratings come from {FEATURES.signOff}. Spend is what officers logged
          in the {FEATURES.costLedger}.
        </p>
      </div>
    </div>
  );
}
