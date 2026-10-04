import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CircleCheck, Hourglass, Plus, Users, Vote } from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import {
  EmptyState,
  Loading,
  PageHeader,
  StatTile,
} from "../../components/ui";
import Modal from "../../components/ui/Modal";
import PollCard from "../../components/community/PollCard";
import PollForm from "../../components/community/PollForm";
import {
  apiMessage,
  formatSpan,
  mergeWards,
  useNow,
  useWards,
} from "../../components/community/helpers";
import { formatNumber } from "../../lib/format";

export default function Polls() {
  const { can, isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useNow();
  const baseWards = useWards(can);
  const wardId = searchParams.get("ward") || "";

  const [result, setResult] = useState({ key: "", list: [] });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const requestKey = `${wardId}|${reloadKey}`;

  useEffect(() => {
    let active = true;

    api
      .get("/polls", { params: { status: "all", ...(wardId ? { wardId } : {}) } })
      .then((response) => {
        if (!active) return;
        setResult({ key: requestKey, list: response.data.polls || [] });
        setError("");
      })
      .catch((fetchError) => {
        if (!active) return;
        setResult({ key: requestKey, list: [] });
        setError(apiMessage(fetchError, "Couldn't load Ward Votes."));
      });

    return () => {
      active = false;
    };
  }, [wardId, requestKey]);

  const loading = result.key !== requestKey;
  const polls = result.list;

  const wards = useMemo(
    () => mergeWards(baseWards, polls.map((poll) => poll.ward)),
    [baseWards, polls]
  );

  const open = polls.filter((poll) => poll.isOpen);
  const closed = polls.filter((poll) => !poll.isOpen);
  const votesCast = polls.reduce((sum, poll) => sum + (poll.totalVotes || 0), 0);
  const myVotes = polls.filter((poll) => poll.myVoteOptionId).length;
  const awaiting = open.filter((poll) => !poll.myVoteOptionId).length;
  const nextClosing = [...open].sort(
    (a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt)
  )[0];

  function replacePoll(next) {
    setResult((current) => ({
      ...current,
      list: current.list.map((poll) => (poll.id === next.id ? next : poll)),
    }));
  }

  function handleCreated(poll) {
    setCreating(false);
    setNotice(`“${poll.question}” is open for votes.`);
    setReloadKey((key) => key + 1);
  }

  function setWard(value) {
    const next = new URLSearchParams(searchParams);

    if (value) next.set("ward", value);
    else next.delete("ward");

    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page polls-page">
      <PageHeader
        eyebrow={FEATURES.wardVote}
        title="Have a say in what gets fixed first"
        description="The city puts real choices to a vote: which repair gets the ward fund, when pickups run, where new lights go. One resident, one vote."
        actions={
          can("poll:manage") ? (
            <button
              type="button"
              className="btn-accent"
              onClick={() => setCreating(true)}
            >
              <Plus aria-hidden="true" />
              Open a Ward Vote
            </button>
          ) : !isAuthenticated ? (
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="btn btn-ghost"
            >
              <Vote aria-hidden="true" />
              Log in to vote
            </Link>
          ) : null
        }
      />

      {!loading && polls.length > 0 && (
        <section className="kpi-row" aria-label="Ward Vote at a glance">
          <StatTile
            label="Open now"
            value={formatNumber(open.length)}
            hint={
              can("poll:vote")
                ? awaiting
                  ? `${awaiting} waiting for your vote`
                  : "You've voted in all of them"
                : "taking votes"
            }
            icon={Vote}
            tone="navy"
          />
          <StatTile
            label="Votes cast"
            value={formatNumber(votesCast)}
            hint={`across ${polls.length} Ward Votes`}
            icon={Users}
          />
          {can("poll:vote") ? (
            <StatTile
              label="Your votes"
              value={formatNumber(myVotes)}
              hint="+2 Civic Cred each"
              icon={CircleCheck}
              tone="success"
            />
          ) : (
            <StatTile
              label="Closing next"
              value={
                nextClosing
                  ? formatSpan(Date.parse(nextClosing.closesAt) - now)
                  : "—"
              }
              hint={nextClosing ? "until the next vote closes" : "no open votes"}
              icon={Hourglass}
              tone="warning"
            />
          )}
        </section>
      )}

      <div className="filters-bar feature-filters">
        <div className="filter-select">
          <label htmlFor="poll-ward-filter" className="sr-only">
            Ward
          </label>
          <select
            id="poll-ward-filter"
            value={wardId}
            onChange={(event) => setWard(event.target.value)}
          >
            <option value="">All wards and citywide</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.name} ({ward.code})
              </option>
            ))}
          </select>
        </div>
        <p className="filter-note">
          Results stay hidden until you vote, so early numbers don't sway
          anyone. Closed votes are public to all.
        </p>
      </div>

      {notice && (
        <div className="form-success" role="status">
          {notice}
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <Loading label="Loading Ward Votes…" />
      ) : polls.length === 0 ? (
        <EmptyState icon={Vote} title="No Ward Votes here yet">
          {wardId
            ? "Nothing has been put to a vote in this ward. Try all wards."
            : "When the city puts a choice to residents, it shows up here."}
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="polls-open">
            <h2 id="polls-open" className="feature-section-title">
              Open now <span className="tab-count">{open.length}</span>
            </h2>

            {open.length === 0 ? (
              <p className="empty-inline">
                No votes are open right now. Closed results are below.
              </p>
            ) : (
              <div className="poll-grid">
                {open.map((poll) => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    now={now}
                    canManage={can("poll:manage")}
                    onChange={replacePoll}
                  />
                ))}
              </div>
            )}
          </section>

          {closed.length > 0 && (
            <section aria-labelledby="polls-closed">
              <h2 id="polls-closed" className="feature-section-title">
                Closed <span className="tab-count">{closed.length}</span>
              </h2>

              <div className="poll-grid">
                {closed.map((poll) => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    now={now}
                    canManage={false}
                    onChange={replacePoll}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {creating && (
        <Modal
          className="community-modal"
          eyebrow={FEATURES.wardVote}
          title="Open a Ward Vote"
          onClose={() => setCreating(false)}
          wide
        >
          <PollForm
            wards={wards}
            onCreated={handleCreated}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}
    </div>
  );
}
