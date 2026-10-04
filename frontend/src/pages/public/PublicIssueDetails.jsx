import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  CircleCheck,
  Clock,
  Copy,
  FileText,
  HardHat,
  ImageOff,
  MapIcon,
  MapPin,
  MessageCircle,
  SearchX,
  Share2,
  Siren,
  Sparkles,
  ThumbsUp,
  Timer,
  Users,
} from "lucide-react";
import api, { issueShareUrl } from "../../api/axios";
import { BRAND, FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import CommentsSection from "../../components/CommentsSection";
import IssueMap from "../../components/IssueMap";
import PhotoGallery from "../../components/PhotoGallery";
import {
  ChronicBadge,
  EmergencyBanner,
  ExpectedFix,
  VoiceNotes,
} from "../../components/IssueExtras";
import {
  Avatar,
  CategoryChip,
  EmptyState,
  Loading,
  SectionHeader,
  SeverityBadge,
  StatusBadge,
} from "../../components/ui";
import { CATEGORY_META, STATUS_LABEL } from "../../lib/labels";
import {
  formatDateTime,
  formatHours,
  formatNumber,
  timeAgo,
} from "../../lib/format";

const FIXED = ["RESOLVED", "CITIZEN_VERIFICATION", "CLOSED"];
const NO_BACKING = ["CLOSED", "DUPLICATE"];
const BACK_IDLE = { id: null, backed: false, note: "", error: "" };

function byTime(a, b) {
  return new Date(a.createdAt) - new Date(b.createdAt);
}

export default function PublicIssueDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, can } = useAuth();

  const [result, setResult] = useState({ id: null, issue: null, error: "" });
  const [backing, setBacking] = useState(false);
  const [back, setBack] = useState(BACK_IDLE);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState("");

  // The case on screen and the case in the URL can differ while a
  // new one loads; everything below is derived from that.
  const loading = result.id !== id;
  const issue = loading ? null : result.issue;
  const error = loading ? "" : result.error;
  const { backed, note: backNote, error: backError } =
    back.id === id ? back : BACK_IDLE;

  // Stable array so the mini map doesn't refit on every render.
  const mapIssues = useMemo(() => (issue ? [issue] : []), [issue]);

  useEffect(() => {
    let cancelled = false;

    api
      .get(`/issues/${id}`)
      .then((response) => {
        if (!cancelled) {
          setResult({ id, issue: response.data.issue || response.data, error: "" });
        }
      })
      .catch((fetchError) => {
        console.error("Fetch Case File error:", fetchError);

        if (!cancelled) {
          setResult({
            id,
            issue: null,
            error:
              fetchError.response?.status === 404
                ? "This case doesn't exist, or it was merged into another one."
                : fetchError.response?.data?.message ||
                  "Couldn't open this case. Try again in a moment.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleBack() {
    setBack(BACK_IDLE);

    if (!isAuthenticated) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }

    setBacking(true);

    try {
      await api.post(`/issues/${id}/upvote`);

      setBack({
        id,
        backed: true,
        note: "You're backing this case. Updates will reach you.",
        error: "",
      });
      setResult((current) =>
        current.id !== id || !current.issue
          ? current
          : {
              ...current,
              issue: {
                ...current.issue,
                _count: {
                  ...current.issue._count,
                  upvotes: (current.issue._count?.upvotes || 0) + 1,
                },
              },
            }
      );
    } catch (backErr) {
      const statusCode = backErr.response?.status;

      if (statusCode === 409) {
        setBack({ id, backed: true, note: "You already back this case.", error: "" });
      } else if (statusCode === 401) {
        navigate("/login", { state: { from: location.pathname } });
      } else {
        setBack({
          id,
          backed: false,
          note: "",
          error: backErr.response?.data?.message || "Couldn't back this case.",
        });
      }
    } finally {
      setBacking(false);
    }
  }

  if (loading) {
    return <Loading label={`Opening the ${FEATURES.caseFile}…`} />;
  }

  if (error || !issue) {
    return (
      <div className="page">
        <EmptyState
          icon={SearchX}
          title="Case not found"
          action={
            <Link to="/issues" className="btn btn-secondary">
              <ArrowLeft aria-hidden="true" />
              Back to {FEATURES.radar}
            </Link>
          }
        >
          {error || "This case doesn't exist."}
        </EmptyState>
      </div>
    );
  }

  const complaints = issue.complaints || [];
  const photos = complaints.flatMap((complaint) =>
    complaint.photos?.length ? complaint.photos : [complaint.imageUrl]
  );
  const history = [...(issue.statusHistory || [])].sort(byTime);
  const assignment = [...(issue.assignments || [])].sort(
    (a, b) => new Date(b.assignedAt) - new Date(a.assignedAt)
  )[0];
  const backers = issue._count?.upvotes ?? 0;
  const reports = issue._count?.complaints ?? complaints.length;
  const ref = `#${String(issue.id).slice(-6).toUpperCase()}`;
  const fixed = FIXED.includes(issue.status);
  const resolvedAt = history.find((h) => h.status === "RESOLVED")?.createdAt;
  const fixHours = resolvedAt
    ? (new Date(resolvedAt) - new Date(issue.createdAt)) / 3600000
    : null;
  const metDeadline =
    resolvedAt && issue.sla?.deadline
      ? new Date(resolvedAt) <= new Date(issue.sla.deadline)
      : null;
  const categoryLabel =
    CATEGORY_META[issue.category]?.label ?? CATEGORY_META.OTHER.label;

  const shareUrl = issueShareUrl(issue.id);
  const shareText = `${issue.title}: a public case on ${BRAND.name}. Back it so it gets fixed.`;
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyFallback("");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFallback(shareUrl);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: issue.title, text: shareText, url: shareUrl });
    } catch {
      // Dismissed: nothing to do.
    }
  }

  return (
    <div className="page casefile">
      <div className="casefile-top">
        <Link to="/issues" className="btn btn-ghost btn-sm casefile-back-link">
          <ArrowLeft aria-hidden="true" />
          {FEATURES.radar}
        </Link>
      </div>

      <header className="casefile-head">
        <div className="casefile-tags">
          <span className="casefile-ref">
            <FileText aria-hidden="true" />
            {FEATURES.caseFile} {ref}
          </span>
          <StatusBadge status={issue.status} />
          <SeverityBadge severity={issue.severity} />
          {issue.category && <CategoryChip category={issue.category} />}
          {issue.isEmergency && (
            <span className="red-alert">
              <Siren aria-hidden="true" />
              {FEATURES.redAlert}
            </span>
          )}
          <ChronicBadge issue={issue} />
        </div>

        <h1>{issue.title || "Untitled case"}</h1>

        <div className="meta-row casefile-meta">
          <span title={formatDateTime(issue.createdAt)}>
            <Clock aria-hidden="true" />
            Reported {timeAgo(issue.createdAt)}
          </span>
          {issue.address && (
            <span>
              <MapPin aria-hidden="true" />
              {issue.address}
            </span>
          )}
          {issue.ward?.name && (
            <span>
              <Building2 aria-hidden="true" />
              {issue.ward.name}
              {issue.ward.code ? ` (${issue.ward.code})` : ""}
            </span>
          )}
        </div>
      </header>

      <EmergencyBanner issue={issue} />

      <div className="grid-main-side casefile-grid">
        <div className="stack casefile-main">
          {photos.filter(Boolean).length > 0 ? (
            <PhotoGallery photos={photos} alt={issue.title} />
          ) : (
            <div className="casefile-nophoto">
              <ImageOff aria-hidden="true" />
              No photo was attached to this report.
            </div>
          )}

          <section className="card casefile-report">
            <SectionHeader eyebrow="The report" title="What's wrong" />

            <p className="casefile-desc">
              {issue.description || "No description was added."}
            </p>

            <VoiceNotes complaints={complaints} />

            <div className="details-grid casefile-facts">
              <Fact icon={Building2} label="Department">
                {issue.department?.name ||
                  assignment?.department?.name ||
                  "Not routed yet"}
              </Fact>
              <Fact icon={MapPin} label="Ward">
                {issue.ward?.name || "Unmapped"}
              </Fact>
              <Fact icon={Users} label={FEATURES.echoCheck}>
                {reports > 1
                  ? `${formatNumber(reports)} reports merged`
                  : "1 report"}
              </Fact>
              <Fact icon={ThumbsUp} label="Backers">
                {formatNumber(backers)}
              </Fact>
              <Fact icon={Sparkles} label={FEATURES.autoSort}>
                {issue.aiConfidence != null
                  ? `${categoryLabel} · ${Math.round(issue.aiConfidence * 100)}% sure`
                  : categoryLabel}
              </Fact>
              <Fact icon={Clock} label="Last update">
                <span title={formatDateTime(issue.updatedAt)}>
                  {timeAgo(issue.updatedAt || issue.createdAt)}
                </span>
              </Fact>
            </div>
          </section>

          {issue.resolutionImageUrl && (
            <section className="card casefile-proofcard">
              <SectionHeader
                eyebrow="Proof of fix"
                title="Before and after"
                description="The crew's photo of the finished work, next to the original report."
              />

              <div className="casefile-proof">
                {photos[0] && (
                  <figure>
                    <img src={photos[0]} alt={`Before: ${issue.title}`} loading="lazy" />
                    <figcaption>Before</figcaption>
                  </figure>
                )}
                <figure>
                  <img
                    src={issue.resolutionImageUrl}
                    alt={`After: completed work on ${issue.title}`}
                    loading="lazy"
                  />
                  <figcaption className="is-after">After</figcaption>
                </figure>
              </div>
            </section>
          )}

          <section className="card casefile-history">
            <SectionHeader
              eyebrow="Timeline"
              title="How this case has moved"
            />

            {history.length === 0 ? (
              <p className="empty-inline">No updates recorded yet.</p>
            ) : (
              <ol className="timeline casefile-timeline">
                {history.map((entry, index) => {
                  const last = index === history.length - 1;

                  return (
                    <li
                      key={entry.id ?? index}
                      className={`timeline-item ${last ? "timeline-item-last" : ""}`}
                    >
                      <span className="timeline-marker" aria-hidden="true" />

                      <div className="timeline-content">
                        <div className="timeline-title-row">
                          <strong>
                            {STATUS_LABEL[entry.status] ?? entry.status}
                          </strong>
                          {last && <span className="timeline-current">Now</span>}
                        </div>

                        {entry.note && <p>{entry.note}</p>}

                        {entry.imageUrl && (
                          <img
                            className="timeline-photo"
                            src={entry.imageUrl}
                            alt={`Photo from the ${STATUS_LABEL[entry.status] ?? "status"} update`}
                            loading="lazy"
                          />
                        )}

                        <time
                          dateTime={entry.createdAt}
                          title={formatDateTime(entry.createdAt)}
                        >
                          {formatDateTime(entry.createdAt)} ·{" "}
                          {timeAgo(entry.createdAt)}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <CommentsSection issueId={issue.id} />
        </div>

        <aside className="stack casefile-side" aria-label="Case actions">
          <section className="card casefile-backit">
            <p className="eyebrow">{FEATURES.backIt}</p>

            <div className="casefile-backers">
              <strong>{formatNumber(backers)}</strong>
              <span>{backers === 1 ? "backer" : "backers"}</span>
            </div>

            <p className="casefile-side-text">
              Backing pushes the case up the crew's queue and sends you
              every update until it's signed off.
            </p>

            {!NO_BACKING.includes(issue.status) &&
              (!isAuthenticated || can("issue:upvote")) && (
                <button
                  type="button"
                  className={`btn-block btn-lg ${backed ? "btn-secondary" : "btn-accent"}`}
                  onClick={handleBack}
                  disabled={backing || backed}
                >
                  {backed ? (
                    <Check aria-hidden="true" />
                  ) : backing ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <ThumbsUp aria-hidden="true" />
                  )}
                  {backed ? "You back this" : backing ? "Backing…" : "Back it"}
                </button>
              )}

            {!isAuthenticated && (
              <p className="field-hint">You'll log in first. It takes a minute.</p>
            )}

            {backNote && (
              <p className="form-success casefile-note" role="status">
                {backNote}
              </p>
            )}

            {backError && (
              <p className="form-error casefile-note" role="alert">
                {backError}
              </p>
            )}
          </section>

          <section className="card casefile-clock">
            <SectionHeader eyebrow={FEATURES.fixClock} title="Deadline" />

            {fixed ? (
              <div className="casefile-fixed">
                <span className="casefile-fixed-icon" aria-hidden="true">
                  <CircleCheck />
                </span>
                <div>
                  <strong>
                    {fixHours != null
                      ? `Fixed in ${formatHours(fixHours)}`
                      : "Fix delivered"}
                  </strong>
                  {metDeadline != null && (
                    <span className={metDeadline ? "text-success" : "text-danger"}>
                      {metDeadline
                        ? `Inside the ${FEATURES.fixClock}`
                        : `Missed the ${FEATURES.fixClock}`}
                    </span>
                  )}
                  {issue.status === "CITIZEN_VERIFICATION" && (
                    <span>Waiting for the reporter's {FEATURES.signOff}.</span>
                  )}
                </div>
              </div>
            ) : issue.sla ? (
              <>
                <ExpectedFix issue={issue} bare />
                {issue.sla.durationMin && (
                  <p className="casefile-side-text">
                    {issue.severity
                      ? `${issue.severity.charAt(0)}${issue.severity.slice(1).toLowerCase()} severity cases`
                      : "Cases like this"}{" "}
                    get {formatHours(issue.sla.durationMin / 60)}. Miss it and
                    the case escalates automatically.
                  </p>
                )}
              </>
            ) : (
              <p className="casefile-side-text">
                <Timer aria-hidden="true" className="inline-icon" />
                The clock starts when the case is routed to a crew.
              </p>
            )}
          </section>

          <section className="card casefile-crewcard">
            <SectionHeader eyebrow={FEATURES.jobFlow} title="Who's on it" />

            {assignment ? (
              <div className="casefile-crew">
                <div className="casefile-officer">
                  <Avatar user={assignment.authority} size={40} />
                  <div>
                    <strong>{assignment.authority?.name || "Assigned officer"}</strong>
                    <span>
                      {assignment.department?.name ||
                        issue.department?.name ||
                        "Municipal crew"}
                    </span>
                  </div>
                </div>

                <ol className="casefile-steps">
                  <Step done label="Assigned" at={assignment.assignedAt} />
                  <Step
                    done={!!assignment.acceptedAt}
                    label="Accepted"
                    at={assignment.acceptedAt}
                  />
                  <Step
                    done={!!assignment.completedAt}
                    label="Work completed"
                    at={assignment.completedAt}
                  />
                </ol>
              </div>
            ) : (
              <p className="casefile-side-text">
                <HardHat aria-hidden="true" className="inline-icon" />
                No officer assigned yet. {FEATURES.autoSort} has routed it to{" "}
                {issue.department?.name || "the right department"}.
              </p>
            )}
          </section>

          <section className="card casefile-share">
            <SectionHeader eyebrow="Share" title="Get more backers" />

            <div className="casefile-share-buttons">
              <button type="button" className="btn-secondary" onClick={copyLink}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? "Link copied" : "Copy link"}
              </button>

              <a
                className="btn btn-secondary"
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                WhatsApp
              </a>

              <a
                className="btn btn-secondary"
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="casefile-x" aria-hidden="true">
                  𝕏
                </span>
                Post
              </a>

              {canNativeShare && (
                <button type="button" className="btn-secondary" onClick={nativeShare}>
                  <Share2 aria-hidden="true" />
                  More
                </button>
              )}
            </div>

            <p className="sr-only" role="status">
              {copied ? "Link copied to clipboard" : ""}
            </p>

            {copyFallback && (
              <label className="field casefile-copy-fallback">
                <span className="field-hint">Copy this link:</span>
                <input
                  type="text"
                  readOnly
                  value={copyFallback}
                  onFocus={(event) => event.target.select()}
                />
              </label>
            )}
          </section>

          {Number.isFinite(issue.latitude) && Number.isFinite(issue.longitude) && (
            <section className="card card-flush casefile-map">
              <IssueMap
                issues={mapIssues}
                height={220}
                label={`Location of ${issue.title}`}
              />
              <div className="casefile-map-foot">
                <span>
                  <MapPin aria-hidden="true" />
                  {issue.address || `${issue.latitude.toFixed(4)}, ${issue.longitude.toFixed(4)}`}
                </span>
                <Link to="/issues?view=map" className="text-link">
                  <MapIcon aria-hidden="true" className="inline-icon" />
                  {FEATURES.radar}
                </Link>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, children }) {
  return (
    <div className="detail-item casefile-fact">
      <span className="detail-label">
        <Icon aria-hidden="true" />
        {label}
      </span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

function Step({ done, label, at }) {
  return (
    <li className={done ? "is-done" : ""}>
      <span className="casefile-step-dot" aria-hidden="true">
        {done && <Check />}
      </span>
      <span>
        <strong>{label}</strong>
        {at ? (
          <time dateTime={at} title={formatDateTime(at)}>
            {timeAgo(at)}
          </time>
        ) : (
          <span className="muted">Not yet</span>
        )}
      </span>
    </li>
  );
}
