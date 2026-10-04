import type { Prisma } from "../generated/prisma/client";

// ─────────────────────────────────────────────
// WARD VOTE RULES
// Pure open/closed and result-visibility logic, free of I/O so
// it can be unit tested.
// ─────────────────────────────────────────────

export const POLL_STATUS_FILTERS = ["open", "closed", "all"] as const;

export type PollStatusFilter = (typeof POLL_STATUS_FILTERS)[number];

// Civic points for taking part in a Ward Vote.
export const POLL_VOTE_POINTS = 2;

export interface PollWindow {
  closesAt: Date;
  closedAt: Date | null;
}

// Open until an admin closes it or its closing time passes.
export function isPollOpen(
  poll: PollWindow,
  now: Date = new Date()
) {
  return !poll.closedAt && poll.closesAt > now;
}

// Live tallies stay hidden while a poll is open so early results
// don't sway later voters. They show once the poll is closed,
// once the caller has voted, or to staff with poll:results.
export function areResultsVisible(options: {
  isOpen: boolean;
  hasVoted: boolean;
  canSeeLiveResults: boolean;
}) {
  return (
    !options.isOpen ||
    options.hasVoted ||
    options.canSeeLiveResults
  );
}

// The same rule as isPollOpen(), as a database filter.
export function pollStatusWhere(
  status: PollStatusFilter,
  now: Date = new Date()
): Prisma.PollWhereInput {
  switch (status) {
    case "open":
      return { closedAt: null, closesAt: { gt: now } };
    case "closed":
      return {
        OR: [{ closedAt: { not: null } }, { closesAt: { lte: now } }],
      };
    case "all":
      return {};
  }
}

// Open polls first, then newest first.
export function comparePolls(
  a: PollWindow & { createdAt: Date },
  b: PollWindow & { createdAt: Date },
  now: Date = new Date()
) {
  const openA = isPollOpen(a, now);
  const openB = isPollOpen(b, now);

  if (openA !== openB) return openA ? -1 : 1;

  return b.createdAt.getTime() - a.createdAt.getTime();
}
