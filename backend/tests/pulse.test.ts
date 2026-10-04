import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addBuckets,
  backlogSeries,
  gradeFromScore,
  isMonthKey,
  isOpenAt,
  IssueTimeline,
  lastMonthKeys,
  localDateKey,
  mean,
  median,
  monthBounds,
  monthKey,
  percent,
  pulseCacheKey,
  pulseWindow,
  reportCardGrade,
  startOf,
  toCityIso,
  TtlCache,
} from "../src/services/pulse.helpers";

const at = (iso: string) => new Date(iso);

// ─────────────────────────────────────────────
// IST CALENDAR
// ─────────────────────────────────────────────

describe("IST calendar", () => {
  it("puts an instant on its Asia/Kolkata day", () => {
    // 20:00 UTC on the 4th is 01:30 on the 5th in India.
    assert.equal(localDateKey(at("2026-10-04T20:00:00Z")), "2026-10-05");
    assert.equal(localDateKey(at("2026-10-04T18:29:59Z")), "2026-10-04");
    assert.equal(monthKey(at("2026-09-30T19:00:00Z")), "2026-10");
  });

  it("starts days, Monday weeks and months at local midnight", () => {
    const now = at("2026-10-04T09:00:00Z"); // Sunday, 14:30 IST

    assert.equal(
      startOf("day", now).toISOString(),
      "2026-10-03T18:30:00.000Z"
    );
    assert.equal(
      startOf("week", now).toISOString(),
      "2026-09-27T18:30:00.000Z" // Monday 28 Sep, 00:00 IST
    );
    assert.equal(
      startOf("month", now).toISOString(),
      "2026-09-30T18:30:00.000Z" // 1 Oct, 00:00 IST
    );
  });

  it("steps months across year ends", () => {
    const january = startOf("month", at("2026-01-15T06:00:00Z"));

    assert.equal(monthKey(addBuckets("month", january, -1)), "2025-12");
    assert.equal(monthKey(addBuckets("month", january, 11)), "2026-12");
  });

  it("formats bucket starts with the city's offset", () => {
    assert.equal(
      toCityIso(at("2026-10-03T18:30:00.000Z")),
      "2026-10-04T00:00:00+05:30"
    );
    assert.equal(
      new Date(toCityIso(at("2026-10-03T18:30:00Z"))).getTime(),
      at("2026-10-03T18:30:00Z").getTime()
    );
  });
});

// ─────────────────────────────────────────────
// PULSE WINDOWS
// ─────────────────────────────────────────────

describe("pulseWindow", () => {
  const now = at("2026-10-04T09:00:00Z");

  it("30d is 30 consecutive local days ending today", () => {
    const window = pulseWindow("30d", now);

    assert.equal(window.unit, "day");
    assert.equal(window.buckets.length, 30);
    assert.equal(window.buckets[0].key, "2026-09-05");
    assert.equal(window.buckets[29].key, "2026-10-04");
    assert.equal(window.from.getTime(), window.buckets[0].start.getTime());
    assert.equal(window.to, now);
  });

  it("90d is 13 Monday weeks, 12m is 12 months", () => {
    const weeks = pulseWindow("90d", now);
    const months = pulseWindow("12m", now);

    assert.equal(weeks.unit, "week");
    assert.equal(weeks.buckets.length, 13);
    assert.equal(weeks.buckets[12].key, "2026-09-28");
    assert.equal(weeks.buckets[0].key, "2026-07-06");

    assert.equal(months.unit, "month");
    assert.deepEqual(
      months.buckets.map((bucket) => bucket.key.slice(0, 7)),
      [
        "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
        "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
      ]
    );
  });

  it("buckets tile the window with no gaps", () => {
    for (const key of ["30d", "90d", "12m"] as const) {
      const { buckets } = pulseWindow(key, now);

      for (let i = 1; i < buckets.length; i++) {
        assert.equal(
          buckets[i].start.getTime(),
          buckets[i - 1].end.getTime()
        );
      }

      assert.ok(buckets[buckets.length - 1].end > now);
    }
  });

  it("the previous period has the same length and ends at from", () => {
    const window = pulseWindow("90d", now);

    assert.equal(
      window.from.getTime() - window.prevFrom.getTime(),
      now.getTime() - window.from.getTime()
    );
  });
});

// ─────────────────────────────────────────────
// MONTHS
// ─────────────────────────────────────────────

describe("months", () => {
  it("validates YYYY-MM", () => {
    assert.ok(isMonthKey("2026-10"));
    assert.ok(!isMonthKey("2026-13"));
    assert.ok(!isMonthKey("2026-1"));
    assert.ok(!isMonthKey("26-10"));
  });

  it("bounds a month in local time", () => {
    const { from, to } = monthBounds("2026-02");

    assert.equal(from.toISOString(), "2026-01-31T18:30:00.000Z");
    assert.equal(to.toISOString(), "2026-02-28T18:30:00.000Z");
  });

  it("lists the last n months, oldest first", () => {
    assert.deepEqual(lastMonthKeys(3, at("2026-01-10T00:00:00Z")), [
      "2025-11",
      "2025-12",
      "2026-01",
    ]);
  });
});

// ─────────────────────────────────────────────
// STATISTICS & GRADES
// ─────────────────────────────────────────────

describe("statistics", () => {
  it("median handles odd, even and empty inputs", () => {
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), null);
  });

  it("median does not reorder its input", () => {
    const values = [3, 1, 2];

    median(values);
    assert.deepEqual(values, [3, 1, 2]);
  });

  it("mean and percent", () => {
    assert.equal(mean([1, 2, 3, 4]), 2.5);
    assert.equal(mean([]), null);
    assert.equal(percent(2, 3), 67);
    assert.equal(percent(0, 0), null);
  });

  it("grades on the report-card scale", () => {
    assert.equal(gradeFromScore(95), "A");
    assert.equal(gradeFromScore(90), "A");
    assert.equal(gradeFromScore(89.9), "B");
    assert.equal(gradeFromScore(75), "B");
    assert.equal(gradeFromScore(60), "C");
    assert.equal(gradeFromScore(40), "D");
    assert.equal(gradeFromScore(39), "F");
  });

  it("report-card grade averages only the known rates", () => {
    assert.equal(reportCardGrade([80, 100]), "A");
    assert.equal(reportCardGrade([70, null]), "C");
    assert.equal(reportCardGrade([null, null]), null);
  });
});

// ─────────────────────────────────────────────
// BACKLOG
// ─────────────────────────────────────────────

describe("backlog", () => {
  const reopened: IssueTimeline = {
    createdAt: at("2026-09-01T00:00:00Z"),
    events: [
      { status: "REPORTED", at: at("2026-09-01T00:00:00Z") },
      { status: "RESOLVED", at: at("2026-09-05T00:00:00Z") },
      { status: "REOPENED", at: at("2026-09-08T00:00:00Z") },
      { status: "RESOLVED", at: at("2026-09-12T00:00:00Z") },
      { status: "CLOSED", at: at("2026-09-13T00:00:00Z") },
    ],
  };

  it("follows the status timeline, including reopenings", () => {
    assert.equal(isOpenAt(reopened, at("2026-08-31T00:00:00Z")), false);
    assert.equal(isOpenAt(reopened, at("2026-09-03T00:00:00Z")), true);
    assert.equal(isOpenAt(reopened, at("2026-09-06T00:00:00Z")), false);
    assert.equal(isOpenAt(reopened, at("2026-09-10T00:00:00Z")), true);
    assert.equal(isOpenAt(reopened, at("2026-09-20T00:00:00Z")), false);
  });

  it("an issue with no status change yet counts as open", () => {
    assert.equal(
      isOpenAt(
        { createdAt: at("2026-09-01T00:00:00Z"), events: [] },
        at("2026-09-02T00:00:00Z")
      ),
      true
    );
  });

  it("counts open issues at each checkpoint", () => {
    const fresh: IssueTimeline = {
      createdAt: at("2026-09-09T00:00:00Z"),
      events: [{ status: "REPORTED", at: at("2026-09-09T00:00:00Z") }],
    };

    assert.deepEqual(
      backlogSeries(
        [reopened, fresh],
        [
          at("2026-09-03T00:00:00Z"),
          at("2026-09-06T00:00:00Z"),
          at("2026-09-10T00:00:00Z"),
          at("2026-09-20T00:00:00Z"),
        ]
      ),
      [1, 0, 2, 1]
    );
  });
});

// ─────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────

describe("TtlCache", () => {
  it("expires entries after the TTL", () => {
    let clock = 0;
    const cache = new TtlCache<string>(60_000, 10, () => clock);

    cache.set("a", "first");
    clock = 59_999;
    assert.equal(cache.get("a"), "first");
    clock = 60_000;
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.size, 0);
  });

  it("evicts the oldest entry when full, expired ones first", () => {
    let clock = 0;
    const cache = new TtlCache<number>(1_000, 3, () => clock);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // full: "a" goes

    assert.equal(cache.size, 3);
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.get("d"), 4);

    clock = 500;
    cache.set("b", 20); // refresh moves "b" to the back
    cache.set("e", 5); // full: "c" (now oldest) goes

    assert.equal(cache.get("c"), undefined);
    assert.equal(cache.get("b"), 20);

    clock = 1_200; // "d" expired, "b"/"e" alive
    cache.set("f", 6);

    assert.equal(cache.get("d"), undefined);
    assert.equal(cache.get("b"), 20);
    assert.equal(cache.get("e"), 5);
    assert.equal(cache.get("f"), 6);
  });

  it("keys normalise missing filters", () => {
    assert.equal(pulseCacheKey({ range: "30d" }), "30d|*|*");
    assert.equal(
      pulseCacheKey({ range: "12m", wardId: "w1", category: "GARBAGE" }),
      "12m|w1|GARBAGE"
    );
    assert.notEqual(
      pulseCacheKey({ range: "30d", wardId: "w1" }),
      pulseCacheKey({ range: "30d", category: "w1" })
    );
  });
});
