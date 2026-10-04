import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CircleCheck,
  Clock,
  FileText,
  Lock,
  MapPin,
  Users,
  Vote,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { BarList } from "../charts";
import {
  apiMessage,
  apiStatus,
  pollRows,
  pollTiming,
  votesLabel,
} from "./helpers";

const LEADER_COLOR = "var(--series-2)";
const OTHER_COLOR = "var(--series-1)";

// Horizontal results: share of all votes per option; the leading
// option is highlighted, the caller's own vote is marked.
export function PollResults({ poll, showCases = true }) {
  const rows = pollRows(poll);
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  const leaders = rows.filter((row) => row.leader);
  const mine = rows.find((row) => row.mine);
  const linked = rows.filter((row) => row.issue);

  return (
    <div className="poll-results">
      <BarList
        data={rows.map((row) => ({
          key: row.id,
          label: row.label,
          value: row.votes,
          color: row.leader ? LEADER_COLOR : OTHER_COLOR,
          hint: votesLabel(row.votes),
          icon: row.mine ? (
            <CircleCheck className="poll-mine-icon" role="img" aria-label="Your vote" />
          ) : null,
        }))}
        max={Math.max(total, 1)}
        formatValue={(votes) =>
          total ? `${Math.round((votes / total) * 100)}%` : "0%"
        }
      />

      <p className="poll-summary">
        {total === 0 ? (
          <span>No votes yet.</span>
        ) : leaders.length === 1 ? (
          <span>
            <span
              className="legend-key legend-rect"
              style={{ "--key": LEADER_COLOR }}
              aria-hidden="true"
            />
            {poll.isOpen ? "Leading" : "Chosen"}: <strong>{leaders[0].label}</strong>
          </span>
        ) : (
          <span>
            <span
              className="legend-key legend-rect"
              style={{ "--key": LEADER_COLOR }}
              aria-hidden="true"
            />
            Tied at the top: <strong>{leaders.map((row) => row.label).join(" / ")}</strong>
          </span>
        )}

        {mine && (
          <span className="poll-mine">
            <CircleCheck aria-hidden="true" />
            Your vote: <strong>{mine.label}</strong>
          </span>
        )}
      </p>

      {showCases && linked.length > 0 && (
        <ul className="poll-cases" aria-label="Linked cases">
          {linked.map((row) => (
            <li key={row.id}>
              <FileText aria-hidden="true" />
              <Link to={`/issues/${row.issue.id}`} className="text-link">
                {row.issue.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Ballot. Signed-out visitors see the options and a log-in link;
// accounts without poll:vote see the options read-only.
export function PollVote({ poll, onVoted }) {
  const { can, isAuthenticated } = useAuth();
  const location = useLocation();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rows = pollRows(poll);
  const canVote = can("poll:vote") && poll.isOpen;

  async function refresh(flash) {
    try {
      const response = await api.get(`/polls/${poll.id}`);
      onVoted(response.data.poll, flash);
    } catch {
      setError(flash.text);
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (!choice) {
      setError("Pick an option first.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await api.post(`/polls/${poll.id}/vote`, {
        optionId: choice,
      });

      onVoted(response.data.poll, {
        tone: "success",
        text: `Vote counted. +2 ${FEATURES.civicCred} for having your say.`,
      });
    } catch (voteError) {
      const status = apiStatus(voteError);

      if (status === 409) {
        await refresh({
          tone: "info",
          text: "You've already voted in this Ward Vote, so here are the results.",
        });
      } else if (status === 400) {
        await refresh({
          tone: "warning",
          text: apiMessage(voteError, "This Ward Vote isn't taking votes any more."),
        });
      } else {
        setError(apiMessage(voteError, "Couldn't count your vote. Try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  const options = (
    <fieldset className="poll-ballot">
      <legend className="sr-only">{poll.question}</legend>
      <ul className="poll-options">
        {rows.map((row) => (
          <li
            key={row.id}
            className={`poll-option ${choice === row.id ? "is-selected" : ""}`}
          >
            {canVote ? (
              <label className="poll-option-label">
                <input
                  type="radio"
                  name={`poll-${poll.id}`}
                  value={row.id}
                  checked={choice === row.id}
                  onChange={() => {
                    setChoice(row.id);
                    setError("");
                  }}
                />
                <span>{row.label}</span>
              </label>
            ) : (
              <span className="poll-option-label">
                <span className="poll-option-bullet" aria-hidden="true" />
                <span>{row.label}</span>
              </span>
            )}

            {row.issue && (
              <Link to={`/issues/${row.issue.id}`} className="poll-case-link">
                <FileText aria-hidden="true" />
                {FEATURES.caseFile}
                <span className="sr-only">: {row.issue.title}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );

  if (!canVote) {
    return (
      <div className="poll-vote">
        {options}
        <div className="poll-actions">
          {!isAuthenticated ? (
            <>
              <Link
                to="/login"
                state={{ from: location.pathname }}
                className="btn btn-accent"
              >
                <Vote aria-hidden="true" />
                Log in to vote
              </Link>
              <span className="field-hint">
                Results show once you vote, or when the vote closes.
              </span>
            </>
          ) : (
            <span className="field-hint">
              Voting is open to resident accounts. Results show when the
              vote closes.
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="poll-vote" onSubmit={submit} noValidate>
      {options}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="poll-actions">
        <button type="submit" className="btn-accent" disabled={busy}>
          <Vote aria-hidden="true" />
          {busy ? "Counting…" : "Cast vote"}
        </button>
        <span className="field-hint">
          One vote each, final once cast. Results show after you vote.
        </span>
      </div>
    </form>
  );
}

export function ClosePollButton({ poll, onClosed }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function close() {
    setBusy(true);
    setError("");

    try {
      const response = await api.post(`/polls/${poll.id}/close`);
      onClosed(response.data.poll, {
        tone: "success",
        text: "Ward Vote closed. The results are now public.",
      });
    } catch (closeError) {
      setError(apiMessage(closeError, "Couldn't close the vote."));
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => setConfirming(true)}
      >
        <Lock aria-hidden="true" />
        Close now
      </button>
    );
  }

  return (
    <span className="inline-confirm" role="group" aria-label="Confirm closing the vote">
      <span>Close voting now?</span>
      <button type="button" className="btn-danger btn-sm" onClick={close} disabled={busy}>
        {busy ? "Closing…" : "Close vote"}
      </button>
      <button
        type="button"
        className="btn-ghost btn-sm"
        onClick={() => setConfirming(false)}
        disabled={busy}
      >
        Keep open
      </button>
      {error && <span className="text-danger">{error}</span>}
    </span>
  );
}

export function PollTags({ poll, now }) {
  return (
    <div className="poll-tags">
      {poll.isOpen ? (
        <span className="chip chip-accent">
          <Vote aria-hidden="true" />
          Open
        </span>
      ) : (
        <span className="chip chip-outline">
          <Lock aria-hidden="true" />
          Closed
        </span>
      )}
      <span className="chip chip-outline">
        <MapPin aria-hidden="true" />
        {poll.ward ? `${poll.ward.name} · ${poll.ward.code}` : "Citywide"}
      </span>
      <span className="poll-timing">
        <Clock aria-hidden="true" />
        {pollTiming(poll, now)}
      </span>
    </div>
  );
}

export default function PollCard({ poll, now, canManage, onChange }) {
  const [flash, setFlash] = useState(null);

  function update(next, message) {
    onChange(next);
    setFlash(message ?? null);
  }

  return (
    <article
      className={`card poll-card ${poll.isOpen ? "is-open" : "is-closed"}`}
      aria-labelledby={`poll-${poll.id}-q`}
    >
      <PollTags poll={poll} now={now} />

      <h3 id={`poll-${poll.id}-q`}>
        <Link to={`/polls/${poll.id}`}>{poll.question}</Link>
      </h3>

      {poll.description && (
        <p className="poll-description">{poll.description}</p>
      )}

      {flash && (
        <div
          className={
            flash.tone === "success"
              ? "form-success"
              : flash.tone === "warning"
                ? "alert alert-warning"
                : "form-info"
          }
          role="status"
        >
          {flash.text}
        </div>
      )}

      {poll.resultsVisible ? (
        <PollResults poll={poll} />
      ) : (
        <PollVote poll={poll} onVoted={update} />
      )}

      <div className="poll-foot">
        <span className="poll-total">
          <Users aria-hidden="true" />
          {votesLabel(poll.totalVotes)}
        </span>

        <Link to={`/polls/${poll.id}`} className="text-link">
          {poll.resultsVisible ? "Full results" : "Details"}
        </Link>

        {canManage && poll.isOpen && (
          <span className="poll-manage">
            <ClosePollButton poll={poll} onClosed={update} />
          </span>
        )}
      </div>
    </article>
  );
}
