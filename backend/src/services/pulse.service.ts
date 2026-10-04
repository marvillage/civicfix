import { prisma } from "../lib/prisma";
import { notFound } from "../lib/http";
import {
  IssueCategory,
  Prisma,
} from "../generated/prisma/client";
import {
  RangeKey,
  TtlCache,
  backlogSeries,
  lastMonthKeys,
  mean,
  median,
  monthBounds,
  percent,
  pulseCacheKey,
  pulseWindow,
  reportCardGrade,
  round1,
  toCityIso,
  IssueTimeline,
} from "./pulse.helpers";

// ─────────────────────────────────────────────
// CITY PULSE
// One response drives the whole analytics page. Counting
// and bucketing run in SQL; medians and the backlog series
// are finished in JS. DUPLICATE issues are excluded
// everywhere, and "resolved at" is an issue's first RESOLVED
// status-history row (there is no resolvedAt column).
// ─────────────────────────────────────────────

export interface PulseQuery {
  range: RangeKey;
  wardId?: string;
  category?: IssueCategory;
}

const CATEGORIES = Object.values(IssueCategory);

// 60 s per distinct query, at most 100 queries remembered.
// Promises are cached so concurrent misses share one build.
const pulseCache = new TtlCache<Promise<unknown>>(60_000, 100);

// Costs and budgets feed the pulse; their writes call this
// so a fresh entry shows up immediately.
export function clearPulseCache() {
  pulseCache.clear();
}

function cached<T>(key: string, build: () => Promise<T>) {
  const hit = pulseCache.get(key) as Promise<T> | undefined;

  if (hit) return hit;

  const promise = build();

  pulseCache.set(key, promise);
  promise.catch(() => pulseCache.delete(key));

  return promise;
}

// ─────────────────────────────────────────────
// SQL FRAGMENTS (constants only — values are always
// bound parameters)
// ─────────────────────────────────────────────

// Timestamps are stored as UTC in timestamp(3) columns;
// this reads one as Asia/Kolkata wall-clock time.
const local = (column: Prisma.Sql) =>
  Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')`;

const ISSUE_CREATED = Prisma.raw(`i."createdAt"`);

const FIRST_RESOLVED = Prisma.sql`
  SELECT "issueId", MIN("createdAt") AS at
  FROM "StatusHistory"
  WHERE status = 'RESOLVED'
  GROUP BY "issueId"
`;

function issueScope(query: PulseQuery) {
  return Prisma.sql`i.status <> 'DUPLICATE'
    ${query.wardId ? Prisma.sql`AND i."wardId" = ${query.wardId}` : Prisma.empty}
    ${query.category ? Prisma.sql`AND i.category = ${query.category}::"IssueCategory"` : Prisma.empty}`;
}

// ─────────────────────────────────────────────
// GET /pulse
// ─────────────────────────────────────────────

export function getPulse(query: PulseQuery) {
  return cached(pulseCacheKey(query), () =>
    buildPulse(query, new Date())
  );
}

interface KeyCount {
  k: string;
  n: number;
}

interface CohortRow {
  wardId: string | null;
  category: IssueCategory;
  total: number;
  resolved: number;
}

interface ResolvedRow {
  k: string;
  category: IssueCategory;
  departmentId: string | null;
  hours: number;
}

interface SlaRow {
  wardId: string | null;
  departmentId: string | null;
  due: number;
  missed: number;
}

interface RatingRow {
  departmentId: string | null;
  stars: number;
  n: number;
}

interface SpendRow {
  departmentId: string | null;
  category: IssueCategory;
  amount: number;
}

interface CentroidRow {
  wardId: string;
  lat: number;
  lng: number;
}

interface HeatRow {
  d: number;
  h: number;
  n: number;
}

interface TimelineRow {
  id: string;
  created: Date;
  status: string;
  at: Date;
}

async function buildPulse(query: PulseQuery, now: Date) {
  if (query.wardId) {
    const ward = await prisma.ward.findUnique({
      where: { id: query.wardId },
      select: { id: true },
    });

    if (!ward) throw notFound("Ward");
  }

  const window = pulseWindow(query.range, now);
  const { from, to, prevFrom, unit } = window;
  const scope = issueScope(query);

  const [
    reportedByBucket,
    [prev],
    [openNow],
    cohort,
    resolvedRows,
    heatRows,
    slaRows,
    ratingRows,
    spendRows,
    centroids,
    timelineRows,
    wards,
    departments,
  ] = await Promise.all([
    prisma.$queryRaw<KeyCount[]>`
      SELECT to_char(date_trunc(${unit}, ${local(ISSUE_CREATED)}), 'YYYY-MM-DD') AS k,
             count(*)::int AS n
      FROM "Issue" i
      WHERE i."createdAt" >= ${from} AND i."createdAt" <= ${to}
        AND ${scope}
      GROUP BY 1`,

    prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM "Issue" i
      WHERE i."createdAt" >= ${prevFrom} AND i."createdAt" < ${from}
        AND ${scope}`,

    prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM "Issue" i
      WHERE i.status NOT IN ('RESOLVED', 'CITIZEN_VERIFICATION', 'CLOSED')
        AND ${scope}`,

    // Issues reported in range, by ward × category, with
    // how many of them are fixed by now.
    prisma.$queryRaw<CohortRow[]>`
      SELECT i."wardId" AS "wardId",
             i.category AS category,
             count(*)::int AS total,
             count(*) FILTER (
               WHERE i.status IN ('RESOLVED', 'CITIZEN_VERIFICATION', 'CLOSED')
             )::int AS resolved
      FROM "Issue" i
      WHERE i."createdAt" >= ${from} AND i."createdAt" <= ${to}
        AND ${scope}
      GROUP BY 1, 2`,

    // Issues first resolved in range, with report → fix hours.
    prisma.$queryRaw<ResolvedRow[]>`
      WITH fr AS (${FIRST_RESOLVED})
      SELECT to_char(date_trunc(${unit}, ${local(Prisma.raw("fr.at"))}), 'YYYY-MM-DD') AS k,
             i.category AS category,
             i."departmentId" AS "departmentId",
             (EXTRACT(EPOCH FROM (fr.at - i."createdAt")) / 3600)::float8 AS hours
      FROM fr
      JOIN "Issue" i ON i.id = fr."issueId"
      WHERE fr.at >= ${from} AND fr.at <= ${to}
        AND ${scope}`,

    // Weekday (0 = Monday) × hour of report, local time.
    prisma.$queryRaw<HeatRow[]>`
      SELECT (EXTRACT(ISODOW FROM ${local(ISSUE_CREATED)})::int - 1) AS d,
             EXTRACT(HOUR FROM ${local(ISSUE_CREATED)})::int AS h,
             count(*)::int AS n
      FROM "Issue" i
      WHERE i."createdAt" >= ${from} AND i."createdAt" <= ${to}
        AND ${scope}
      GROUP BY 1, 2`,

    // SLAs that fell due in range; missed = flagged breached,
    // or not resolved by the deadline.
    prisma.$queryRaw<SlaRow[]>`
      WITH fr AS (${FIRST_RESOLVED})
      SELECT i."wardId" AS "wardId",
             i."departmentId" AS "departmentId",
             count(*)::int AS due,
             count(*) FILTER (
               WHERE s.breached OR fr.at IS NULL OR fr.at > s.deadline
             )::int AS missed
      FROM "SLA" s
      JOIN "Issue" i ON i.id = s."issueId"
      LEFT JOIN fr ON fr."issueId" = i.id
      WHERE s.deadline >= ${from} AND s.deadline <= ${to}
        AND ${scope}
      GROUP BY 1, 2`,

    prisma.$queryRaw<RatingRow[]>`
      SELECT i."departmentId" AS "departmentId",
             v.stars AS stars,
             count(*)::int AS n
      FROM "ResolutionVerification" v
      JOIN "Issue" i ON i.id = v."issueId"
      WHERE v.stars BETWEEN 1 AND 5
        AND v."createdAt" >= ${from} AND v."createdAt" <= ${to}
        AND ${scope}
      GROUP BY 1, 2`,

    prisma.$queryRaw<SpendRow[]>`
      SELECT i."departmentId" AS "departmentId",
             i.category AS category,
             sum(c.amount)::float8 AS amount
      FROM "WorkCost" c
      JOIN "Issue" i ON i.id = c."issueId"
      WHERE c."createdAt" >= ${from} AND c."createdAt" <= ${to}
        AND ${scope}
      GROUP BY 1, 2`,

    // Ward pins sit at the mean of all their issues, so they
    // stay put whatever the range or category.
    prisma.$queryRaw<CentroidRow[]>`
      SELECT i."wardId" AS "wardId",
             avg(i.latitude)::float8 AS lat,
             avg(i.longitude)::float8 AS lng
      FROM "Issue" i
      WHERE i.status <> 'DUPLICATE' AND i."wardId" IS NOT NULL
        ${query.wardId ? Prisma.sql`AND i."wardId" = ${query.wardId}` : Prisma.empty}
      GROUP BY 1`,

    // Status timelines of every issue that could be open at
    // some point in the window (closed-before-window skipped).
    prisma.$queryRaw<TimelineRow[]>`
      SELECT h."issueId" AS id,
             i."createdAt" AS created,
             h.status::text AS status,
             h."createdAt" AS at
      FROM "StatusHistory" h
      JOIN "Issue" i ON i.id = h."issueId"
      WHERE i."createdAt" <= ${to}
        AND ${scope}
        AND (
          i.status NOT IN ('RESOLVED', 'CITIZEN_VERIFICATION', 'CLOSED')
          OR EXISTS (
            SELECT 1 FROM "StatusHistory" h2
            WHERE h2."issueId" = i.id AND h2."createdAt" >= ${from}
          )
        )
      ORDER BY h."issueId", h."createdAt", h.id`,

    prisma.ward.findMany({
      where: query.wardId ? { id: query.wardId } : undefined,
      select: { id: true, name: true, code: true },
    }),

    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const categories = query.category
    ? [query.category]
    : CATEGORIES;

  // ── Flow & backlog ──────────────────────────────
  const reportedMap = new Map(
    reportedByBucket.map((row) => [row.k, row.n])
  );
  const resolvedMap = countBy(resolvedRows, (row) => row.k);

  const flow = window.buckets.map((bucket) => ({
    t: toCityIso(bucket.start),
    reported: reportedMap.get(bucket.key) ?? 0,
    resolved: resolvedMap.get(bucket.key) ?? 0,
  }));

  const openCounts = backlogSeries(
    toTimelines(timelineRows),
    window.buckets.map(
      (bucket) =>
        new Date(
          Math.min(bucket.end.getTime() - 1, now.getTime())
        )
    )
  );

  const backlog = window.buckets.map((bucket, i) => ({
    t: toCityIso(bucket.start),
    open: openCounts[i],
  }));

  // ── Shared tallies ──────────────────────────────
  const hoursAll = resolvedRows.map((row) => row.hours);
  const slaDue = sum(slaRows, (row) => row.due);
  const slaMissed = sum(slaRows, (row) => row.missed);
  const stars = ratingRows.flatMap((row) =>
    Array<number>(row.n).fill(row.stars)
  );
  const spend = sum(spendRows, (row) => row.amount);

  // ── By category ─────────────────────────────────
  const byCategory = categories
    .map((category) => {
      const resolved = resolvedRows.filter(
        (row) => row.category === category
      );

      return {
        category,
        reported: sum(
          cohort.filter((row) => row.category === category),
          (row) => row.total
        ),
        resolved: resolved.length,
        medianFixHours: roundOrNull(
          median(resolved.map((row) => row.hours))
        ),
      };
    })
    .sort(
      (a, b) =>
        b.reported - a.reported || b.resolved - a.resolved
    );

  // ── Wards ───────────────────────────────────────
  const centroidMap = new Map(
    centroids.map((row) => [row.wardId, row])
  );

  const wardCards = wards
    .map((ward) => {
      const rows = cohort.filter(
        (row) => row.wardId === ward.id
      );
      const total = sum(rows, (row) => row.total);
      const resolved = sum(rows, (row) => row.resolved);
      const sla = slaRows.filter(
        (row) => row.wardId === ward.id
      );
      const due = sum(sla, (row) => row.due);
      const missed = sum(sla, (row) => row.missed);
      const resolutionRate = percent(resolved, total);
      const slaCompliance = percent(due - missed, due);
      const centroid = centroidMap.get(ward.id);

      return {
        id: ward.id,
        name: ward.name,
        code: ward.code,
        lat: centroid ? centroid.lat : null,
        lng: centroid ? centroid.lng : null,
        total,
        open: total - resolved,
        resolved,
        resolutionRate,
        slaCompliance,
        grade: reportCardGrade([resolutionRate, slaCompliance]),
        byCategory: Object.fromEntries(
          categories.map((category) => [
            category,
            sum(
              rows.filter((row) => row.category === category),
              (row) => row.total
            ),
          ])
        ),
      };
    })
    .sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name)
    );

  // ── Heatmap ─────────────────────────────────────
  const heatmap = Array.from({ length: 7 }, () =>
    Array<number>(24).fill(0)
  );

  for (const row of heatRows) {
    heatmap[row.d][row.h] = row.n;
  }

  // ── Ratings ─────────────────────────────────────
  const ratings = [1, 2, 3, 4, 5].map((value) => ({
    stars: value,
    count: sum(
      ratingRows.filter((row) => row.stars === value),
      (row) => row.n
    ),
  }));

  // ── Departments ─────────────────────────────────
  const departmentCards = departments.map((department) => {
    const resolved = resolvedRows.filter(
      (row) => row.departmentId === department.id
    );
    const sla = slaRows.filter(
      (row) => row.departmentId === department.id
    );
    const due = sum(sla, (row) => row.due);
    const ratingsHere = ratingRows.filter(
      (row) => row.departmentId === department.id
    );
    const ratingCount = sum(ratingsHere, (row) => row.n);

    return {
      id: department.id,
      name: department.name,
      resolved: resolved.length,
      medianFixHours: roundOrNull(
        median(resolved.map((row) => row.hours))
      ),
      slaCompliance: percent(
        due - sum(sla, (row) => row.missed),
        due
      ),
      avgRating:
        ratingCount > 0
          ? round1(
              sum(ratingsHere, (row) => row.stars * row.n) /
                ratingCount
            )
          : null,
      spend: sum(
        spendRows.filter(
          (row) => row.departmentId === department.id
        ),
        (row) => row.amount
      ),
    };
  });

  // ── Spend by category ───────────────────────────
  const spendByCategory = categories
    .map((category) => ({
      category,
      amount: sum(
        spendRows.filter((row) => row.category === category),
        (row) => row.amount
      ),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    range: {
      key: window.key,
      from: toCityIso(from),
      to: toCityIso(to),
      bucket: unit,
    },
    kpis: {
      reported: sum(cohort, (row) => row.total),
      resolved: resolvedRows.length,
      open: openNow?.n ?? 0,
      medianFixHours: roundOrNull(median(hoursAll)),
      slaCompliance: percent(slaDue - slaMissed, slaDue),
      avgRating: roundOrNull(mean(stars)),
      spend,
      reportedPrev: prev?.n ?? 0,
    },
    flow,
    backlog,
    byCategory,
    wards: wardCards,
    heatmap,
    ratings,
    departments: departmentCards,
    spendByCategory,
  };
}

// ─────────────────────────────────────────────
// GET /pulse/budget — spend against budget per month
// ─────────────────────────────────────────────

export function getBudgetPulse(months: number) {
  return cached(`budget|${months}`, () =>
    buildBudgetPulse(months, new Date())
  );
}

async function buildBudgetPulse(months: number, now: Date) {
  const keys = lastMonthKeys(months, now);
  const { from } = monthBounds(keys[0]);

  const [departments, budgets, spendRows] = await Promise.all([
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    prisma.departmentBudget.findMany({
      where: { month: { in: keys } },
      select: { departmentId: true, month: true, amount: true },
    }),

    prisma.$queryRaw<
      { departmentId: string; month: string; spent: number }[]
    >`
      SELECT i."departmentId" AS "departmentId",
             to_char(date_trunc('month', ${local(Prisma.raw(`c."createdAt"`))}), 'YYYY-MM') AS month,
             sum(c.amount)::float8 AS spent
      FROM "WorkCost" c
      JOIN "Issue" i ON i.id = c."issueId"
      WHERE c."createdAt" >= ${from}
        AND i.status <> 'DUPLICATE'
        AND i."departmentId" IS NOT NULL
      GROUP BY 1, 2`,
  ]);

  const budgetMap = new Map(
    budgets.map((row) => [
      `${row.departmentId}|${row.month}`,
      row.amount,
    ])
  );
  const spendMap = new Map(
    spendRows.map((row) => [
      `${row.departmentId}|${row.month}`,
      row.spent,
    ])
  );

  return {
    months: keys,
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      series: keys.map((month) => ({
        month,
        budget:
          budgetMap.get(`${department.id}|${month}`) ?? null,
        spent: spendMap.get(`${department.id}|${month}`) ?? 0,
      })),
    })),
  };
}

// ─────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────

function sum<T>(rows: T[], pick: (row: T) => number) {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function countBy<T>(rows: T[], keyOf: (row: T) => string) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function roundOrNull(value: number | null) {
  return value === null ? null : round1(value);
}

// Rows arrive ordered by issue, then time.
function toTimelines(rows: TimelineRow[]) {
  const timelines = new Map<string, IssueTimeline>();

  for (const row of rows) {
    let timeline = timelines.get(row.id);

    if (!timeline) {
      timeline = { createdAt: row.created, events: [] };
      timelines.set(row.id, timeline);
    }

    timeline.events.push({ status: row.status, at: row.at });
  }

  return [...timelines.values()];
}
