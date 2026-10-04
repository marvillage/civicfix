import { Router } from "express";
import {
  authenticate,
  optionalAuthenticate,
} from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/role.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  closePollController,
  createPollBody,
  createPollController,
  getPollController,
  listPollsController,
  listPollsQuery,
  voteBody,
  voteController,
} from "../controllers/poll.controller";

// ─────────────────────────────────────────────
// WARD VOTE — /api/polls
// Reads are public; a signed-in caller also sees their own vote.
// ─────────────────────────────────────────────

const router = Router();

router.get(
  "/",
  optionalAuthenticate,
  validate({ query: listPollsQuery }),
  listPollsController
);

router.get("/:id", optionalAuthenticate, getPollController);

router.post(
  "/",
  authenticate,
  requirePermission("poll:manage"),
  validate({ body: createPollBody }),
  createPollController
);

router.post(
  "/:id/vote",
  authenticate,
  requirePermission("poll:vote"),
  validate({ body: voteBody }),
  voteController
);

router.post(
  "/:id/close",
  authenticate,
  requirePermission("poll:manage"),
  closePollController
);

export default router;
