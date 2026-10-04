import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { can } from "../auth/permissions";
import {
  badRequest,
  conflict,
  notFound,
} from "../lib/http";
import {
  areResultsVisible,
  comparePolls,
  isPollOpen,
  POLL_VOTE_POINTS,
  PollStatusFilter,
  pollStatusWhere,
} from "./poll.rules";

// ─────────────────────────────────────────────
// WARD VOTE
// Participatory polls. One vote per user per poll is enforced
// by a unique constraint, not just by this code.
// ─────────────────────────────────────────────

export interface Viewer {
  userId: string;
  role: string;
}

const MAX_LISTED_POLLS = 100;

const POLL_INCLUDE = {
  ward: { select: { id: true, name: true, code: true } },
  options: {
    orderBy: { position: "asc" },
    include: {
      issue: {
        select: { id: true, title: true, status: true, category: true },
      },
      _count: { select: { votes: true } },
    },
  },
} satisfies Prisma.PollInclude;

type PollRow = Prisma.PollGetPayload<{ include: typeof POLL_INCLUDE }>;

function serializePoll(
  row: PollRow,
  context: {
    myVoteOptionId: string | null;
    canSeeLiveResults: boolean;
    now: Date;
  }
) {
  const isOpen = isPollOpen(row, context.now);

  const resultsVisible = areResultsVisible({
    isOpen,
    hasVoted: context.myVoteOptionId !== null,
    canSeeLiveResults: context.canSeeLiveResults,
  });

  const totalVotes = row.options.reduce(
    (sum, option) => sum + option._count.votes,
    0
  );

  return {
    id: row.id,
    question: row.question,
    description: row.description,
    ward: row.ward,
    closesAt: row.closesAt,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    isOpen,
    totalVotes,
    myVoteOptionId: context.myVoteOptionId,
    resultsVisible,
    options: row.options.map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
      issue: option.issue,
      votes: resultsVisible ? option._count.votes : null,
    })),
  };
}

// The viewer's vote in each of the given polls.
async function myVotes(viewer: Viewer | undefined, pollIds: string[]) {
  const votes = new Map<string, string>();

  if (!viewer || pollIds.length === 0) return votes;

  const rows = await prisma.pollVote.findMany({
    where: { userId: viewer.userId, pollId: { in: pollIds } },
    select: { pollId: true, optionId: true },
  });

  rows.forEach((vote) => votes.set(vote.pollId, vote.optionId));

  return votes;
}

async function serializeForViewer(
  rows: PollRow[],
  viewer: Viewer | undefined
) {
  const now = new Date();
  const votes = await myVotes(
    viewer,
    rows.map((row) => row.id)
  );
  const canSeeLiveResults = viewer
    ? can(viewer.role, "poll:results")
    : false;

  return rows.map((row) =>
    serializePoll(row, {
      myVoteOptionId: votes.get(row.id) ?? null,
      canSeeLiveResults,
      now,
    })
  );
}

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export async function listPolls(
  filters: { status: PollStatusFilter; wardId?: string },
  viewer?: Viewer
) {
  const now = new Date();

  const rows = await prisma.poll.findMany({
    where: {
      AND: [
        pollStatusWhere(filters.status, now),
        // A ward's list includes citywide polls.
        filters.wardId
          ? { OR: [{ wardId: filters.wardId }, { wardId: null }] }
          : {},
      ],
    },
    include: POLL_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_LISTED_POLLS,
  });

  rows.sort((a, b) => comparePolls(a, b, now));

  return serializeForViewer(rows, viewer);
}

export async function getPoll(pollId: string, viewer?: Viewer) {
  const row = await prisma.poll.findUnique({
    where: { id: pollId },
    include: POLL_INCLUDE,
  });

  if (!row) {
    throw notFound("Poll");
  }

  const [poll] = await serializeForViewer([row], viewer);

  return poll;
}

// ─────────────────────────────────────────────
// CREATE / CLOSE
// ─────────────────────────────────────────────

export interface PollInput {
  question: string;
  description?: string;
  wardId?: string;
  closesAt: Date;
  options: { label: string; issueId?: string }[];
}

export async function createPoll(viewer: Viewer, input: PollInput) {
  if (input.wardId) {
    const ward = await prisma.ward.findUnique({
      where: { id: input.wardId },
      select: { id: true },
    });

    if (!ward) throw notFound("Ward");
  }

  const issueIds = [
    ...new Set(
      input.options
        .map((option) => option.issueId)
        .filter((id): id is string => !!id)
    ),
  ];

  if (issueIds.length > 0) {
    const found = await prisma.issue.count({
      where: { id: { in: issueIds } },
    });

    if (found !== issueIds.length) {
      throw badRequest("An option links to a case that does not exist");
    }
  }

  // Poll and options are written together in one statement.
  const row = await prisma.poll.create({
    data: {
      question: input.question,
      description: input.description || null,
      wardId: input.wardId ?? null,
      closesAt: input.closesAt,
      createdById: viewer.userId,
      options: {
        create: input.options.map((option, index) => ({
          label: option.label,
          issueId: option.issueId ?? null,
          position: index,
        })),
      },
    },
    include: POLL_INCLUDE,
  });

  const [poll] = await serializeForViewer([row], viewer);

  return poll;
}

export async function closePoll(pollId: string, viewer: Viewer) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { closesAt: true, closedAt: true },
  });

  if (!poll) {
    throw notFound("Poll");
  }

  if (!isPollOpen(poll)) {
    throw conflict("This poll is already closed");
  }

  await prisma.poll.update({
    where: { id: pollId },
    data: { closedAt: new Date() },
  });

  return getPoll(pollId, viewer);
}

// ─────────────────────────────────────────────
// VOTE
// ─────────────────────────────────────────────

function isUniqueViolation(error: unknown) {
  return (error as { code?: string })?.code === "P2002";
}

export async function castVote(
  pollId: string,
  optionId: string,
  viewer: Viewer
) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: {
      closesAt: true,
      closedAt: true,
      options: { select: { id: true } },
    },
  });

  if (!poll) {
    throw notFound("Poll");
  }

  if (!isPollOpen(poll)) {
    throw badRequest("This poll is closed");
  }

  if (!poll.options.some((option) => option.id === optionId)) {
    throw badRequest("That option is not part of this poll");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.pollVote.create({
        data: { pollId, optionId, userId: viewer.userId },
      });

      await tx.user.update({
        where: { id: viewer.userId },
        data: { points: { increment: POLL_VOTE_POINTS } },
      });
    });
  } catch (error) {
    // The (pollId, userId) unique constraint is the real guard,
    // so double-clicks and parallel requests can't vote twice.
    if (isUniqueViolation(error)) {
      throw conflict("You have already voted in this poll");
    }

    throw error;
  }

  return getPoll(pollId, viewer);
}
