import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pencil,
  Receipt,
  Wallet,
  X,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { ChartFrame, LineChart } from "../../components/charts";
import {
  EmptyState,
  Loading,
  PageHeader,
  SectionHeader,
  StatTile,
} from "../../components/ui";
import { formatINR, formatNumber, formatPct } from "../../lib/format";
import { Notice } from "./adminKit";
import { apiError, formatMonthKey, monthKeyOf } from "./adminUtils";

const WARN_AT = 85; // % of budget used
const MAX_AMOUNT = 1_000_000_000;

const SERIES = [
  { key: "budget", label: "Budget", color: "var(--series-1)" },
  { key: "spent", label: "Spent", color: "var(--series-2)" },
];

function shiftMonth(key, delta) {
  const [year, month] = key.split("-").map(Number);

  return monthKeyOf(new Date(year, month - 1 + delta, 1));
}

function usage(row) {
  if (row.budget == null || row.budget <= 0) return null;

  return (row.spent / row.budget) * 100;
}

function toneFor(pct) {
  if (pct == null) return "";
  if (pct > 100) return "bad";
  if (pct >= WARN_AT) return "warn";

  return "good";
}

const compactINR = (value) => (value == null ? "—" : formatINR(value, { compact: true }));

export default function Budgets() {
  const { user, can } = useAuth();
  const canManage = can("budget:manage");
  const canSeeTrend = can("analytics:full");
  const thisMonth = monthKeyOf(new Date());

  const [month, setMonth] = useState(thisMonth);
  // The last answer from GET /budgets, tagged with the month it is for.
  const [sheet, setSheet] = useState(null); // { month, rows, error }
  const [pulse, setPulse] = useState(null);
  const [trendError, setTrendError] = useState("");
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // { departmentId, value }
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);
  const loading = sheet == null;
  const refreshing = sheet != null && sheet.month !== month;
  const error = sheet?.error ?? "";
  const editingId = editing?.departmentId;

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  // Close the inline editor and put focus back on its pencil button.
  function closeEditor(departmentId) {
    setEditing(null);
    requestAnimationFrame(() => {
      document.getElementById(`budget-edit-${departmentId}`)?.focus();
    });
  }

  useEffect(() => {
    let cancelled = false;

    api
      .get("/budgets", { params: { month } })
      .then((response) => {
        if (!cancelled) {
          setSheet({ month, rows: response.data.departments || [], error: "" });
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setSheet({
            month,
            rows: [],
            error: apiError(fetchError, "Unable to load budgets."),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [month]);

  const fetchPulse = useCallback(async () => {
    if (!canSeeTrend) return;

    try {
      const response = await api.get("/pulse/budget", { params: { months: 6 } });

      setPulse(response.data);
      setTrendError("");
    } catch (fetchError) {
      setTrendError(apiError(fetchError, "Unable to load the spend trend."));
    }
  }, [canSeeTrend]);

  useEffect(() => {
    // State is only set after the request resolves.
    async function load() {
      await fetchPulse();
    }

    load();
  }, [fetchPulse]);

  const totals = useMemo(() => {
    const budgeted = rows.filter((row) => row.budget != null);
    const budget = budgeted.reduce((sum, row) => sum + row.budget, 0);
    const spent = rows.reduce((sum, row) => sum + (Number(row.spent) || 0), 0);

    return {
      budget,
      spent,
      budgeted: budgeted.length,
      issues: rows.reduce((sum, row) => sum + (Number(row.issues) || 0), 0),
      pct: budget > 0 ? (spent / budget) * 100 : null,
      over: budgeted.filter((row) => row.spent > row.budget).length,
    };
  }, [rows]);

  // Officers only see their own department; the trend follows the
  // same scope as the table.
  const panels = useMemo(() => {
    const visible = new Set(rows.map((row) => row.department?.id));

    return (pulse?.departments ?? [])
      .filter((department) => visible.has(department.id))
      .map((department) => {
        const series = department.series ?? [];
        const hasBudget = series.some((point) => point.budget != null);

        return {
          ...department,
          data: series.map((point) => ({
            t: point.month,
            budget: point.budget,
            spent: point.spent,
          })),
          series: hasBudget ? SERIES : SERIES.slice(1),
        };
      });
  }, [pulse, rows]);

  async function saveBudget(event) {
    event.preventDefault();

    const amount = Math.round(Number(editing?.value));

    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT || editing.value === "") {
      setNotice({ tone: "error", text: "Enter a budget in whole rupees, from ₹0 up to ₹100 crore." });
      return;
    }

    const row = rows.find((item) => item.department?.id === editing.departmentId);

    try {
      setSaving(true);
      setNotice(null);

      const response = await api.put("/budgets", {
        departmentId: editing.departmentId,
        month,
        amount,
      });

      const saved = response.data.budget?.amount ?? amount;

      setSheet((current) => ({
        ...current,
        rows: current.rows.map((item) =>
          item.department?.id === editing.departmentId ? { ...item, budget: saved } : item
        ),
      }));
      closeEditor(editing.departmentId);
      setNotice({
        tone: "success",
        text: `${row?.department?.name ?? "Department"} budget for ${formatMonthKey(month, { long: true })} set to ${formatINR(saved)}.`,
      });
      fetchPulse();
    } catch (saveError) {
      setNotice({ tone: "error", text: apiError(saveError, "Unable to save the budget.") });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading label={`Loading ${FEATURES.budgets}…`} />;
  }

  const monthLabel = formatMonthKey(month, { long: true });
  const ownDepartment = !canManage ? rows[0]?.department?.name ?? user?.department?.name : null;
  const pctTone = toneFor(totals.pct);

  return (
    <div className="page admin-page budgets-page">
      <PageHeader
        eyebrow={FEATURES.budgets}
        title={ownDepartment ? `${ownDepartment} budget` : "Department budgets"}
        description={
          canManage
            ? `Set what each department can spend each month and watch the ${FEATURES.costLedger} eat into it.`
            : `What your department was given this month, and what the ${FEATURES.costLedger} says it has spent.`
        }
        actions={
          <div className="month-picker">
            <button
              type="button"
              className="icon-button"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <label className="sr-only" htmlFor="budget-month">
              Month
            </label>
            <input
              id="budget-month"
              type="month"
              value={month}
              max={shiftMonth(thisMonth, 12)}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
              aria-label="Next month"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        }
      />

      {error && <div className="form-error" role="alert">{error}</div>}
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      {!canManage && rows.length > 0 && (
        <p className="form-info budget-scope">
          <Building2 aria-hidden="true" />
          You see your own department only. Budgets are set by admins.
        </p>
      )}

      <section className={`kpi-row ${refreshing ? "is-refreshing" : ""}`} aria-label={`Totals for ${monthLabel}`}>
        <StatTile
          label="Total budget"
          value={formatINR(totals.budget, { compact: true })}
          hint={`${totals.budgeted} of ${rows.length} ${rows.length === 1 ? "department" : "departments"} budgeted`}
          icon={Wallet}
          tone="navy"
        />
        <StatTile
          label="Spent"
          value={formatINR(totals.spent, { compact: true })}
          hint={`on ${formatNumber(totals.issues)} ${totals.issues === 1 ? "case" : "cases"}`}
          icon={Receipt}
        />
        <StatTile
          label="Budget used"
          value={formatPct(totals.pct)}
          hint={
            totals.pct == null
              ? "no budget set"
              : totals.pct > 100
                ? "over budget"
                : `${formatINR(Math.max(0, totals.budget - totals.spent), { compact: true })} left`
          }
          icon={Gauge}
          tone={pctTone === "bad" ? "danger" : pctTone === "warn" ? "warning" : "success"}
        />
        <StatTile
          label="Over budget"
          value={formatNumber(totals.over)}
          hint={totals.over ? `${totals.over === 1 ? "department" : "departments"} past the line` : "everyone inside the line"}
          icon={totals.over ? AlertTriangle : CircleCheck}
          tone={totals.over ? "danger" : "success"}
        />
      </section>

      <section className="card">
        <SectionHeader
          eyebrow={monthLabel}
          title="Spend against budget"
          description={`Amber from ${WARN_AT}% used, red once spend passes the budget.`}
        />

        {rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No departments to show">
            {canManage
              ? `Add departments in ${FEATURES.orgRouting} to give them budgets.`
              : "Your account isn't linked to a department yet. Ask an admin to add you to one."}
          </EmptyState>
        ) : (
          <form onSubmit={saveBudget}>
            <div className={`table-scroll ${refreshing ? "is-refreshing" : ""}`}>
              <table className="data-table admin-table budget-table">
                <caption className="sr-only">Budgets and spend for {monthLabel}</caption>
                <thead>
                  <tr>
                    <th scope="col">Department</th>
                    <th scope="col" className="num">Budget</th>
                    <th scope="col" className="num">Spent</th>
                    <th scope="col" className="num">Cases</th>
                    <th scope="col">Used</th>
                    <th scope="col" className="num">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const id = row.department?.id;
                    const name = row.department?.name ?? "Department";
                    const pct = usage(row);
                    const isEditing = editing?.departmentId === id;
                    const left = row.budget != null ? row.budget - row.spent : null;

                    return (
                      <tr key={id}>
                        <th scope="row" className="budget-dept">
                          {name}
                        </th>
                        <td className="num budget-amount">
                          {isEditing ? (
                            <span key="edit" className="budget-edit">
                              <span className="budget-input">
                                <span aria-hidden="true">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={MAX_AMOUNT}
                                  step="1000"
                                  inputMode="numeric"
                                  value={editing.value}
                                  onChange={(event) =>
                                    setEditing({ departmentId: id, value: event.target.value })
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      closeEditor(id);
                                    }
                                  }}
                                  aria-label={`Budget for ${name}, ${monthLabel}, in rupees`}
                                  disabled={saving}
                                  ref={inputRef}
                                />
                              </span>
                              <button
                                type="submit"
                                className="btn-sm row-icon-button"
                                disabled={saving}
                                aria-label={`Save budget for ${name}`}
                                title="Save"
                              >
                                <Check aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="btn-ghost btn-sm row-icon-button"
                                onClick={() => closeEditor(id)}
                                disabled={saving}
                                aria-label="Cancel"
                                title="Cancel"
                              >
                                <X aria-hidden="true" />
                              </button>
                            </span>
                          ) : (
                            // Distinct keys: reusing the pencil button as the submit
                            // button would submit the form on the opening click.
                            <span key="view" className="budget-value">
                              {row.budget != null ? (
                                formatINR(row.budget)
                              ) : (
                                <span className="chip chip-outline">Not set</span>
                              )}
                              {canManage && (
                                <button
                                  id={`budget-edit-${id}`}
                                  type="button"
                                  className="icon-button budget-edit-button"
                                  onClick={() =>
                                    setEditing({
                                      departmentId: id,
                                      value: row.budget != null ? String(row.budget) : "",
                                    })
                                  }
                                  aria-label={`${row.budget != null ? "Edit" : "Set"} budget for ${name}`}
                                  title={row.budget != null ? "Edit budget" : "Set budget"}
                                >
                                  <Pencil aria-hidden="true" />
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="num">{formatINR(row.spent)}</td>
                        <td className="num">{formatNumber(row.issues ?? 0)}</td>
                        <td>
                          <BudgetMeter pct={pct} name={name} />
                        </td>
                        <td className="num">
                          {left == null ? (
                            <span className="muted">—</span>
                          ) : left < 0 ? (
                            <span className="text-danger over-by">
                              <AlertTriangle aria-hidden="true" />
                              Over by {formatINR(-left)}
                            </span>
                          ) : (
                            `${formatINR(left)} left`
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>
        )}
      </section>

      {canSeeTrend && (
        <section aria-label="Spend trend">
          {trendError ? (
            <div className="form-error" role="alert">{trendError}</div>
          ) : !pulse ? (
            <Loading label="Loading the spend trend…" />
          ) : (
            <ChartFrame
              title="Spend vs budget, last 6 months"
              subtitle={
                panels.length > 1
                  ? "One panel per department, rupees per month. Each panel has its own scale."
                  : "Rupees per month"
              }
              legend={SERIES.map((item) => ({ ...item, shape: "line" }))}
              table={{
                columns: [
                  { key: "department", label: "Department" },
                  { key: "month", label: "Month", format: (value) => formatMonthKey(value) },
                  { key: "budget", label: "Budget", numeric: true, format: (value) => formatINR(value) },
                  { key: "spent", label: "Spent", numeric: true, format: (value) => formatINR(value) },
                ],
                rows: panels.flatMap((panel) =>
                  panel.data.map((point) => ({
                    id: `${panel.id}-${point.t}`,
                    department: panel.name,
                    month: point.t,
                    budget: point.budget,
                    spent: point.spent,
                  }))
                ),
              }}
            >
              {panels.length === 0 ? (
                <p className="empty-inline">No spend recorded yet.</p>
              ) : (
                <div className={`budget-multiples ${panels.length === 1 ? "is-single" : ""}`}>
                  {panels.map((panel) => (
                    <div key={panel.id} className="budget-multiple">
                      <h4>{panel.name}</h4>
                      <LineChart
                        data={panel.data}
                        xKey="t"
                        series={panel.series}
                        height={panels.length === 1 ? 240 : 170}
                        formatX={(value) => formatMonthKey(value).split(" ")[0]}
                        formatTooltipX={(value) => formatMonthKey(value, { long: true })}
                        formatValue={compactINR}
                        maxXLabels={6}
                        ariaLabel={`${panel.name}: budget and spend per month, last six months. Use left and right arrow keys to read values.`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </ChartFrame>
          )}
        </section>
      )}
    </div>
  );
}

// Spend against budget. Inverted from the kit's Meter: more is worse.
function BudgetMeter({ pct, name }) {
  if (pct == null) {
    return <span className="muted">No budget</span>;
  }

  const tone = toneFor(pct);

  return (
    <div className="budget-meter">
      <div
        className={`meter meter-${tone}`}
        role="meter"
        aria-label={`${name}: budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(pct, 100))}
        aria-valuetext={`${Math.round(pct)}% used${pct > 100 ? ", over budget" : ""}`}
      >
        <span style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <strong className={`budget-pct ${tone === "bad" ? "text-danger" : ""}`}>
        {tone !== "good" && <AlertTriangle aria-hidden="true" />}
        {formatPct(pct)}
      </strong>
    </div>
  );
}
