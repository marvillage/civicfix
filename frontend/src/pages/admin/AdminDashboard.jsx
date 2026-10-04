import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleCheck,
  Clock,
  Download,
  Inbox,
  Recycle,
  Route,
  ScrollText,
  Timer,
  Users,
  Wrench,
} from "lucide-react";
import api from "../../api/axios";
import { BRAND, FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
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
  StatTile,
} from "../../components/ui";
import {
  CATEGORY_META,
  SEVERITY_LABEL,
  STATUS_LABEL,
} from "../../lib/labels";
import { formatHours, formatNumber } from "../../lib/format";

const TOOLS = [
  {
    to: "/admin/issues",
    label: FEATURES.caseDesk,
    text: "Assign, re-status and merge duplicate cases.",
    icon: Inbox,
    permission: "issue:read:all",
  },
  {
    to: "/admin/assignments",
    label: FEATURES.dispatch,
    text: "Every officer's workload and job progress.",
    icon: Route,
    permission: "assignment:read:all",
  },
  {
    to: "/admin/sla",
    label: FEATURES.fixClock,
    text: "Deadlines, breaches and auto-escalation.",
    icon: Timer,
    permission: "sla:manage",
  },
  {
    to: "/admin/organization",
    label: FEATURES.orgRouting,
    text: "Departments, wards and auto-routing rules.",
    icon: Building2,
    permission: "org:manage",
  },
  {
    to: "/admin/users",
    label: FEATURES.accessControl,
    text: "Roles, staff approvals and officer accounts.",
    icon: Users,
    permission: "user:manage",
  },
  {
    to: "/admin/audit",
    label: FEATURES.paperTrail,
    text: "Every status change and privileged action.",
    icon: ScrollText,
    permission: "audit:read",
  },
];

// Severity is ordered, so it uses one hue stepped light → dark
// (ordinal ramp) rather than categorical colors.
const SEVERITY_RAMP = {
  LOW: "color-mix(in oklab, var(--seq-high) 35%, var(--seq-low))",
  MEDIUM: "color-mix(in oklab, var(--seq-high) 55%, var(--seq-low))",
  HIGH: "color-mix(in oklab, var(--seq-high) 78%, var(--seq-low))",
  CRITICAL: "var(--seq-high)",
};

function sumStatus(byStatus, keys) {
  return keys.reduce(
    (total, key) =>
      total +
      (byStatus.find((row) => row.status === key)?.count ?? 0),
    0
  );
}

export default function AdminDashboard() {
  const { user, can } = useAuth();
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
      } catch (fetchError) {
        console.error("Fetch dashboard error:", fetchError);

        setError(
          fetchError.response?.data?.message ||
            "Unable to load dashboard statistics."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  async function handleExport() {
    setExporting(true);

    try {
      const response = await api.get(
        "/dashboard/export/issues.csv",
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${BRAND.name.toLowerCase()}-cases-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error("Export error:", exportError);
      setError("Unable to export cases.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <Loading label="Loading the Command Deck…" />;
  }

  if (error && !stats) {
    return (
      <div className="page">
        <PageHeader eyebrow={FEATURES.commandDeck} title="City operations" />
        <div className="form-error">{error}</div>
      </div>
    );
  }

  const byStatus = analytics?.byStatus ?? [];
  const status = stats?.status ?? {};
  const monthly = analytics?.monthly ?? [];
  const sla = analytics?.sla;

  const openCount = sumStatus(byStatus, [
    "REPORTED",
    "AI_VERIFIED",
    "ASSIGNED",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "REOPENED",
  ]);
  const breached = (status.slaBreached || 0) + (status.escalated || 0);
  const done = (status.resolved || 0) + (status.closed || 0);

  const categoryRows = (analytics?.byCategory ?? [])
    .map((row) => {
      const meta = CATEGORY_META[row.category] ?? CATEGORY_META.OTHER;
      const Icon = meta.icon;

      return {
        key: row.category,
        label: meta.label,
        value: row.count,
        color: meta.series,
        icon: <Icon aria-hidden="true" />,
      };
    })
    .sort((a, b) => b.value - a.value);

  const wardRows = (analytics?.byWard ?? [])
    .map((row) => ({ label: row.ward, value: row.count }))
    .sort((a, b) => b.value - a.value);

  const severityRows = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
    (key) => ({
      key,
      label: SEVERITY_LABEL[key],
      value:
        stats?.severity?.find((item) => item.severity === key)?._count
          ?.id ?? 0,
      color: SEVERITY_RAMP[key],
    })
  );

  const statusRows = [...byStatus]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({
      key: row.status,
      label: STATUS_LABEL[row.status] ?? row.status,
      value: row.count,
    }));

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="page command-deck">
      <PageHeader
        eyebrow={FEATURES.commandDeck}
        title={`${greeting}, ${user?.name?.split(" ")[0] ?? "admin"}`}
        description="The live state of every case in the city: what's open, what's late, and where the fixes keep failing."
        actions={
          <>
            {can("export:csv") && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download aria-hidden="true" />
                {exporting ? "Exporting…" : FEATURES.dataExport}
              </button>
            )}

            <Link to="/pulse" className="btn btn-accent">
              <Activity aria-hidden="true" />
              Open {FEATURES.pulse}
            </Link>
          </>
        }
      />

      {error && <div className="form-error">{error}</div>}

      <section className="kpi-row" aria-label="Key numbers">
        <StatTile
          label="Total cases"
          value={formatNumber(stats?.totalIssues ?? 0)}
          hint={`${formatNumber(openCount)} still open`}
          icon={Inbox}
          tone="navy"
        />
        <StatTile
          label="In progress"
          value={formatNumber(status.inProgress ?? 0)}
          hint="crews on site"
          icon={Wrench}
          tone="warning"
        />
        <StatTile
          label="Resolved & closed"
          value={formatNumber(done)}
          hint="fixes delivered"
          icon={CircleCheck}
          tone="success"
        />
        <StatTile
          label="Breached or escalated"
          value={formatNumber(breached)}
          hint="past their Fix Clock"
          icon={AlertTriangle}
          tone="danger"
          to={can("sla:manage") ? "/admin/sla" : undefined}
        />
      </section>

      <section className="grid-2">
        <div className="card deck-health">
          <SectionHeader
            eyebrow={FEATURES.fixClock}
            title="Are we keeping our promises?"
          />

          <Meter
            label={
              sla?.total
                ? `${sla.total - sla.breached} of ${sla.total} deadlines met`
                : "No deadlines set yet"
            }
            value={sla?.complianceRate ?? null}
          />

          <div className="deck-health-figures">
            <div>
              <span className="detail-label">Average time to fix</span>
              <strong>
                <Clock aria-hidden="true" />
                {formatHours(analytics?.avgResolutionHours)}
              </strong>
            </div>

            <div>
              <span className="detail-label">Repeat offenders</span>
              <strong>
                <Recycle aria-hidden="true" />
                {chronic.length}
              </strong>
            </div>
          </div>
        </div>

        <ChartFrame
          title="Reports per month"
          subtitle="Last six months, all wards"
          table={{
            columns: [
              { key: "month", label: "Month" },
              { key: "count", label: "Reports", numeric: true },
            ],
            rows: monthly,
          }}
        >
          <ColumnChart
            data={monthly.map((m, i) => ({
              label: m.month,
              value: m.count,
              seriesLabel: "Reports",
              title: m.month,
              color:
                i === monthly.length - 1
                  ? "var(--series-2)"
                  : "var(--series-1)",
            }))}
            height={200}
            ariaLabel="Reports per month, last six months"
          />
        </ChartFrame>
      </section>

      <section className="grid-2">
        <ChartFrame
          title="Cases by category"
          subtitle="All time, duplicates included"
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

        <ChartFrame
          title="Cases by ward"
          subtitle="Where reports come from"
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
      </section>

      <section className="grid-2">
        <ChartFrame
          title="Severity"
          subtitle="How bad reported problems are"
          table={{
            columns: [
              { key: "label", label: "Severity" },
              { key: "value", label: "Cases", numeric: true },
            ],
            rows: severityRows,
          }}
        >
          <BarList data={severityRows} />
        </ChartFrame>

        <ChartFrame
          title="Pipeline"
          subtitle="Cases in each status right now"
          table={{
            columns: [
              { key: "label", label: "Status" },
              { key: "value", label: "Cases", numeric: true },
            ],
            rows: statusRows,
          }}
        >
          <BarList data={statusRows} color="var(--series-1)" />
        </ChartFrame>
      </section>

      <section className="card">
        <SectionHeader
          eyebrow={FEATURES.repeatOffenders}
          title="Fixes that didn't hold"
          description="Reopened two or more times. These need a different contractor, budget or method, not another patch."
        />

        {chronic.length === 0 ? (
          <EmptyState icon={Recycle} title="No repeat offenders">
            Every fix so far has held. Cases reopened twice or more
            will show up here.
          </EmptyState>
        ) : (
          <ul className="list-divided offender-list">
            {chronic.map((issue) => (
              <li key={issue.id}>
                <Link to={`/issues/${issue.id}`} className="offender-row">
                  <span className="offender-main">
                    <strong>{issue.title}</strong>
                    <span className="meta-row">
                      {issue.category && (
                        <CategoryChip category={issue.category} short />
                      )}
                      {issue.ward && <span>{issue.ward.name}</span>}
                    </span>
                  </span>

                  {issue.reopenCount > 0 && (
                    <span className="chip chip-warning">
                      <Recycle aria-hidden="true" />
                      Reopened {issue.reopenCount}×
                    </span>
                  )}
                  <span className="chip chip-danger">
                    {issue._count?.escalations || 0} escalations
                  </span>
                  <ArrowRight className="offender-arrow" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader eyebrow="Tools" title="Run the city" />

        <div className="tool-grid">
          {TOOLS.filter((tool) => can(tool.permission)).map(
            ({ to, label, text, icon: Icon }) => (
              <Link key={to} to={to} className="card card-link tool-card">
                <span className="tool-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>
                  <strong>{label}</strong>
                  <span>{text}</span>
                </span>
                <ArrowRight className="tool-arrow" aria-hidden="true" />
              </Link>
            )
          )}
        </div>
      </section>
    </div>
  );
}
