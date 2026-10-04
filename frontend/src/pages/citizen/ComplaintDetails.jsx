import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ExternalLink,
  HardHat,
  MapPin,
  Mic,
  Radar,
  Recycle,
  RotateCcw,
  Siren,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import CommentsSection from "../../components/CommentsSection";
import IssueChat from "../../components/IssueChat";
import PhotoGallery from "../../components/PhotoGallery";
import { Meter } from "../../components/charts";
import {
  CategoryChip,
  Loading,
  PageHeader,
  SectionHeader,
  SeverityBadge,
  StatusBadge,
} from "../../components/ui";
import { formatDate, formatDateTime, timeAgo } from "../../lib/format";
import {
  BackLink,
  CaseTimeline,
  FixClockPanel,
} from "../CaseKit";
import { currentAssignment, fixClock, useNow } from "../caseUtils";

const STAR_WORDS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

function StarRating({ value, onChange }) {
  return (
    <div className="star-rating" role="radiogroup" aria-label="Rate the fix">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? "s" : ""}, ${STAR_WORDS[star]}`}
          className={`star-button ${star <= value ? "is-on" : ""}`}
          onClick={() => onChange(star === value ? 0 : star)}
        >
          <Star aria-hidden="true" />
        </button>
      ))}
      <span className="star-word" aria-live="polite">
        {value ? STAR_WORDS[value] : "Tap to rate"}
      </span>
    </div>
  );
}

export default function ComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const now = useNow(60_000);

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const [approved, setApproved] = useState(null);
  const [note, setNote] = useState("");
  const [stars, setStars] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");

  // Bumped after a Sign-Off to refetch the case.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return undefined;

    let cancelled = false;

    async function fetchComplaint() {
      try {
        const response = await api.get(`/complaints/${id}`);

        if (cancelled) return;

        setError("");
        setComplaint(response.data.complaint);
      } catch (fetchError) {
        console.error("Fetch complaint error:", fetchError);

        if (!cancelled) {
          setError(
            fetchError.response?.data?.message || "Unable to load this case."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchComplaint();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function handleWithdraw() {
    if (!window.confirm("Withdraw this report? This cannot be undone.")) {
      return;
    }

    setWithdrawing(true);
    setWithdrawError("");

    try {
      await api.delete(`/complaints/${id}`);
      navigate("/citizen/complaints");
    } catch (withdrawFailure) {
      setWithdrawError(
        withdrawFailure.response?.data?.message ||
          "Unable to withdraw the report."
      );
      setWithdrawing(false);
    }
  }

  function chooseVerdict(value) {
    setApproved(value);
    setNote("");
    setVerificationError("");
    setVerificationSuccess("");
  }

  async function handleVerification(event) {
    event.preventDefault();

    if (approved === null) return;

    setVerifying(true);
    setVerificationError("");
    setVerificationSuccess("");

    try {
      const response = await api.patch(`/complaints/${id}/verify`, {
        approved,
        note,
        stars: approved && stars > 0 ? stars : undefined,
      });

      setVerificationSuccess(
        response.data.message ||
          (approved
            ? "Signed off. Thanks for closing the loop."
            : "Case reopened. The crew has been told why.")
      );
      setApproved(null);
      window.scrollTo({ top: 0, behavior: "smooth" });

      setReloadKey((key) => key + 1);
    } catch (verifyError) {
      console.error("Verification error:", verifyError);

      setVerificationError(
        verifyError.response?.data?.message || "Unable to update the case."
      );
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return <Loading label="Opening the Case File…" />;
  }

  if (error || !complaint) {
    return (
      <div className="page">
        <BackLink to="/citizen/complaints">{FEATURES.myCases}</BackLink>
        <PageHeader eyebrow={FEATURES.caseFile} title="Case not found" />
        <div className="form-error">{error || "This case doesn't exist."}</div>
      </div>
    );
  }

  const issue = complaint.issue ?? {};
  const assignment = currentAssignment(issue);
  const clock = fixClock(
    { sla: issue.sla, status: issue.status, createdAt: issue.createdAt },
    now
  );
  const photos = complaint.photos?.length
    ? complaint.photos
    : [complaint.imageUrl].filter(Boolean);
  const resolvedEntry = [...(issue.statusHistory ?? [])]
    .reverse()
    .find((entry) => entry.status === "RESOLVED");
  const canSignOff = issue.status === "RESOLVED";
  const canWithdraw =
    ["REPORTED", "AI_VERIFIED"].includes(issue.status) &&
    !issue.assignments?.some((item) => !item.completedAt);
  const confidence =
    issue.aiConfidence != null ? Math.round(issue.aiConfidence * 100) : null;
  const lat = complaint.latitude ?? issue.latitude;
  const lng = complaint.longitude ?? issue.longitude;

  return (
    <div className="page case-file">
      <BackLink to="/citizen/complaints">{FEATURES.myCases}</BackLink>

      <PageHeader eyebrow={FEATURES.caseFile} title={issue.title || "Untitled case"}>
        <div className="case-head-meta">
          <StatusBadge status={issue.status} />
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
            Reported {formatDate(complaint.createdAt)} ·{" "}
            {timeAgo(complaint.createdAt, now)}
          </span>
        </div>
      </PageHeader>

      {verificationSuccess && (
        <div className="form-success" role="status">
          {verificationSuccess}
        </div>
      )}

      {canSignOff && (
        <section className="card signoff" aria-labelledby="signoff-title">
          <div className="signoff-intro">
            <p className="eyebrow">{FEATURES.signOff}</p>
            <h2 id="signoff-title">Is it really fixed?</h2>
            <p>
              {assignment?.authority?.name ?? "The crew"} marked this case
              resolved
              {resolvedEntry ? ` ${timeAgo(resolvedEntry.createdAt, now)}` : ""}
              . Check the spot, compare the photos, then sign it off or send
              it back.
            </p>
            {resolvedEntry?.note && (
              <blockquote className="signoff-note">
                “{resolvedEntry.note}”
              </blockquote>
            )}
          </div>

          <div
            className={`signoff-compare ${issue.resolutionImageUrl ? "" : "is-single"}`}
          >
            {complaint.imageUrl && (
              <figure>
                <img
                  src={complaint.imageUrl}
                  alt="The problem as you reported it"
                />
                <figcaption>
                  <span className="chip chip-outline">Before</span>
                  Your report · {formatDate(complaint.createdAt, { year: undefined })}
                </figcaption>
              </figure>
            )}

            {issue.resolutionImageUrl ? (
              <figure>
                <img
                  src={issue.resolutionImageUrl}
                  alt="The completed work, photographed by the crew"
                />
                <figcaption>
                  <span className="chip chip-success">After</span>
                  Crew's proof
                  {resolvedEntry
                    ? ` · ${formatDate(resolvedEntry.createdAt, { year: undefined })}`
                    : ""}
                </figcaption>
              </figure>
            ) : (
              <p className="signoff-noproof">
                The crew didn't attach a photo of the finished work. Have a
                look in person before you sign off.
              </p>
            )}
          </div>

          {approved === null ? (
            <div className="signoff-choices">
              <button
                type="button"
                className="btn-accent btn-lg"
                onClick={() => chooseVerdict(true)}
              >
                <BadgeCheck aria-hidden="true" />
                Yes, it's fixed
              </button>
              <button
                type="button"
                className="btn-danger-ghost btn-lg"
                onClick={() => chooseVerdict(false)}
              >
                <RotateCcw aria-hidden="true" />
                No, reopen it
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleVerification}
              className={`signoff-form ${approved ? "is-approve" : "is-reopen"}`}
            >
              <h3>{approved ? "Sign off the fix" : "Reopen the case"}</h3>

              {approved && (
                <div className="field">
                  <span className="signoff-label">How good was the work?</span>
                  <StarRating value={stars} onChange={setStars} />
                </div>
              )}

              <div className="field">
                <label htmlFor="verification-note">
                  {approved ? "Anything to add?" : "What's still wrong?"}
                </label>
                <textarea
                  id="verification-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    approved
                      ? "Optional. A thank-you or a tip for the crew."
                      : "e.g. The patch cracked again after one night of rain."
                  }
                  rows={3}
                  required={!approved}
                />
                {!approved && (
                  <span className="field-hint">
                    The crew sees this, and the {FEATURES.fixClock} starts again.
                  </span>
                )}
              </div>

              {verificationError && (
                <div className="form-error" role="alert">
                  {verificationError}
                </div>
              )}

              <div className="button-row">
                <button
                  type="submit"
                  className={approved ? "btn-accent" : "btn-danger"}
                  disabled={verifying}
                >
                  {verifying && <span className="spinner" aria-hidden="true" />}
                  {verifying
                    ? "Saving…"
                    : approved
                      ? "Sign off the fix"
                      : "Reopen case"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setApproved(null);
                    setVerificationError("");
                  }}
                  disabled={verifying}
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <div className="grid-main-side case-layout">
        <div className="case-main">
          <section className="card" aria-labelledby="evidence-title">
            <SectionHeader
              eyebrow="Your report"
              title={<span id="evidence-title">What you sent</span>}
            />

            <div className="case-evidence">
              <PhotoGallery photos={photos} alt="Reported problem" />

              <p className="case-description">
                {complaint.description ||
                  issue.description ||
                  "No description added."}
              </p>

              {complaint.audioUrl && (
                <div className="case-voice">
                  <span>
                    <Mic aria-hidden="true" />
                    Voice note
                  </span>
                  <audio controls src={complaint.audioUrl} preload="none" />
                </div>
              )}
            </div>
          </section>

          <section className="card case-history" aria-labelledby="timeline-title">
            <SectionHeader
              eyebrow="Progress"
              title={<span id="timeline-title">Case timeline</span>}
              description="Every status change and site update, oldest first."
            />
            <CaseTimeline history={issue.statusHistory} />
          </section>

          {issue.id && (
            <div className="case-threads">
              <IssueChat issueId={issue.id} />
              <CommentsSection issueId={issue.id} />
            </div>
          )}
        </div>

        <aside className="case-side">
          <FixClockPanel clock={clock} />

          <section className="card case-side-card" aria-labelledby="crew-title">
            <h2 id="crew-title" className="case-side-title">
              Who's on it
            </h2>
            <dl className="case-facts">
              <div>
                <dt>
                  <HardHat aria-hidden="true" />
                  Officer
                </dt>
                <dd>
                  {assignment?.authority?.name ?? "Not assigned yet"}
                  {assignment?.assignedAt && (
                    <small>Assigned {timeAgo(assignment.assignedAt, now)}</small>
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  <Building2 aria-hidden="true" />
                  Department
                </dt>
                <dd>{issue.department?.name ?? "Being routed"}</dd>
              </div>
              <div>
                <dt>
                  <MapPin aria-hidden="true" />
                  Ward
                </dt>
                <dd>
                  {issue.ward
                    ? `${issue.ward.name}${issue.ward.code ? ` (${issue.ward.code})` : ""}`
                    : "Not set"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card case-side-card" aria-labelledby="place-title">
            <h2 id="place-title" className="case-side-title">
              Location
            </h2>
            <p className="case-address">
              <MapPin aria-hidden="true" />
              {issue.address || "Address unavailable"}
            </p>
            {lat != null && lng != null && (
              <p className="case-coords mono">
                {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              </p>
            )}
            <div className="case-links">
              {issue.id && (
                <Link to={`/issues/${issue.id}`} className="btn btn-secondary btn-sm">
                  <Radar aria-hidden="true" />
                  Public page
                </Link>
              )}
              {lat != null && lng != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  <ExternalLink aria-hidden="true" />
                  Open map
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </div>
          </section>

          <section className="card case-side-card" aria-labelledby="sort-title">
            <h2 id="sort-title" className="case-side-title">
              <Sparkles aria-hidden="true" />
              {FEATURES.autoSort}
            </h2>
            <p className="case-side-note">
              Read from your photo{issue.category ? "" : " — still working on it"}.
            </p>
            {confidence != null && (
              <Meter
                label="How sure it is"
                value={confidence}
                thresholds={[50, 75]}
              />
            )}
          </section>

          {canWithdraw && (
            <section className="card case-side-card case-withdraw">
              <h2 className="case-side-title">Filed by mistake?</h2>
              <p className="case-side-note">
                You can withdraw this report until a crew starts on it.
              </p>
              {withdrawError && (
                <div className="form-error" role="alert">
                  {withdrawError}
                </div>
              )}
              <button
                type="button"
                className="btn-danger-ghost btn-sm"
                onClick={handleWithdraw}
                disabled={withdrawing}
              >
                <Trash2 aria-hidden="true" />
                {withdrawing ? "Withdrawing…" : "Withdraw report"}
              </button>
            </section>
          )}

          <p className="case-updated">
            Last update {formatDateTime(issue.updatedAt || complaint.createdAt)}
          </p>
        </aside>
      </div>
    </div>
  );
}
