// Demo-mode City Pulse for filter combinations that weren't recorded.
// Every range, every single ward and every single category is
// recorded from the real API; only "ward AND category" is derived
// here, by narrowing the ward's recorded response to the category's
// share, so the numbers stay consistent with what was recorded.

import fixtures from "../fixtures.json";
import { alignPulseMonths, revive } from "../time";

function recorded(query) {
  return fixtures.responses?.public?.[`GET /pulse?${query}`]?.data;
}

function scale(rows, factor, keys) {
  return rows.map((row) => {
    const copy = { ...row };

    for (const key of keys) {
      copy[key] = Math.round((Number(row[key]) || 0) * factor);
    }

    return copy;
  });
}

function narrowToCategory(data, category) {
  const total = data.byCategory.reduce((sum, row) => sum + row.reported, 0);
  const row = data.byCategory.find((r) => r.category === category);
  const share = total ? (row?.reported ?? 0) / total : 0;

  return {
    ...data,
    kpis: {
      ...data.kpis,
      reported: row?.reported ?? 0,
      resolved: row?.resolved ?? 0,
      open: Math.round(data.kpis.open * share),
      reportedPrev: Math.round(data.kpis.reportedPrev * share),
      medianFixHours: row?.medianFixHours ?? data.kpis.medianFixHours,
      spend:
        data.spendByCategory.find((s) => s.category === category)?.amount ??
        0,
    },
    flow: scale(data.flow, share, ["reported", "resolved"]),
    backlog: scale(data.backlog, share, ["open"]),
    byCategory: data.byCategory.filter((r) => r.category === category),
    wards: data.wards.map((ward) => {
      const count = ward.byCategory?.[category] ?? 0;
      const ratio = ward.total ? count / ward.total : 0;

      return {
        ...ward,
        total: count,
        open: Math.round(ward.open * ratio),
        resolved: Math.round(ward.resolved * ratio),
        byCategory: { [category]: count },
      };
    }),
    heatmap: data.heatmap.map((r) => r.map((value) => Math.round(value * share))),
    ratings: scale(data.ratings, share, ["count"]),
    spendByCategory: data.spendByCategory.filter((s) => s.category === category),
  };
}

export function handlePulse({ method, path, params }) {
  if (method !== "GET" || path !== "/pulse" || !params.category) {
    return null;
  }

  const range = ["30d", "90d", "12m"].includes(params.range)
    ? params.range
    : "90d";

  const base =
    (params.wardId && recorded(`range=${range}&wardId=${params.wardId}`)) ||
    recorded(`range=${range}`);

  if (!base) return null;

  return [
    200,
    alignPulseMonths(revive(narrowToCategory(base, params.category))),
  ];
}
