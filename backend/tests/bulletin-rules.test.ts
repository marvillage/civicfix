import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BULLETIN_STATUS_FILTERS,
  bulletinStatus,
  bulletinWindowWhere,
  isBulletinActive,
  isValidBulletinWindow,
} from "../src/services/bulletin.rules";
import { matchesWhere } from "./helpers/where";

const now = new Date("2026-10-04T12:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe("bulletinStatus", () => {
  it("is upcoming before it starts", () => {
    assert.equal(bulletinStatus({ startsAt: hours(2), endsAt: null }, now), "upcoming");
    assert.equal(bulletinStatus({ startsAt: hours(2), endsAt: hours(5) }, now), "upcoming");
  });

  it("is active once started, while open-ended or not yet ended", () => {
    assert.equal(bulletinStatus({ startsAt: hours(-2), endsAt: null }, now), "active");
    assert.equal(bulletinStatus({ startsAt: hours(-2), endsAt: hours(1) }, now), "active");
  });

  it("is past once the end time has passed", () => {
    assert.equal(bulletinStatus({ startsAt: hours(-5), endsAt: hours(-1) }, now), "past");
  });

  it("treats the exact start as started and the exact end as ended", () => {
    assert.equal(bulletinStatus({ startsAt: now, endsAt: null }, now), "active");
    assert.equal(bulletinStatus({ startsAt: hours(-1), endsAt: now }, now), "past");
  });

  it("exposes isActive for the response", () => {
    assert.equal(isBulletinActive({ startsAt: hours(-1), endsAt: null }, now), true);
    assert.equal(isBulletinActive({ startsAt: hours(1), endsAt: null }, now), false);
  });
});

describe("isValidBulletinWindow", () => {
  it("accepts no end, or an end after the start", () => {
    assert.equal(isValidBulletinWindow(now), true);
    assert.equal(isValidBulletinWindow(now, null), true);
    assert.equal(isValidBulletinWindow(now, hours(1)), true);
  });

  it("rejects an end at or before the start", () => {
    assert.equal(isValidBulletinWindow(now, now), false);
    assert.equal(isValidBulletinWindow(now, hours(-1)), false);
  });
});

describe("bulletinWindowWhere", () => {
  // Every interesting combination of start/end around `now`.
  const offsets = [-48, -1, 0, 1, 48];
  const windows = offsets.flatMap((start) => [
    { startsAt: hours(start), endsAt: null },
    ...offsets
      .filter((end) => end > start)
      .map((end) => ({ startsAt: hours(start), endsAt: hours(end) })),
  ]);

  for (const status of BULLETIN_STATUS_FILTERS) {
    it(`selects exactly the ${status} bulletins`, () => {
      const where = bulletinWindowWhere(status, now);

      for (const window of windows) {
        const expected =
          status === "all" || bulletinStatus(window, now) === status;

        assert.equal(
          matchesWhere(window, where as Record<string, unknown>),
          expected,
          `${status}: ${JSON.stringify(window)}`
        );
      }
    });
  }
});
