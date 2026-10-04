import { z } from "zod";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { input } from "../middleware/validate.middleware";
import { asyncHandler, param } from "../lib/http";
import { recordAudit } from "../services/audit.service";
import { POLL_STATUS_FILTERS } from "../services/poll.rules";
import {
  castVote,
  closePoll,
  createPoll,
  getPoll,
  listPolls,
} from "../services/poll.service";
import { dateField, optionalId } from "./schema.helpers";

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

export const listPollsQuery = z.object({
  status: z.enum(POLL_STATUS_FILTERS).default("all"),
  wardId: optionalId,
});

const pollOption = z.object({
  label: z
    .string({ error: "Each option needs a label" })
    .trim()
    .min(1, "Each option needs a label")
    .max(80, "Option labels must be at most 80 characters"),
  issueId: optionalId,
});

export const createPollBody = z.object({
  question: z
    .string({ error: "question is required" })
    .trim()
    .min(8, "Question must be at least 8 characters")
    .max(160, "Question must be at most 160 characters"),
  description: z
    .string()
    .trim()
    .max(600, "Description must be at most 600 characters")
    .optional(),
  wardId: optionalId,
  closesAt: dateField("closesAt").refine(
    (date) => date.getTime() > Date.now(),
    "closesAt must be in the future"
  ),
  options: z
    .array(pollOption, { error: "options must be a list" })
    .min(2, "A poll needs 2 to 6 options")
    .max(6, "A poll needs 2 to 6 options")
    .refine(
      (options) =>
        new Set(options.map((option) => option.label.toLowerCase()))
          .size === options.length,
      "Each option needs a different label"
    ),
});

export const voteBody = z.object({
  optionId: z
    .string({ error: "optionId is required" })
    .trim()
    .min(1, "optionId is required"),
});

// ─────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────

export const listPollsController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = input(res, "query", listPollsQuery);
    const polls = await listPolls(query, req.user);

    res.json({ polls });
  });

export const getPollController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const poll = await getPoll(param(req, "id"), req.user);

    res.json({ poll });
  });

export const createPollController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = input(res, "body", createPollBody);
    const poll = await createPoll(req.user!, body);

    await recordAudit({
      actorId: req.user!.userId,
      action: "poll.create",
      entityType: "Poll",
      entityId: poll.id,
      meta: {
        question: poll.question,
        wardId: poll.ward?.id ?? null,
        closesAt: poll.closesAt.toISOString(),
        options: poll.options.length,
      },
      ip: req.ip,
    });

    res.status(201).json({ poll });
  });

export const voteController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { optionId } = input(res, "body", voteBody);
    const poll = await castVote(
      param(req, "id"),
      optionId,
      req.user!
    );

    res.json({ poll });
  });

export const closePollController =
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const poll = await closePoll(param(req, "id"), req.user!);

    await recordAudit({
      actorId: req.user!.userId,
      action: "poll.close",
      entityType: "Poll",
      entityId: poll.id,
      meta: { question: poll.question, totalVotes: poll.totalVotes },
      ip: req.ip,
    });

    res.json({ poll });
  });
