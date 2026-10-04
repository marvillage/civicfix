import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  HandHeart,
  LocateFixed,
  Megaphone,
  ThumbsUp,
  Timer,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import {
  Avatar,
  CategoryChip,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatTile,
  StatusBadge,
} from "../../components/ui";
import { CATEGORY_META } from "../../lib/labels";
import {
  formatDate,
  formatNumber,
  labelize,
  timeAgo,
} from "../../lib/format";
import { BadgeGrid, FixClockChip } from "../CaseKit";
import {
  DONE_STATUSES,
  SIGN_OFF_STATUSES,
  firstName,
  fixClock,
  greeting,
  useNow,
} from "../caseUtils";

const BULLETIN_TONE = {
  OUTAGE: "chip-danger",
  ROADWORKS: "chip-warning",
  ADVISORY: "chip-info",
  EVENT: "chip-success",
};

// Resolve to the picked value, or the fallback on any error —
// the community endpoints may not exist yet, and that's fine.
async function quiet(request, pick, fallback) {
  try {
    const response = await request;
    return pick(response.data) ?? fallback;
  } catch {
    return fallback;
  }
}

function FeedCard({ icon: Icon, title, to, linkLabel = "See all", children }) {
  return (
    <section className="card cz-feed">
      <header className="cz-feed-head">
        <span className="cz-feed-icon" aria-hidden="true">
          <Icon />
        </span>
        <h3>{title}</h3>
        <Link to={to} className="text-link cz-feed-link">
          {linkLabel}
          <span className="sr-only"> — {title}</span>
        </Link>
      </header>
      {children}
    </section>
  );
}

function FeedEmpty({ children, action }) {
  return (
    <div className="cz-feed-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

function CaseThumb({ complaint }) {
  const category = complaint.issue?.category;
  const meta = CATEGORY_META[category] ?? CATEGORY_META.OTHER;
  const Icon = meta.icon;

  if (complaint.imageUrl) {
    return (
      <img
        className="cz-case-thumb"
        src={complaint.imageUrl}
        alt=""
        loading="lazy"
      />
    );
  }

  return (
    <span className="cz-case-thumb cz-case-thumb-empty" aria-hidden="true">
      <Icon />
    </span>
  );
}

export default function CitizenDashboard() {
  const { user, can } = useAuth();
  const now = useNow(60_000);

  const [complaints, setComplaints] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [caseError, setCaseError] = useState("");

  const [impact, setImpact] = useState(null);
  const [badges, setBadges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const [bulletins, setBulletins] = useState(null);
  const [zones, setZones] = useState(null);
  const [polls, setPolls] = useState(null);
  const [drives, setDrives] = useState(null);

  const canWatch = can("watchzone:manage");

  useEffect(() => {
    let cancelled = false;

    api
      .get("/complaints/my")
      .then((response) => {
        if (!cancelled) setComplaints(response.data.complaints || []);
      })
      .catch((error) => {
        console.error("Fetch complaints error:", error);
        if (!cancelled) {
          setCaseError(
            error.response?.data?.message ||
              "Unable to load your recent cases."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCases(false);
      });

    quiet(api.get("/dashboard/my-impact"), (d) => d.impact, null).then(
      (value) => !cancelled && setImpact(value)
    );
    quiet(api.get("/dashboard/my-badges"), (d) => d.badges, []).then(
      (value) => !cancelled && setBadges(value)
    );
    quiet(
      api.get("/dashboard/leaderboard"),
      (d) => d.leaderboard,
      []
    ).then((value) => !cancelled && setLeaderboard(value));

    quiet(
      api.get("/bulletins", { params: { status: "active" } }),
      (d) => d.bulletins,
      []
    ).then((value) => !cancelled && setBulletins(value));
    quiet(
      api.get("/polls", { params: { status: "open" } }),
      (d) => d.polls,
      []
    ).then((value) => !cancelled && setPolls(value));
    quiet(
      api.get("/drives", { params: { status: "upcoming" } }),
      (d) => d.drives,
      []
    ).then((value) => !cancelled && setDrives(value));

    if (canWatch) {
      quiet(api.get("/watch-zones"), (d) => d.zones, []).then(
        (value) => !cancelled && setZones(value)
      );
    }

    return () => {
      cancelled = true;
    };
  }, [canWatch]);

  const openCases = complaints.filter(
    (complaint) =>
      complaint.issue && !DONE_STATUSES.includes(complaint.issue.status)
  );
  const awaitingSignOff = complaints.filter((complaint) =>
    SIGN_OFF_STATUSES.includes(complaint.issue?.status)
  );
  const recent = complaints.slice(0, 4);
  const lateCases = openCases.filter(
    (complaint) =>
      fixClock(
        {
          sla: complaint.issue.sla,
          status: complaint.issue.status,
          createdAt: complaint.issue.createdAt,
        },
        now
      )?.state === "breached"
  );

  const myRank =
    leaderboard.findIndex((entry) => entry.id === user?.id) + 1;
  const myEntry = leaderboard.find((entry) => entry.id === user?.id);
  const points = myEntry?.points ?? user?.points ?? 0;
  const earnedCount = badges.filter((badge) => badge.earned).length;

  const totalReports = impact?.totalReports ?? complaints.length;
  const resolved = impact?.resolved ?? 0;
  const fixRate = totalReports
    ? Math.round((resolved / totalReports) * 100)
    : null;

  let summary =
    "Nothing open right now. Spotted something broken? Snap a photo and the city takes it from there.";

  if (!loadingCases && complaints.length > 0) {
    const parts = [];

    if (openCases.length) {
      parts.push(
        `${openCases.length} of your cases ${
          openCases.length === 1 ? "is" : "are"
        } still moving`
      );
    }

    if (awaitingSignOff.length) {
      parts.push(
        `${awaitingSignOff.length} ${
          awaitingSignOff.length === 1 ? "fix is" : "fixes are"
        } waiting for your ${FEATURES.signOff}`
      );
    }

    if (parts.length) summary = `${parts.join(", and ")}.`;
  }

  const zoneOpenTotal = (zones ?? []).reduce(
    (sum, zone) => sum + (Number(zone.openIssues) || 0),
    0
  );

  return (
    <div className="page cz-home">
      <PageHeader
        eyebrow={user?.ward || "Your workspace"}
        title={`${greeting()}, ${firstName(user?.name)}`}
        description={summary}
        actions={
          <Link to="/citizen/report" className="btn btn-accent btn-lg">
            <Camera aria-hidden="true" />
            {FEATURES.snapSend}
          </Link>
        }
      />

      {awaitingSignOff.length > 0 && (
        <Link
          to={`/citizen/complaints/${awaitingSignOff[0].id}`}
          className="card card-accent card-link cz-signoff"
        >
          <span className="cz-signoff-icon" aria-hidden="true">
            <BadgeCheck />
          </span>
          <span className="cz-signoff-text">
            <strong>
              {awaitingSignOff.length === 1
                ? "A fix is waiting for your Sign-Off"
                : `${awaitingSignOff.length} fixes are waiting for your Sign-Off`}
            </strong>
            <span>
              The crew marked “{awaitingSignOff[0].issue?.title}” as fixed.
              Compare the before and after, then rate the work or reopen it.
            </span>
          </span>
          <span className="cz-signoff-cta">
            Review
            <ArrowRight aria-hidden="true" />
          </span>
        </Link>
      )}

      <section aria-labelledby="footprint-title">
        <SectionHeader
          eyebrow={FEATURES.footprint}
          title={<span id="footprint-title">What your reports have done</span>}
        />

        <div className="kpi-row">
          <StatTile
            label="Reports filed"
            value={formatNumber(totalReports)}
            hint={
              user?.createdAt
                ? `since ${formatDate(user.createdAt, { day: undefined })}`
                : "since you joined"
            }
            icon={ClipboardList}
            tone="navy"
            to="/citizen/complaints"
          />
          <StatTile
            label="Fixed because of you"
            value={formatNumber(resolved)}
            hint={fixRate != null ? `${fixRate}% of your reports` : undefined}
            icon={CircleCheck}
            tone="success"
          />
          <StatTile
            label="Backers on your cases"
            value={formatNumber(impact?.upvotesReceived ?? 0)}
            hint={`neighbours who hit ${FEATURES.backIt}`}
            icon={ThumbsUp}
          />
          <StatTile
            label="Open right now"
            value={formatNumber(openCases.length)}
            hint={
              lateCases.length
                ? `${lateCases.length} past the ${FEATURES.fixClock}`
                : `all inside their ${FEATURES.fixClock}`
            }
            icon={Timer}
            tone={lateCases.length ? "danger" : "warning"}
            to="/citizen/complaints"
          />
        </div>
      </section>

      <div className="grid-main-side">
        <div className="cz-main">
        <div className="card cz-cases">
          <SectionHeader
            eyebrow={FEATURES.myCases}
            title="Your latest reports"
            actions={
              complaints.length > 0 && (
                <Link to="/citizen/complaints" className="btn btn-ghost btn-sm">
                  All {complaints.length} cases
                  <ArrowRight aria-hidden="true" />
                </Link>
              )
            }
          />

          {loadingCases && (
            <div className="cz-case-skeletons" aria-hidden="true">
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          )}

          {!loadingCases && caseError && (
            <div className="form-error">{caseError}</div>
          )}

          {!loadingCases && !caseError && recent.length === 0 && (
            <EmptyState
              icon={Camera}
              title="No reports yet"
              action={
                <Link to="/citizen/report" className="btn btn-accent">
                  <Camera aria-hidden="true" />
                  Make your first report
                </Link>
              }
            >
              A photo and a pin is all it takes. {FEATURES.autoSort} works
              out the rest and routes it to the right crew.
            </EmptyState>
          )}

          {!loadingCases && recent.length > 0 && (
            <ul className="list-divided cz-case-list">
              {recent.map((complaint) => {
                const issue = complaint.issue;
                const clock = issue
                  ? fixClock(
                      {
                        sla: issue.sla,
                        status: issue.status,
                        createdAt: issue.createdAt,
                      },
                      now
                    )
                  : null;

                return (
                  <li key={complaint.id}>
                    <Link
                      to={`/citizen/complaints/${complaint.id}`}
                      className="cz-case"
                    >
                      <CaseThumb complaint={complaint} />

                      <span className="cz-case-main">
                        <strong>{issue?.title || "Untitled case"}</strong>
                        <span className="meta-row">
                          <StatusBadge status={issue?.status} />
                          {issue?.category && (
                            <CategoryChip category={issue.category} short />
                          )}
                          <span>{timeAgo(complaint.createdAt, now)}</span>
                        </span>
                      </span>

                      {clock && clock.state !== "done" && (
                        <FixClockChip clock={clock} />
                      )}

                      <ChevronRight className="cz-case-arrow" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>



      <section aria-labelledby="ward-title">
        <SectionHeader
          eyebrow="Community"
          title={<span id="ward-title">Around your ward</span>}
          description="Notices, votes and cleanups near you."
        />

        <div className="cz-feeds">
          <FeedCard icon={Megaphone} title={FEATURES.bulletins} to="/bulletins">
            {bulletins == null ? (
              <span className="skeleton cz-feed-skeleton" aria-hidden="true" />
            ) : bulletins.length === 0 ? (
              <FeedEmpty>No active notices right now. Outages and roadworks show up here.</FeedEmpty>
            ) : (
              <ul className="cz-feed-list">
                {bulletins.slice(0, 3).map((bulletin) => (
                  <li key={bulletin.id}>
                    <span className={`chip ${BULLETIN_TONE[bulletin.kind] ?? ""}`}>
                      {labelize(bulletin.kind)}
                    </span>
                    <strong>{bulletin.title}</strong>
                    <small>
                      {bulletin.ward?.name ?? "Citywide"}
                      {bulletin.endsAt
                        ? ` · until ${formatDate(bulletin.endsAt, { year: undefined })}`
                        : ""}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </FeedCard>

          <FeedCard icon={Vote} title={FEATURES.wardVote} to="/polls">
            {polls == null ? (
              <span className="skeleton cz-feed-skeleton" aria-hidden="true" />
            ) : polls.length === 0 ? (
              <FeedEmpty>No open votes. When your ward asks what to fix first, you'll get a say here.</FeedEmpty>
            ) : (
              <ul className="cz-feed-list">
                {polls.slice(0, 2).map((poll) => (
                  <li key={poll.id}>
                    <Link to={`/polls/${poll.id}`} className="cz-feed-row-link">
                      <strong>{poll.question}</strong>
                    </Link>
                    <small>
                      {formatNumber(poll.totalVotes ?? 0)} votes · closes{" "}
                      {timeAgo(poll.closesAt, now)}
                    </small>
                    {poll.myVoteOptionId ? (
                      <span className="chip chip-success">
                        <CircleCheck aria-hidden="true" />
                        You voted
                      </span>
                    ) : (
                      <span className="chip chip-accent">Vote now</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </FeedCard>

          <FeedCard icon={HandHeart} title={FEATURES.drives} to="/drives">
            {drives == null ? (
              <span className="skeleton cz-feed-skeleton" aria-hidden="true" />
            ) : drives.length === 0 ? (
              <FeedEmpty
                action={
                  can("drive:propose") && (
                    <Link to="/drives/new" className="btn btn-secondary btn-sm">
                      Organise one
                    </Link>
                  )
                }
              >
                No cleanups planned yet.
              </FeedEmpty>
            ) : (
              <ul className="cz-feed-list">
                {drives.slice(0, 2).map((drive) => {
                  const date = new Date(drive.startsAt);

                  return (
                    <li key={drive.id} className="cz-drive">
                      <span className="cz-drive-date" aria-hidden="true">
                        <strong>{date.getDate()}</strong>
                        {date.toLocaleDateString("en-IN", { month: "short" })}
                      </span>
                      <span>
                        <Link to={`/drives/${drive.id}`} className="cz-feed-row-link">
                          <strong>{drive.title}</strong>
                        </Link>
                        <small>
                          <CalendarDays aria-hidden="true" />
                          {formatDate(drive.startsAt, {
                            year: undefined,
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </small>
                        <small>
                          <Users aria-hidden="true" />
                          {drive.rsvpCount ?? 0} of {drive.capacity ?? "—"} going
                        </small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </FeedCard>

          {canWatch && (
            <FeedCard
              icon={LocateFixed}
              title={FEATURES.watchZones}
              to="/watch-zones"
              linkLabel="Manage"
            >
              {zones == null ? (
                <span className="skeleton cz-feed-skeleton" aria-hidden="true" />
              ) : zones.length === 0 ? (
                <FeedEmpty
                  action={
                    <Link to="/watch-zones" className="btn btn-secondary btn-sm">
                      <LocateFixed aria-hidden="true" />
                      Set up a zone
                    </Link>
                  }
                >
                  Circle your street, school run or office and get an
                  alert whenever a new case lands inside it.
                </FeedEmpty>
              ) : (
                <>
                  <p className="cz-zone-total">
                    <strong>{formatNumber(zoneOpenTotal)}</strong> open{" "}
                    {zoneOpenTotal === 1 ? "case" : "cases"} across{" "}
                    {zones.length} {zones.length === 1 ? "zone" : "zones"}
                  </p>
                  <ul className="cz-feed-list">
                    {zones.slice(0, 3).map((zone) => (
                      <li key={zone.id} className="cz-zone">
                        <strong>{zone.name}</strong>
                        <small>{formatNumber(zone.radiusM)} m radius</small>
                        <span
                          className={`chip ${zone.openIssues ? "chip-warning" : "chip-success"}`}
                        >
                          {zone.openIssues || 0} open
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </FeedCard>
          )}
        </div>
      </section>
        </div>

        <aside className="card cz-cred" aria-labelledby="cred-title">
          <p className="eyebrow">{FEATURES.civicCred}</p>

          <div className="cz-cred-score">
            <strong id="cred-title">
              {formatNumber(points)}
              <span> points</span>
            </strong>
            {myRank > 0 && (
              <span className="chip chip-accent">
                <Trophy aria-hidden="true" />#{myRank}
              </span>
            )}
          </div>

          <p className="cz-cred-note">
            Earn points for reports that get fixed, for signing off fixes
            and for backing your neighbours.
          </p>

          {badges.length > 0 && (
            <div className="cz-cred-block">
              <h3>
                Badges <span>{earnedCount} of {badges.length}</span>
              </h3>
              <BadgeGrid badges={badges} compact />
            </div>
          )}

          {leaderboard.length > 0 && (
            <div className="cz-cred-block">
              <h3>Top reporters</h3>
              <ol className="cz-board">
                {leaderboard.slice(0, 5).map((entry, index) => {
                  const isMe = entry.id === user?.id;

                  return (
                    <li key={entry.id} className={isMe ? "is-me" : ""}>
                      <span className="cz-board-rank">{index + 1}</span>
                      <Avatar user={entry} size={28} />
                      <span className="cz-board-name">
                        {entry.name}
                        {isMe && <em> (you)</em>}
                        <small>
                          {entry._count?.complaints || 0} reports
                        </small>
                      </span>
                      <strong className="cz-board-points">
                        {formatNumber(entry.points)}
                      </strong>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
