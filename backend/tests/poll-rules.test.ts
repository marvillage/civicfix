import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  areResultsVisible,
  comparePolls,
  isPollOpen,
  POLL_STATUS_FILTERS,
  pollStatusWhere,
} from "../src/services/poll.rules";
import { matchesWhere } from "./helpers/where";

const now = new Date("2026-10-04T12:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe("isPollOpen", () => {
  it("is open before its closing time", () => {
    assert.equal(isPollOpen({ closesAt: hours(1), closedAt: null }, now), true);
  });

  it("is closed once the closing time is reached", () => {
    assert.equal(isPollOpen({ closesAt: now, closedAt: null }, now), false);
    assert.equal(isPollOpen({ closesAt: hours(-1), closedAt: null }, now), false);
  });

  it("is closed early when an admin closed it", () => {
    assert.equal(isPollOpen({ closesAt: hours(24), closedAt: hours(-1) }, now), false);
  });
});

describe("areResultsVisible", () => {
  const cases: [isOpen: boolean, hasVoted: boolean, canSeeLiveResults: boolean, visible: boolean][] = [
    [true, false, false, false], // open, anonymous / not voted: hidden
    [true, true, false, true], // voted
    [true, false, true, true], // staff with poll:results
    [false, false, false, true], // closed: everyone
    [false, true, true, true],
  ];

  for (const [isOpen, hasVoted, canSeeLiveResults, visible] of cases) {
    it(`open=${isOpen} voted=${hasVoted} staff=${canSeeLiveResults} → ${visible}`, () => {
      assert.equal(
        areResultsVisible({ isOpen, hasVoted, canSeeLiveResults }),
        visible
      );
    });
  }
});

describe("pollStatusWhere", () => {
  const polls = [-2, 0, 2].flatMap((closesIn) => [
    { closesAt: hours(closesIn), closedAt: null },
    { closesAt: hours(closesIn), closedAt: hours(-3) },
  ]);

  for (const status of POLL_STATUS_FILTERS) {
    it(`selects exactly the ${status} polls`, () => {
      const where = pollStatusWhere(status, now);

      for (const poll of polls) {
        const open = isPollOpen(poll, now);
        const expected =
          status === "all" || (status === "open" ? open : !open);

        assert.equal(
          matchesWhere(poll, where as Record<string, unknown>),
          expected,
          `${status}: ${JSON.stringify(poll)}`
        );
      }
    });
  }
});

describe("comparePolls", () => {
  it("lists open polls first, then newest first", () => {
    const polls = [
      { id: "closed-new", closesAt: hours(-1), closedAt: null, createdAt: hours(-2) },
      { id: "open-old", closesAt: hours(10), closedAt: null, createdAt: hours(-50) },
      { id: "open-new", closesAt: hours(10), closedAt: null, createdAt: hours(-5) },
      { id: "closed-old", closesAt: hours(-40), closedAt: null, createdAt: hours(-60) },
    ];

    const order = [...polls]
      .sort((a, b) => comparePolls(a, b, now))
      .map((poll) => poll.id);

    assert.deepEqual(order, ["open-new", "open-old", "closed-new", "closed-old"]);
  });
});
