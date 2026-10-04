import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Check,
  ExternalLink,
  ScanSearch,
  Send,
  Siren,
  Sparkles,
  ThumbsUp,
  Timer,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import VoiceRecorder from "../../components/VoiceRecorder";
import SuccessCheck from "../../components/SuccessCheck";
import {
  CategoryChip,
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import { categoryLabel, SEVERITY_LABEL } from "../../lib/labels";
import { formatNumber } from "../../lib/format";
import { LocationPicker, PhotoPicker } from "../CaseKit";

const MAX_PHOTOS = 5;

function StepHead({ number, done, title, hint, optional }) {
  return (
    <div className="snap-step-head">
      <span className={`snap-step-num ${done ? "is-done" : ""}`} aria-hidden="true">
        {done ? <Check /> : number}
      </span>
      <div>
        <h2>
          {title}
          {optional && <span className="snap-optional">Optional</span>}
        </h2>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  );
}

export default function ReportIssue() {
  const navigate = useNavigate();

  const [images, setImages] = useState([]);
  const [voiceNote, setVoiceNote] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  // Address + Echo Check results, tagged with the pin they belong to.
  const [lookup, setLookup] = useState({ pin: "", address: "", nearby: [] });
  const [backed, setBacked] = useState({});
  const [backing, setBacking] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const pin =
    latitude && longitude && Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat},${lng}`
      : "";
  const address = lookup.pin === pin ? lookup.address : "";
  const nearby = lookup.pin === pin ? lookup.nearby : [];

  // Reverse-geocode and run Echo Check whenever the pin moves.
  useEffect(() => {
    if (!pin) return undefined;

    const [lat, lng] = pin.split(",").map(Number);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const [geo, near] = await Promise.all([
          api.get("/geocode", { params: { lat, lng } }),
          api.get("/issues/nearby", { params: { lat, lng } }),
        ]);

        if (!cancelled) {
          setLookup({
            pin,
            address: geo.data.address || "",
            nearby: near.data.issues || [],
          });
        }
      } catch (lookupError) {
        console.error("Location lookup error:", lookupError);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pin]);

  async function handleBackIt(issueId) {
    setBacking(issueId);

    try {
      await api.post(`/issues/${issueId}/upvote`);
      setBacked((previous) => ({ ...previous, [issueId]: true }));
    } catch (backError) {
      const message = backError.response?.data?.message || "";

      if (message.toLowerCase().includes("already")) {
        setBacked((previous) => ({ ...previous, [issueId]: true }));
      } else {
        setError(message || "Unable to back that case.");
      }
    } finally {
      setBacking(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (images.length === 0) {
      setError("Add at least one photo so the crew can see the problem.");
      return;
    }

    if (!latitude || !longitude) {
      setError("Add the location: tap “Use my location” or type coordinates.");
      return;
    }

    const formData = new FormData();

    images.forEach((file) => formData.append("images", file));

    if (voiceNote) {
      formData.append("audio", voiceNote);
    }

    formData.append("isEmergency", isEmergency ? "true" : "false");
    formData.append("description", description);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);

    setLoading(true);

    try {
      const response = await api.post("/complaints", formData);
      const sorted = response.data.classification;

      setSuccess(
        sorted?.category
          ? `${FEATURES.autoSort} filed it under ${categoryLabel(
              sorted.category
            ).toLowerCase()}${
              sorted.severity
                ? `, ${SEVERITY_LABEL[sorted.severity]?.toLowerCase() ?? ""} severity`
                : ""
            }. Taking you to ${FEATURES.myCases}…`
          : `Thanks for looking out for your street. Taking you to ${FEATURES.myCases}…`
      );

      setTimeout(() => {
        navigate("/citizen/complaints");
      }, 1900);
    } catch (submitError) {
      console.error("Complaint submission error:", submitError);

      setError(
        submitError.response?.data?.message ||
          "Unable to send your report. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const hasLocation = !!latitude && !!longitude;

  return (
    <div className="page snap">
      <PageHeader
        eyebrow={FEATURES.snapSend}
        title="Report a problem"
        description={`A photo and a pin is all it takes. ${FEATURES.autoSort} works out what it is and sends it to the right crew.`}
      />

      <form onSubmit={handleSubmit} className="grid-main-side snap-layout" noValidate>
        <div className="snap-steps">
          <section className="card snap-step" aria-labelledby="step-photos">
            <StepHead
              number={1}
              done={images.length > 0}
              title={<span id="step-photos">Show us the problem</span>}
              hint="Clear, close-up photos help the crew bring the right tools."
            />

            <PhotoPicker
              id="report-photos"
              files={images}
              onChange={setImages}
              max={MAX_PHOTOS}
            />
          </section>

          <section className="card snap-step" aria-labelledby="step-place">
            <StepHead
              number={2}
              done={hasLocation}
              title={<span id="step-place">Where is it?</span>}
              hint="The pin decides which ward and department get the case."
            />

            <LocationPicker
              idPrefix="report"
              latitude={latitude}
              longitude={longitude}
              setLatitude={setLatitude}
              setLongitude={setLongitude}
              address={address}
              onError={setError}
            />

            {nearby.length > 0 && (
              <div className="echo" role="region" aria-label={FEATURES.echoCheck}>
                <div className="echo-head">
                  <span className="echo-icon" aria-hidden="true">
                    <ScanSearch />
                  </span>
                  <div>
                    <strong>
                      {FEATURES.echoCheck}: {nearby.length}{" "}
                      {nearby.length === 1 ? "case is" : "cases are"} already
                      open near this spot
                    </strong>
                    <p>
                      If it's the same problem, back it instead. Backing pushes
                      the existing case up the queue faster than a duplicate.
                    </p>
                  </div>
                </div>

                <ul className="echo-list">
                  {nearby.map((issue) => (
                    <li key={issue.id}>
                      <div className="echo-info">
                        <strong>{issue.title}</strong>
                        <span className="meta-row">
                          {issue.category && (
                            <CategoryChip category={issue.category} short />
                          )}
                          <StatusBadge status={issue.status} />
                          {issue.distanceMeters != null && (
                            <span>{formatNumber(issue.distanceMeters)} m away</span>
                          )}
                          <span>
                            {formatNumber(issue._count?.upvotes || 0)} backers
                          </span>
                        </span>
                      </div>

                      <div className="echo-actions">
                        <button
                          type="button"
                          className={`btn-sm ${backed[issue.id] ? "btn-ghost" : "btn-secondary"}`}
                          onClick={() => handleBackIt(issue.id)}
                          disabled={backed[issue.id] || backing === issue.id}
                        >
                          {backed[issue.id] ? (
                            <Check aria-hidden="true" />
                          ) : (
                            <ThumbsUp aria-hidden="true" />
                          )}
                          {backed[issue.id] ? "Backed" : FEATURES.backIt}
                        </button>

                        <Link
                          to={`/issues/${issue.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-link echo-view"
                        >
                          View
                          <ExternalLink aria-hidden="true" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card snap-step" aria-labelledby="step-details">
            <StepHead
              number={3}
              done={!!description.trim() || !!voiceNote}
              optional
              title={<span id="step-details">Tell the crew more</span>}
              hint="Type it or say it. How long has it been like this? Is anyone at risk?"
            />

            <div className="field">
              <label htmlFor="description">What's wrong?</label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="e.g. The streetlight outside house 42 has been off for a week. The lane is pitch dark after 7 pm."
                rows={4}
              />
            </div>

            <div className="field snap-voice">
              <span className="snap-field-label">Voice note</span>
              <VoiceRecorder onChange={setVoiceNote} />
            </div>
          </section>

          <label className={`snap-redalert ${isEmergency ? "is-on" : ""}`}>
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(event) => setIsEmergency(event.target.checked)}
            />
            <span className="snap-redalert-icon" aria-hidden="true">
              <Siren />
            </span>
            <span className="snap-redalert-text">
              <strong>Flag as {FEATURES.redAlert}</strong>
              <span>
                Only for danger to life: an open manhole, a live wire, major
                flooding. Every admin is alerted at once and the case jumps the
                queue.
              </span>
            </span>
          </label>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="snap-submit">
            <button
              type="submit"
              className="btn-accent btn-lg"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {loading ? "Sending…" : "Send report"}
            </button>
            <p className="field-hint">
              You'll get an alert each time the case moves.
            </p>
          </div>
        </div>

        <aside className="snap-aside">
          <div className="card card-flush snap-guide">
            <img
              src="/images/report-dusk.png"
              alt="Hands photographing a broken streetlight at dusk"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            <div className="snap-guide-body">
              <h2>What happens next</h2>

              <ol className="snap-guide-steps">
                <li>
                  <span aria-hidden="true">
                    <Sparkles />
                  </span>
                  <div>
                    <strong>{FEATURES.autoSort} reads your photo</strong>
                    <p>It picks the category and severity and routes the case to the right department.</p>
                  </div>
                </li>
                <li>
                  <span aria-hidden="true">
                    <Timer />
                  </span>
                  <div>
                    <strong>The {FEATURES.fixClock} starts</strong>
                    <p>Every case gets a public deadline. Miss it and it escalates automatically.</p>
                  </div>
                </li>
                <li>
                  <span aria-hidden="true">
                    <BadgeCheck />
                  </span>
                  <div>
                    <strong>You sign it off</strong>
                    <p>When the crew says it's fixed, you compare before and after and rate the work, or reopen it.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </aside>
      </form>

      {success && <SuccessCheck title="Report sent" message={success} />}
    </div>
  );
}
