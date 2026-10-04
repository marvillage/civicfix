// ─────────────────────────────────────────────
// CITY PULSE HELPERS
// Pure calendar, statistics and caching helpers behind
// GET /pulse and the budget views. No I/O, so they are
// unit-tested directly (tests/pulse.test.ts).
// ─────────────────────────────────────────────

// Asia/Kolkata is a fixed UTC+05:30 with no daylight saving,
// so local calendar maths is a constant shift.
export const CITY_TIME_ZONE = "Asia/Kolkata";

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 3_600_000;

export const RANGE_KEYS = ["30d", "90d", "12m"] as const;

export type RangeKey = (typeof RANGE_KEYS)[number];

export type BucketUnit = "day" | "week" | "month";

const RANGES: Record<
  RangeKey,
  { unit: BucketUnit; count: number }
> = {
  "30d": { unit: "day", count: 30 },
  "90d": { unit: "week", count: 13 },
  "12m": { unit: "month", count: 12 },
};

// ─────────────────────────────────────────────
// LOCAL (IST) CALENDAR
// ─────────────────────────────────────────────

// Shift an instant so its UTC fields read as IST wall-clock
// time, and back again.
const toLocal = (date: Date) =>
  new Date(date.getTime() + IST_OFFSET_MS);

const fromLocal = (local: Date) =>
  new Date(local.getTime() - IST_OFFSET_MS);

// Start of the IST day, week (Monday) or month containing
// `date`, as a UTC instant.
export function startOf(unit: BucketUnit, date: Date): Date {
  const local = toLocal(date);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();

  if (unit === "month") {
    return fromLocal(new Date(Date.UTC(year, month, 1)));
  }

  const day = new Date(
    Date.UTC(year, month, local.getUTCDate())
  );

  if (unit === "week") {
    const daysSinceMonday = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - daysSinceMonday);
  }

  return fromLocal(day);
}

// Move a bucket start by n buckets (n may be negative).
// `start` must already be a bucket start for `unit`.
export function addBuckets(
  unit: BucketUnit,
  start: Date,
  n: number
): Date {
  if (unit === "day") {
    return new Date(start.getTime() + n * DAY_MS);
  }

  if (unit === "week") {
    return new Date(start.getTime() + n * 7 * DAY_MS);
  }

  const local = toLocal(start);

  return fromLocal(
    new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth() + n,
        1
      )
    )
  );
}

// "YYYY-MM-DD" of the IST calendar day an instant falls on.
// Matches SQL: to_char(<local ts>, 'YYYY-MM-DD').
export function localDateKey(date: Date) {
  return toLocal(date).toISOString().slice(0, 10);
}

// "YYYY-MM" of the IST month an instant falls on.
export function monthKey(date: Date) {
  return toLocal(date).toISOString().slice(0, 7);
}

// ISO 8601 with the city's offset, e.g.
// "2026-09-05T00:00:00+05:30": the same instant as
// toISOString(), but its date part is the local day.
export function toCityIso(date: Date) {
  return `${toLocal(date).toISOString().slice(0, 19)}+05:30`;
}

// ─────────────────────────────────────────────
// PULSE WINDOWS
// ─────────────────────────────────────────────

export interface Bucket {
  key: string; // "YYYY-MM-DD" of the bucket's first local day
  start: Date;
  end: Date; // exclusive
}

export interface PulseWindow {
  key: RangeKey;
  unit: BucketUnit;
  from: Date;
  to: Date;
  prevFrom: Date; // same-length period ending at `from`
  buckets: Bucket[];
}

// 30d → 30 daily buckets, 90d → 13 weekly buckets,
// 12m → 12 monthly buckets. The window starts on a bucket
// boundary and ends now, so the newest bucket is partial.
export function pulseWindow(
  key: RangeKey,
  now: Date
): PulseWindow {
  const { unit, count } = RANGES[key];
  const from = addBuckets(
    unit,
    startOf(unit, now),
    -(count - 1)
  );

  const buckets: Bucket[] = [];

  for (let i = 0; i < count; i++) {
    const start = addBuckets(unit, from, i);

    buckets.push({
      key: localDateKey(start),
      start,
      end: addBuckets(unit, from, i + 1),
    });
  }

  return {
    key,
    unit,
    from,
    to: now,
    prevFrom: new Date(
      from.getTime() - (now.getTime() - from.getTime())
    ),
    buckets,
  };
}

// ─────────────────────────────────────────────
// MONTHS ("YYYY-MM", IST)
// ─────────────────────────────────────────────

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string) {
  return MONTH_PATTERN.test(value);
}

// [from, to) instants of an IST calendar month.
export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    from: fromLocal(new Date(Date.UTC(year, monthNumber - 1, 1))),
    to: fromLocal(new Date(Date.UTC(year, monthNumber, 1))),
  };
}

// The last `count` months, oldest first, ending with the
// current one.
export function lastMonthKeys(count: number, now: Date) {
  const current = startOf("month", now);

  return Array.from({ length: count }, (_, i) =>
    monthKey(addBuckets("month", current, i - (count - 1)))
  );
}

// ─────────────────────────────────────────────
// STATISTICS
// ─────────────────────────────────────────────

export const round1 = (value: number) =>
  Math.round(value * 10) / 10;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Whole-number percentage, or null when there is nothing
// to measure against.
export function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export type Grade = "A" | "B" | "C" | "D" | "F";

// The ward report-card scale (also used by the public
// stats page).
export function gradeFromScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

// Grade from the mean of whichever rates are known
// (resolution rate, SLA compliance), or null if none are.
export function reportCardGrade(
  rates: Array<number | null>
): Grade | null {
  const known = rates.filter(
    (rate): rate is number => rate !== null
  );
  const score = mean(known);

  return score === null ? null : gradeFromScore(score);
}

// ─────────────────────────────────────────────
// BACKLOG — open issues at points in time
// ─────────────────────────────────────────────

export const CLOSED_STATUSES: ReadonlySet<string> = new Set([
  "RESOLVED",
  "CITIZEN_VERIFICATION",
  "CLOSED",
  "DUPLICATE",
]);

export interface IssueTimeline {
  createdAt: Date;
  events: Array<{ status: string; at: Date }>; // oldest first
}

// Open at `t` = reported by then, and the latest status
// change at or before `t` is not a closing one.
export function isOpenAt(timeline: IssueTimeline, t: Date) {
  if (timeline.createdAt > t) return false;

  let status: string | null = null;

  for (const event of timeline.events) {
    if (event.at > t) break;
    status = event.status;
  }

  return status === null || !CLOSED_STATUSES.has(status);
}

export function backlogSeries(
  timelines: IssueTimeline[],
  checkpoints: Date[]
) {
  return checkpoints.map(
    (t) =>
      timelines.filter((timeline) => isOpenAt(timeline, t))
        .length
  );
}

// ─────────────────────────────────────────────
// TTL CACHE
// A small in-memory cache: entries expire after `ttlMs`
// and the oldest entry is evicted once `maxEntries` is hit.
// ─────────────────────────────────────────────

export class TtlCache<V> {
  private entries = new Map<
    string,
    { value: V; expiresAt: number }
  >();

  constructor(
    private ttlMs: number,
    private maxEntries: number,
    private now: () => number = Date.now
  ) {}

  get size() {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: V) {
    this.entries.delete(key);

    if (this.entries.size >= this.maxEntries) {
      this.evict();
    }

    this.entries.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  private evict() {
    const now = this.now();

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }

    // Map iterates in insertion order: drop the oldest.
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;

      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

// One cache entry per distinct, normalised query.
export function pulseCacheKey(query: {
  range: RangeKey;
  wardId?: string;
  category?: string;
}) {
  return [
    query.range,
    query.wardId ?? "*",
    query.category ?? "*",
  ].join("|");
}
