// Cost Ledger — what a fix cost, logged by the officer doing the job.
//
//   <CostLedger issueId="…" canLog />
//
// Reads GET /issues/:issueId/costs → { costs, total }. With `canLog`, an
// inline form posts to POST /issues/:issueId/costs. Entries the current user
// logged in the last 24 h (or any entry, for citywide staff) can be removed
// with DELETE /costs/:id. Styles: styles/pages/authority.css (`cost-*`).

import { useEffect, useId, useState } from "react";
import {
  Building2,
  HardHat,
  Lock,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  Truck,
} from "lucide-react";
import api from "../api/axios";
import { FEATURES } from "../brand";
import { useAuth } from "../context/auth";
import { BarList } from "./charts";
import { SectionHeader } from "./ui";
import { formatDateTime, formatINR, timeAgo } from "../lib/format";

// Fixed order: the kind keeps its color everywhere.
const KINDS = [
  {
    key: "MATERIAL",
    label: "Material",
    icon: Package,
    color: "var(--series-1)",
    placeholder: "e.g. Bitumen cold mix, 12 bags",
  },
  {
    key: "LABOUR",
    label: "Labour",
    icon: HardHat,
    color: "var(--series-2)",
    placeholder: "e.g. Patching crew, 4 workers for a day",
  },
  {
    key: "EQUIPMENT",
    label: "Equipment",
    icon: Truck,
    color: "var(--series-3)",
    placeholder: "e.g. Road roller hire, 4 hours",
  },
  {
    key: "CONTRACTOR",
    label: "Contractor",
    icon: Building2,
    color: "var(--series-4)",
    placeholder: "e.g. Resurfacing by Shree Infra Works",
  },
];

const KIND_BY_KEY = Object.fromEntries(KINDS.map((kind) => [kind.key, kind]));

const DELETE_WINDOW_MS = 24 * 3_600_000;
const MAX_AMOUNT = 10_000_000;

const EMPTY_FORM = { kind: "MATERIAL", description: "", amount: "" };

export default function CostLedger({ issueId, canLog = false }) {
  const { user, can } = useAuth();
  const formId = useId();

  const [costs, setCosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(null);

  // Bumped to refetch (retry, or a POST that returned no entry).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!issueId) return undefined;

    let cancelled = false;

    async function fetchCosts() {
      try {
        const response = await api.get(`/issues/${issueId}/costs`);
        const list = response.data?.costs ?? [];

        if (cancelled) return;

        setCosts(list);
        setTotal(
          response.data?.total ??
            list.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0)
        );
        setBlocked(false);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;

        const status = error.response?.status;

        if (status === 403) {
          setBlocked(true);
        } else if (status === 404) {
          // Ledger not available for this case (or not deployed yet).
          setCosts([]);
          setTotal(0);
        } else {
          setLoadError(
            error.response?.data?.message || "Unable to load the costs."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCosts();

    return () => {
      cancelled = true;
    };
  }, [issueId, reloadKey]);

  // Re-check the 24 h delete window every minute.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);

    return () => clearInterval(timer);
  }, []);

  function retry() {
    setLoading(true);
    setLoadError("");
    setReloadKey((key) => key + 1);
  }

  const citywide = can("cost:manage");

  function canDelete(cost) {
    if (citywide) return true;
    if (!can("cost:log") || cost.loggedBy?.id !== user?.id) return false;

    return now - new Date(cost.createdAt).getTime() < DELETE_WINDOW_MS;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setFormError("");
    setNotice("");

    const description = form.description.trim();
    const amount = Number(form.amount);

    if (description.length < 3 || description.length > 200) {
      setFormError("Describe the cost in 3 to 200 characters.");
      return;
    }

    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
      setFormError(
        `Enter whole rupees between ${formatINR(1)} and ${formatINR(MAX_AMOUNT)}.`
      );
      return;
    }

    setSaving(true);

    try {
      const response = await api.post(`/issues/${issueId}/costs`, {
        kind: form.kind,
        description,
        amount,
      });
      const cost = response.data?.cost;

      if (cost) {
        setCosts((list) => [cost, ...list]);
        setTotal((value) => value + (Number(cost.amount) || 0));
      } else {
        setReloadKey((key) => key + 1);
      }

      setForm((previous) => ({ ...EMPTY_FORM, kind: previous.kind }));
      setNotice(`Logged ${formatINR(amount)} for ${KIND_BY_KEY[form.kind].label.toLowerCase()}.`);
    } catch (error) {
      setFormError(
        error.response?.data?.message || "Unable to log this cost."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cost) {
    if (
      !window.confirm(
        `Remove “${cost.description}” (${formatINR(cost.amount)}) from the ledger?`
      )
    ) {
      return;
    }

    setDeleting(cost.id);
    setFormError("");
    setNotice("");

    try {
      await api.delete(`/costs/${cost.id}`);

      setCosts((list) => list.filter((item) => item.id !== cost.id));
      setTotal((value) => value - (Number(cost.amount) || 0));
      setNotice("Entry removed.");
    } catch (error) {
      setFormError(
        error.response?.data?.message || "Unable to remove this entry."
      );
    } finally {
      setDeleting(null);
    }
  }

  const breakdown = KINDS.map((kind) => {
    const entries = costs.filter((cost) => cost.kind === kind.key);
    const amount = entries.reduce(
      (sum, cost) => sum + (Number(cost.amount) || 0),
      0
    );
    const Icon = kind.icon;

    return {
      key: kind.key,
      label: kind.label,
      value: amount,
      color: kind.color,
      icon: <Icon aria-hidden="true" />,
      hint: entries.length
        ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`
        : undefined,
    };
  });

  // Only kinds with spend, still in the fixed order (colour follows kind).
  const spentKinds = breakdown.filter((row) => row.value > 0);
  const activeKind = KIND_BY_KEY[form.kind] ?? KINDS[0];

  return (
    <section className="card cost-ledger" aria-labelledby={`${formId}-title`}>
      <SectionHeader
        eyebrow={FEATURES.costLedger}
        title={<span id={`${formId}-title`}>What this fix cost</span>}
        description={
          canLog
            ? "Log material, labour, equipment and contractor spend as it happens. It rolls up into the department budget."
            : "Spend logged by the crew on this case."
        }
        actions={
          !blocked && (
            <div className="cost-total" aria-live="polite">
              <span>Total spent</span>
              <strong>{loading ? "…" : formatINR(total)}</strong>
            </div>
          )
        }
      />

      {loading && (
        <div className="cost-skeleton" aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      )}

      {!loading && blocked && (
        <p className="cost-blocked">
          <Lock aria-hidden="true" />
          Costs on this case are visible to its crew and their department.
        </p>
      )}

      {!loading && loadError && (
        <div className="form-error cost-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={retry}>
            <RefreshCw aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {!loading && !blocked && !loadError && (
        <div className="cost-body">
          {spentKinds.length > 1 && (
            <div className="cost-breakdown">
              <h3 className="cost-subtitle">By kind</h3>
              <BarList
                data={spentKinds}
                formatValue={(value) => formatINR(value)}
              />
            </div>
          )}

          {canLog && (
            <form className="cost-form" onSubmit={handleSubmit} noValidate>
              <h3 className="cost-subtitle">Log a cost</h3>

              <div className="cost-form-row">
                <div className="field cost-field-kind">
                  <label htmlFor={`${formId}-kind`}>For</label>
                  <select
                    id={`${formId}-kind`}
                    value={form.kind}
                    onChange={(event) =>
                      setForm({ ...form, kind: event.target.value })
                    }
                    disabled={saving}
                  >
                    {KINDS.map((kind) => (
                      <option key={kind.key} value={kind.key}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field cost-field-desc">
                  <label htmlFor={`${formId}-desc`}>What was it?</label>
                  <input
                    id={`${formId}-desc`}
                    type="text"
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder={activeKind.placeholder}
                    maxLength={200}
                    disabled={saving}
                    required
                  />
                </div>

                <div className="field cost-field-amount">
                  <label htmlFor={`${formId}-amount`}>Amount</label>
                  <div className="cost-amount">
                    <span aria-hidden="true">₹</span>
                    <input
                      id={`${formId}-amount`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_AMOUNT}
                      step={1}
                      value={form.amount}
                      onChange={(event) =>
                        setForm({ ...form, amount: event.target.value })
                      }
                      placeholder="0"
                      disabled={saving}
                      required
                      aria-describedby={`${formId}-amount-hint`}
                    />
                  </div>
                  <span id={`${formId}-amount-hint`} className="sr-only">
                    Whole rupees
                  </span>
                </div>

                <button type="submit" className="cost-submit" disabled={saving}>
                  {saving ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <Plus aria-hidden="true" />
                  )}
                  {saving ? "Logging…" : "Log cost"}
                </button>
              </div>

              <p className="field-hint">
                You can remove an entry you logged for 24 hours.
              </p>
            </form>
          )}

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}

          {notice && !formError && (
            <div className="form-success" role="status">
              {notice}
            </div>
          )}

          {costs.length === 0 ? (
            <div className="cost-empty">
              <Receipt aria-hidden="true" />
              <p>
                {canLog
                  ? "Nothing logged yet. Add the first cost above: what you bought, hired or paid for."
                  : "No costs logged on this case yet."}
              </p>
            </div>
          ) : (
            <div className="cost-entries">
              <h3 className="cost-subtitle">
                Entries <span>{costs.length}</span>
              </h3>

              <ul className="cost-list">
                {costs.map((cost) => {
                  const kind = KIND_BY_KEY[cost.kind] ?? KINDS[0];
                  const Icon = kind.icon;

                  return (
                    <li key={cost.id} className="cost-row">
                      <span
                        className="cost-kind-icon"
                        style={{ "--kind": kind.color }}
                        aria-hidden="true"
                      >
                        <Icon />
                      </span>

                      <span className="cost-row-main">
                        <strong>{cost.description}</strong>
                        <span className="cost-row-meta">
                          <span className="cost-kind-label">{kind.label}</span>
                          {cost.loggedBy?.name && (
                            <span>
                              {cost.loggedBy.id === user?.id
                                ? "You"
                                : cost.loggedBy.name}
                            </span>
                          )}
                          <time
                            dateTime={cost.createdAt}
                            title={formatDateTime(cost.createdAt)}
                          >
                            {timeAgo(cost.createdAt)}
                          </time>
                        </span>
                      </span>

                      <strong className="cost-amount-value">
                        {formatINR(cost.amount)}
                      </strong>

                      {canDelete(cost) ? (
                        <button
                          type="button"
                          className="icon-button cost-delete"
                          onClick={() => handleDelete(cost)}
                          disabled={deleting === cost.id}
                          aria-label={`Remove ${cost.description}`}
                          title="Remove entry"
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="cost-delete-spacer" aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
