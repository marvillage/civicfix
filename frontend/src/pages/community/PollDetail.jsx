import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Lock, Vote } from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { ChartFrame } from "../../components/charts";
import {
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import {
  ClosePollButton,
  PollResults,
  PollTags,
  PollVote,
} from "../../components/community/PollCard";
import {
  apiMessage,
  apiStatus,
  pollRows,
  useNow,
  votesLabel,
} from "../../components/community/helpers";
import { formatDate, formatDateTime, formatNumber } from "../../lib/format";

function flashClass(tone) {
  if (tone === "success") return "form-success";
  if (tone === "warning") return "alert alert-warning";
  return "form-info";
}

export default function PollDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const now = useNow();

  // Which poll the stored result belongs to; loading is derived.
  const [result, setResult] = useState({ id: null, poll: null, missing: false, error: "" });
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get(`/polls/${id}`)
      .then((response) => {
        if (active) {
          setResult({ id, poll: response.data.poll, missing: false, error: "" });
        }
      })
      .catch((fetchError) => {
        if (!active) return;

        const missing = apiStatus(fetchError) === 404;

        setResult({
          id,
          poll: null,
          missing,
          error: missing ? "" : apiMessage(fetchError, "Couldn't load this Ward Vote."),
        });
      });

    return () => {
      active = false;
    };
  }, [id]);

  const loading = result.id !== id;
  const { poll, missing, error } = result;

  function update(next, message) {
    setResult((current) => ({ ...current, poll: next }));
    setFlash(message ?? null);
  }

  const back = (
    <Link to="/polls" className="back-link">
      <ArrowLeft aria-hidden="true" />
      All Ward Votes
    </Link>
  );

  if (loading) return <Loading label="Loading the Ward Vote…" />;

  if (missing || !poll) {
    return (
      <div className="page">
        {back}
        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : (
          <EmptyState icon={Vote} title="This Ward Vote doesn't exist">
            It may have been removed, or the link is wrong.
          </EmptyState>
        )}
      </div>
    );
  }

  const rows = pollRows(poll);
  const linked = rows.filter((row) => row.issue);
  const mine = rows.find((row) => row.mine);
  const tableRows = rows.map((row) => ({
    id: row.id,
    label: row.mine ? `${row.label} (your vote)` : row.label,
    votes: row.votes,
    share: row.share,
  }));

  return (
    <div className="page poll-detail">
      {back}

      <PageHeader
        eyebrow={FEATURES.wardVote}
        title={poll.question}
        description={poll.description ?? undefined}
        actions={
          can("poll:manage") && poll.isOpen ? (
            <ClosePollButton poll={poll} onClosed={update} />
          ) : null
        }
      >
        <PollTags poll={poll} now={now} />
      </PageHeader>

      {flash && (
        <div className={flashClass(flash.tone)} role="status">
          {flash.text}
        </div>
      )}

      <div className="grid-main-side">
        <div className="stack">
          {poll.resultsVisible ? (
            <ChartFrame
              title={poll.isOpen ? "Live results" : "Final results"}
              subtitle={`${votesLabel(poll.totalVotes)} · share of all votes`}
              legend={[
                {
                  label: poll.isOpen ? "Leading" : "Chosen",
                  color: "var(--series-2)",
                },
                { label: "Other options", color: "var(--series-1)" },
              ]}
              table={{
                columns: [
                  { key: "label", label: "Option" },
                  { key: "votes", label: "Votes", numeric: true, format: formatNumber },
                  {
                    key: "share",
                    label: "Share",
                    numeric: true,
                    format: (value) => `${value.toFixed(1)}%`,
                  },
                ],
                rows: tableRows,
              }}
            >
              <PollResults poll={poll} showCases={false} />
            </ChartFrame>
          ) : (
            <section className="card" aria-labelledby="ballot-title">
              <div className="section-head">
                <div>
                  <h2 id="ballot-title">Cast your vote</h2>
                  <p className="section-lede">
                    Results unlock after you vote, or for everyone when the
                    vote closes on {formatDateTime(poll.closesAt)}.
                  </p>
                </div>
              </div>
              <PollVote poll={poll} onVoted={update} />
            </section>
          )}
        </div>

        <aside className="stack feature-rail" aria-label="About this vote">
          <section className="card">
            <h2 className="rail-title">Details</h2>
            <dl className="details-grid poll-facts">
              <div className="detail-item">
                <dt className="detail-label">Ward</dt>
                <dd className="detail-value">
                  {poll.ward ? `${poll.ward.name} (${poll.ward.code})` : "Citywide"}
                </dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Opened</dt>
                <dd className="detail-value">{formatDate(poll.createdAt)}</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">{poll.isOpen ? "Closes" : "Closed"}</dt>
                <dd className="detail-value">
                  {formatDateTime(poll.isOpen ? poll.closesAt : poll.closedAt ?? poll.closesAt)}
                </dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Votes cast</dt>
                <dd className="detail-value">{formatNumber(poll.totalVotes)}</dd>
              </div>
              {mine && (
                <div className="detail-item">
                  <dt className="detail-label">Your vote</dt>
                  <dd className="detail-value">{mine.label}</dd>
                </div>
              )}
            </dl>
          </section>

          {linked.length > 0 && (
            <section className="card">
              <h2 className="rail-title">Linked cases</h2>
              <ul className="list-divided linked-cases">
                {linked.map((row) => (
                  <li key={row.id}>
                    <Link to={`/issues/${row.issue.id}`} className="linked-case">
                      <FileText aria-hidden="true" />
                      <span>
                        <strong>{row.issue.title}</strong>
                        <span className="meta-row">
                          <CategoryChip category={row.issue.category} short />
                          <StatusBadge status={row.issue.status} />
                        </span>
                        <small>Option: {row.label}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card card-navy rail-callout">
            <span className="rail-callout-icon" aria-hidden="true">
              <Lock />
            </span>
            <h2>What happens with the result</h2>
            <p>
              When the vote closes, the ward office starts with the chosen
              option. Linked Case Files show the work as it happens, so you
              can hold them to it.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
