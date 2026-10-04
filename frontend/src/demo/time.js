// Demo-mode time shifting. Recorded timestamps are moved forward by
// (now - recordedAt), so "2 hours ago" and live Fix Clock countdowns
// look the same whenever the demo is opened.

import fixtures from "./fixtures.json";

const recordedAt = Date.parse(fixtures.recordedAt);

export const shiftMs = Number.isFinite(recordedAt)
  ? Date.now() - recordedAt
  : 0;

// UTC ("…Z") and offset ("…+05:30", City Pulse buckets) ISO strings.
const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function revive(value) {
  if (Array.isArray(value)) {
    return value.map(revive);
  }

  if (value && typeof value === "object") {
    const copy = {};

    for (const key of Object.keys(value)) {
      copy[key] = revive(value[key]);
    }

    return copy;
  }

  if (typeof value === "string" && ISO_RE.test(value)) {
    return new Date(Date.parse(value) + shiftMs).toISOString();
  }

  return value;
}

// Month buckets are calendar labels, not instants: shifting them by
// an arbitrary number of days could skip or repeat a month, so they
// are rebuilt to end at the current month instead.
function monthStarts(count) {
  const now = new Date();

  return Array.from({ length: count }, (_, index) =>
    new Date(
      now.getFullYear(),
      now.getMonth() - (count - 1 - index),
      1
    )
  );
}

export function relabelMonths(data) {
  const monthly = data?.analytics?.monthly;

  if (!Array.isArray(monthly)) return data;

  monthStarts(monthly.length).forEach((date, index) => {
    monthly[index].month = date.toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    });
  });

  return data;
}

// City Pulse monthly series (range=12m): realign bucket starts.
export function alignPulseMonths(data) {
  if (data?.range?.bucket !== "month") return data;

  for (const series of [data.flow, data.backlog]) {
    if (!Array.isArray(series)) continue;

    monthStarts(series.length).forEach((date, index) => {
      series[index].t = date.toISOString();
    });
  }

  return data;
}
