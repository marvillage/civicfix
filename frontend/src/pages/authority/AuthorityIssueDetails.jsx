import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  CircleCheck,
  ClipboardCheck,
  ExternalLink,
  HardHat,
  MapPin,
  MessageSquarePlus,
  Mic,
  Play,
  Radar,
  Recycle,
  RotateCcw,
  Siren,
  ThumbsUp,
  Users,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import CommentsSection from "../../components/CommentsSection";
import CostLedger from "../../components/CostLedger";
import IssueChat from "../../components/IssueChat";
import PhotoGallery from "../../components/PhotoGallery";
import { Meter } from "../../components/charts";
import {
  CategoryChip,
  Loading,
  PageHeader,
  SectionHeader,
  Segmented,
  SeverityBadge,
  StatusBadge,
} from "../../components/ui";
import { formatDate, formatDateTime, formatNumber, timeAgo } from "../../lib/format";
import {
  BackLink,
  CaseTimeline,
  FixClockChip,
  FixClockPanel,
  PhotoPicker,
} from "../CaseKit";
import { currentAssignment, fixClock, useNow } from "../caseUtils";

// History entry with `status` (latest by default, or the first one),
// optionally only after `after`.
function historyAt(history, status, after, { first = false } = {}) {
  const floor = after ? new Date(after).getTime() : -Infinity;
  const list = first ? [...(history ?? [])] : [...(history ?? [])].reverse();

  return list.find(
    (entry) =>
      entry.status === status && new Date(entry.createdAt).getTime() >= floor
  );
}

function stageCopy({ assignment, status, isMine, reopenNote }) {
  if (!assignment) {
    return {
      title: "Not assigned yet",
      text: "An admin hasn't dispatched this case to an officer.",
    };
  }

  if (status === "CLOSED") {
    return {
      title: "Signed off. Job closed.",
      text: "The citizen confirmed the fix. Nice work.",
    };
  }

  if (assignment.completedAt || status === "RESOLVED") {
    return {
      title: `Resolved. Waiting for ${FEATURES.signOff}.`,
      text: "The citizen compares your proof photo with their report, then signs off or reopens.",
    };
  }

  if (!assignment.acceptedAt) {
    return {
      title: isMine ? "New job: accept it to get going" : "Waiting for the officer to accept",
      text: "Accepting tells the citizen someone is on it.",
    };
  }

  if (status === "REOPENED") {
    return {
      title: "Reopened by the citizen",
      text: reopenNote
        ? `“${reopenNote}”`
        : "The citizen says it isn't fixed yet. Start work again when the crew is back on site.",
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      title: "On site",
      text: `Keep the citizen posted with ${FEATURES.siteUpdates}, then resolve with a proof photo.`,
    };
  }

  if (status === "ESCALATED" || status === "SLA_BREACHED") {
    return {
      title: `Past the ${FEATURES.fixClock}`,
      text: "This case was escalated. An admin will review it; message the citizen on the Direct Line if you need access.",
    };
  }

  return {
    title: "Accepted. Start when you're on site.",
    text: "Starting work moves the case to In progress for everyone watching it.",
  };
}

export default function AuthorityIssueDetails() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const now = useNow(30_000);

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  const [workTab, setWorkTab] = useState("update");
  const [progressNote, setProgressNote] = useState("");
  const [progressPhotos, setProgressPhotos] = useState([]);
  const [postingProgress, setPostingProgress] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveProof, setResolveProof] = useState([]);

  // Bumped after every Job Flow action to refetch the case.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return undefined;

    let cancelled = false;

    async function fetchIssue() {
      try {
        const response = await api.get(`/issues/${id}`);

        if (cancelled) return;

        setError("");
        setIssue(response.data.issue);
      } catch (fetchError) {
        console.error("Fetch issue error:", fetchError);

        if (!cancelled) {
          setError(
            fetchError.response?.data?.message || "Unable to load this case."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchIssue();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const latest = currentAssignment(issue);
  const assignment =
    issue?.assignments?.find(
      (item) => item.authorityId === user?.id && !item.completedAt
    ) ?? latest;
  const isMine = !!assignment && assignment.authorityId === user?.id;

  async function performAssignmentAction(action, successMessage, body) {
    if (!assignment) {
      setActionError("No assignment found for this case.");
      return false;
    }

    setActionLoading(true);
    setActionError("");
    setSuccess("");

    try {
      const response = await api.patch(
        `/assignments/${assignment.id}/${action}`,
        body
      );

      setSuccess(response.data.message || successMessage);
      setReloadKey((key) => key + 1);

      return true;
    } catch (actionFailure) {
      console.error(`${action} assignment error:`, actionFailure);

      setActionError(
        actionFailure.response?.data?.message ||
          `Unable to ${action} this job.`
      );

      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleProgressUpdate(event) {
    event.preventDefault();

    if (!assignment || !progressNote.trim()) return;

    setPostingProgress(true);
    setActionError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("note", progressNote.trim());

    if (progressPhotos[0]) {
      formData.append("photo", progressPhotos[0]);
    }

    try {
      await api.post(`/assignments/${assignment.id}/progress`, formData);

      setSuccess("Site update posted. The citizen has been notified.");
      setProgressNote("");
      setProgressPhotos([]);

      setReloadKey((key) => key + 1);
    } catch (progressError) {
      setActionError(
        progressError.response?.data?.message ||
          "Unable to post the site update."
      );
    } finally {
      setPostingProgress(false);
    }
  }

  async function handleResolve(event) {
    event.preventDefault();

    const formData = new FormData();

    if (resolveNote.trim()) {
      formData.append("note", resolveNote.trim());
    }

    if (resolveProof[0]) {
      formData.append("proof", resolveProof[0]);
    }

    const done = await performAssignmentAction(
      "resolve",
      "Marked resolved. The citizen has been asked to sign off.",
      formData
    );

    if (done) {
      setResolveNote("");
      setResolveProof([]);
    }
  }

  if (loading) {
    return <Loading label="Opening the Case File…" />;
  }

  if (error || !issue) {
    return (
      <div className="page">
        <BackLink to="/authority">{FEATURES.crewQueue}</BackLink>
        <PageHeader eyebrow={FEATURES.caseFile} title="Case not found" />
        <div className="form-error">{error || "This case doesn't exist."}</div>
      </div>
    );
  }

  const status = issue.status;
  const history = issue.statusHistory ?? [];
  const isAccepted = !!assignment?.acceptedAt;
  const isCompleted = !!assignment?.completedAt;

  const canAccept = isMine && !isAccepted && !isCompleted;
  const canStart =
    isMine &&
    isAccepted &&
    !isCompleted &&
    (status === "ACKNOWLEDGED" || status === "REOPENED");
  const canWork =
    isMine && isAccepted && !isCompleted && status === "IN_PROGRESS";

  const reopened = historyAt(history, "REOPENED");
  const startedAt = historyAt(history, "IN_PROGRESS", reopened?.createdAt, {
    first: true,
  });
  const resolvedAt =
    assignment?.completedAt ??
    historyAt(history, "RESOLVED", reopened?.createdAt)?.createdAt;

  const steps = [
    { label: "Assigned", at: assignment?.assignedAt, icon: ClipboardCheck },
    { label: "Accepted", at: assignment?.acceptedAt, icon: Check },
    { label: "On site", at: startedAt?.createdAt, icon: HardHat },
    { label: "Resolved", at: resolvedAt, icon: CircleCheck },
    {
      label: FEATURES.signOff,
      at: status === "CLOSED" ? historyAt(history, "CLOSED")?.createdAt : null,
      icon: BadgeCheck,
    },
  ];
  const currentStep = steps.findIndex((step) => !step.at);

  const stage = stageCopy({
    assignment,
    status,
    isMine,
    reopenNote: status === "REOPENED" ? reopened?.note : null,
  });

  const clock = fixClock(
    {
      sla: issue.sla,
      status,
      createdAt: issue.createdAt,
      done: isCompleted,
    },
    now
  );

  const photos = (issue.complaints ?? []).flatMap((complaint) =>
    complaint.photos?.length
      ? complaint.photos
      : [complaint.imageUrl].filter(Boolean)
  );
  const voiceNotes = (issue.complaints ?? []).filter(
    (complaint) => complaint.audioUrl
  );
  const reportCount = issue._count?.complaints ?? issue.complaints?.length ?? 0;
  const confidence =
    issue.aiConfidence != null ? Math.round(issue.aiConfidence * 100) : null;

  const canLogCosts = can("cost:log") && latest?.authorityId === user?.id;
  const canReadCosts = can("cost:read") || canLogCosts;
  const hasCoords = issue.latitude != null && issue.longitude != null;

  return (
    <div className="page case-file job-file">
      <BackLink to="/authority">{FEATURES.crewQueue}</BackLink>

      <PageHeader eyebrow={FEATURES.caseFile} title={issue.title || "Untitled case"}>
        <div className="case-head-meta">
          <StatusBadge status={status} />
          {issue.isEmergency && (
            <span className="red-alert">
              <Siren aria-hidden="true" />
              {FEATURES.redAlert}
            </span>
          )}
          {issue.category && <CategoryChip category={issue.category} />}
          <SeverityBadge severity={issue.severity} />
          {(issue.reopenCount || 0) >= 2 && (
            <span className="chip chip-warning">
              <Recycle aria-hidden="true" />
              Reopened {issue.reopenCount}×
            </span>
          )}
          <span className="case-head-when">
            <CalendarDays aria-hidden="true" />
            Reported {formatDate(issue.createdAt)} · {timeAgo(issue.createdAt, now)}
          </span>
        </div>
      </PageHeader>

      {success && (
        <div className="form-success" role="status">
          {success}
        </div>
      )}

      {actionError && (
        <div className="form-error" role="alert">
          {actionError}
        </div>
      )}

      <section
        className={`card jobflow ${status === "REOPENED" ? "is-reopened" : ""}`}
        aria-labelledby="jobflow-title"
      >
        <div className="jobflow-head">
          <div>
            <p className="eyebrow">{FEATURES.jobFlow}</p>
            <h2 id="jobflow-title">{stage.title}</h2>
            <p className="jobflow-text">{stage.text}</p>
          </div>
          {clock && <FixClockChip clock={clock} long />}
        </div>

        {assignment && (
          <ol className="jobflow-steps">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const state = step.at
                ? "is-done"
                : index === currentStep
                  ? "is-current"
                  : "";

              return (
                <li
                  key={step.label}
                  className={`jobflow-step ${state}`}
                  aria-current={index === currentStep ? "step" : undefined}
                >
                  <span className="jobflow-dot" aria-hidden="true">
                    {step.at ? <Check /> : <Icon />}
                  </span>
                  <span className="jobflow-label">
                    <strong>{step.label}</strong>
                    <small>
                      {step.at
                        ? formatDateTime(step.at)
                        : index === currentStep
                          ? "Up next"
                          : "Not yet"}
                    </small>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {canAccept && (
          <div className="jobflow-action">
            <button
              type="button"
              className="btn-accent btn-lg"
              onClick={() =>
                performAssignmentAction(
                  "accept",
                  "Job accepted. The citizen knows you're on it."
                )
              }
              disabled={actionLoading}
            >
              {actionLoading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Check aria-hidden="true" />
              )}
              {actionLoading ? "Accepting…" : "Accept job"}
            </button>
          </div>
        )}

        {canStart && (
          <div className="jobflow-action">
            <button
              type="button"
              className="btn-accent btn-lg"
              onClick={() =>
                performAssignmentAction(
                  "start",
                  "Work started. The case is now In progress."
                )
              }
              disabled={actionLoading}
            >
              {actionLoading ? (
                <span className="spinner" aria-hidden="true" />
              ) : status === "REOPENED" ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" />
              )}
              {actionLoading
                ? "Starting…"
                : status === "REOPENED"
                  ? "Restart work"
                  : "Start work"}
            </button>
          </div>
        )}

        {canWork && (
          <div className="jobflow-work">
            <Segmented
              label="What are you doing?"
              value={workTab}
              onChange={setWorkTab}
              options={[
                { value: "update", label: "Post a site update", icon: MessageSquarePlus },
                { value: "resolve", label: "Mark resolved", icon: CircleCheck },
              ]}
            />

            {workTab === "update" ? (
              <form onSubmit={handleProgressUpdate} className="jobflow-form">
                <div className="field">
                  <label htmlFor="progress-note">What happened on site?</label>
                  <textarea
                    id="progress-note"
                    value={progressNote}
                    onChange={(event) => setProgressNote(event.target.value)}
                    placeholder="e.g. Material delivered. Patching starts tomorrow at 7 am."
                    rows={3}
                    disabled={postingProgress}
                  />
                  <span className="field-hint">
                    The citizen and everyone backing this case get it as an alert.
                  </span>
                </div>

                <div className="field">
                  <span className="jobflow-label-text">Photo (optional)</span>
                  <PhotoPicker
                    id="progress-photo"
                    files={progressPhotos}
                    onChange={setProgressPhotos}
                    max={1}
                    label="Add a site photo"
                  />
                </div>

                <div className="button-row">
                  <button
                    type="submit"
                    disabled={postingProgress || !progressNote.trim()}
                  >
                    {postingProgress ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <MessageSquarePlus aria-hidden="true" />
                    )}
                    {postingProgress ? "Posting…" : "Post update"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResolve} className="jobflow-form">
                <div className="field">
                  <label htmlFor="resolve-note">What did the crew do?</label>
                  <textarea
                    id="resolve-note"
                    value={resolveNote}
                    onChange={(event) => setResolveNote(event.target.value)}
                    placeholder="e.g. Relaid 14 slabs on a fresh sand bed and levelled the edge."
                    rows={3}
                    disabled={actionLoading}
                  />
                </div>

                <div className="field">
                  <span className="jobflow-label-text">Proof photo</span>
                  <PhotoPicker
                    id="resolve-proof"
                    files={resolveProof}
                    onChange={setResolveProof}
                    max={1}
                    label="Photo of the finished work"
                  />
                  {!resolveProof.length && (
                    <span className="field-hint">
                      Take it from the same angle as the citizen's photo.
                      Cases with proof get signed off faster.
                    </span>
                  )}
                </div>

                <div className="button-row">
                  <button
                    type="submit"
                    className="btn-accent"
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <CircleCheck aria-hidden="true" />
                    )}
                    {actionLoading ? "Resolving…" : "Mark resolved"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {assignment && !isMine && !isCompleted && (
          <p className="jobflow-note">
            <AlertTriangle aria-hidden="true" />
            This job belongs to {assignment.authority?.name ?? "another officer"}.
            Only they can move it along.
          </p>
        )}
      </section>

      <div className="grid-main-side case-layout">
        <div className="case-main">
          <section className="card" aria-labelledby="evidence-title">
            <SectionHeader
              eyebrow="Reported"
              title={<span id="evidence-title">What the citizen sent</span>}
              description={
                reportCount > 1
                  ? `${reportCount} reports were merged into this case.`
                  : undefined
              }
            />

            <div className="case-evidence">
              <PhotoGallery photos={photos} alt={issue.title} />

              <p className="case-description">
                {issue.description || "No description added."}
              </p>

              {voiceNotes.map((complaint, index) => (
                <div key={complaint.id ?? index} className="case-voice">
                  <span>
                    <Mic aria-hidden="true" />
                    Voice note{voiceNotes.length > 1 ? ` ${index + 1}` : ""}
                  </span>
                  <audio controls src={complaint.audioUrl} preload="none" />
                </div>
              ))}
            </div>
          </section>

          {canReadCosts && <CostLedger issueId={issue.id} canLog={canLogCosts} />}

          <section className="card case-history" aria-labelledby="timeline-title">
            <SectionHeader
              eyebrow={FEATURES.siteUpdates}
              title={<span id="timeline-title">Case timeline</span>}
              description="Status changes and site updates, oldest first. Citizens see the same."
            />
            <CaseTimeline history={history} />

            {issue.resolutionImageUrl && (
              <figure className="job-proof">
                <img
                  src={issue.resolutionImageUrl}
                  alt="Proof photo of the completed work"
                />
                <figcaption>
                  <span className="chip chip-success">Proof</span>
                  Photo attached when the job was resolved
                </figcaption>
              </figure>
            )}
          </section>

          <div className="case-threads">
            <IssueChat issueId={issue.id} />
            <CommentsSection issueId={issue.id} />
          </div>
        </div>

        <aside className="case-side">
          <FixClockPanel clock={clock} />

          <section className="card case-side-card" aria-labelledby="assign-title">
            <h2 id="assign-title" className="case-side-title">
              Assignment
            </h2>
            {assignment ? (
              <dl className="case-facts">
                <div>
                  <dt>
                    <HardHat aria-hidden="true" />
                    Officer
                  </dt>
                  <dd>
                    {isMine ? "You" : (assignment.authority?.name ?? "—")}
                    {assignment.assignedAt && (
                      <small>Assigned {timeAgo(assignment.assignedAt, now)}</small>
                    )}
                  </dd>
                </div>
                {(assignment.department ?? issue.department) && (
                  <div>
                    <dt>
                      <Building2 aria-hidden="true" />
                      Department
                    </dt>
                    <dd>{(assignment.department ?? issue.department).name}</dd>
                  </div>
                )}
                {(assignment.ward ?? issue.ward) && (
                  <div>
                    <dt>
                      <MapPin aria-hidden="true" />
                      Ward
                    </dt>
                    <dd>
                      {(assignment.ward ?? issue.ward).name}
                      {(assignment.ward ?? issue.ward).code
                        ? ` (${(assignment.ward ?? issue.ward).code})`
                        : ""}
                    </dd>
                  </div>
                )}
                {issue.sla?.durationMin != null && (
                  <div>
                    <dt>
                      <CalendarDays aria-hidden="true" />
                      Fix window
                    </dt>
                    <dd>
                      {issue.sla.durationMin >= 1440
                        ? `${Math.round(issue.sla.durationMin / 144) / 10} days`
                        : `${Math.round(issue.sla.durationMin / 6) / 10} hours`}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="case-side-note">Not dispatched yet.</p>
            )}
          </section>

          <section className="card case-side-card" aria-labelledby="place-title">
            <h2 id="place-title" className="case-side-title">
              Location
            </h2>
            <p className="case-address">
              <MapPin aria-hidden="true" />
              {issue.address || "Address unavailable"}
            </p>
            {hasCoords && (
              <p className="case-coords mono">
                {Number(issue.latitude).toFixed(5)}, {Number(issue.longitude).toFixed(5)}
              </p>
            )}
            <div className="case-links">
              {hasCoords && (
                <a
                  href={`https://www.openstreetmap.org/directions?to=${issue.latitude}%2C${issue.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink aria-hidden="true" />
                  Directions
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <Link to={`/issues/${issue.id}`} className="btn btn-ghost btn-sm">
                <Radar aria-hidden="true" />
                Public page
              </Link>
            </div>
          </section>

          <section className="card case-side-card" aria-labelledby="facts-title">
            <h2 id="facts-title" className="case-side-title">
              Case facts
            </h2>
            <dl className="case-facts">
              <div>
                <dt>
                  <Users aria-hidden="true" />
                  Reports
                </dt>
                <dd>{formatNumber(reportCount)}</dd>
              </div>
              <div>
                <dt>
                  <ThumbsUp aria-hidden="true" />
                  Backers
                </dt>
                <dd>{formatNumber(issue._count?.upvotes ?? 0)}</dd>
              </div>
            </dl>
            {confidence != null && (
              <Meter
                label={`${FEATURES.autoSort} confidence`}
                value={confidence}
                thresholds={[50, 75]}
              />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
