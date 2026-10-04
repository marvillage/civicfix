import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CircleCheck,
  ExternalLink,
  ImagePlus,
  LocateFixed,
  MapPin,
  Radar,
  RotateCcw,
  Send,
  Siren,
  Sparkles,
  ThumbsUp,
  Timer,
  X,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import IssueMap from "../../components/IssueMap";
import VoiceRecorder from "../../components/VoiceRecorder";
import {
  CategoryChip,
  PageHeader,
  SeverityBadge,
  StatusBadge,
} from "../../components/ui";

const MAX_PHOTOS = 5;
const ECHO_RADIUS = 500;
const EMPTY = [];

function formatDistance(meters) {
  if (meters == null) return "";

  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

export default function PublicReport() {
  const { isAuthenticated, can } = useAuth();
  const location = useLocation();

  const [images, setImages] = useState([]);
  const [photoNote, setPhotoNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [voiceNote, setVoiceNote] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [lookup, setLookup] = useState({ key: "", address: "", nearby: [] });
  const [locating, setLocating] = useState(false);
  const [backed, setBacked] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [formKey, setFormKey] = useState(0);

  const coords = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    return latitude !== "" &&
      longitude !== "" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
      ? { lat, lng }
      : null;
  }, [latitude, longitude]);

  // Photo previews (object URLs are released when the set changes).
  const previews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images]
  );

  useEffect(
    () => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)),
    [previews]
  );

  // Reverse geocode + Echo Check once the pin settles. Results are
  // keyed by the coordinates they belong to, so a moved pin never
  // shows a stale address.
  const coordKey = coords ? `${coords.lat},${coords.lng}` : "";
  const address = lookup.key === coordKey ? lookup.address : "";
  const nearby = lookup.key === coordKey ? lookup.nearby : EMPTY;

  useEffect(() => {
    if (!coords) {
      return undefined;
    }

    let cancelled = false;
    const key = `${coords.lat},${coords.lng}`;

    const timer = setTimeout(async () => {
      const [geo, near] = await Promise.allSettled([
        api.get("/geocode", { params: coords }),
        api.get("/issues/nearby", {
          params: { ...coords, radius: ECHO_RADIUS, limit: 5 },
        }),
      ]);

      if (cancelled) return;

      setLookup({
        key,
        address:
          geo.status === "fulfilled" ? geo.value.data.address || "" : "",
        nearby:
          near.status === "fulfilled" ? near.value.data.issues || [] : [],
      });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coords]);

  function addFiles(fileList) {
    const incoming = [...(fileList || [])].filter((file) =>
      file.type?.startsWith("image/")
    );

    if (incoming.length === 0) return;

    setImages((current) => {
      const merged = [...current, ...incoming];

      setPhotoNote(
        merged.length > MAX_PHOTOS
          ? `Only ${MAX_PHOTOS} photos fit. We kept the first ${MAX_PHOTOS}.`
          : ""
      );

      return merged.slice(0, MAX_PHOTOS);
    });
  }

  function removePhoto(index) {
    setImages((current) => current.filter((_, i) => i !== index));
    setPhotoNote("");
  }

  function getLocation() {
    setError("");

    if (!navigator.geolocation) {
      setError("Your browser can't share its location. Type the coordinates instead.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
      },
      () => {
        setLocating(false);
        setError(
          "Couldn't get your location. Allow location access, or type the coordinates."
        );
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function backIssue(issueId) {
    try {
      await api.post(`/issues/${issueId}/upvote`);
      setBacked((previous) => ({ ...previous, [issueId]: true }));
    } catch (backError) {
      if (backError.response?.status === 409) {
        setBacked((previous) => ({ ...previous, [issueId]: true }));
      } else {
        setError(
          backError.response?.data?.message || "Couldn't back that case."
        );
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (images.length === 0) {
      setError("Add at least one photo. It's how the crew finds and sizes the problem.");
      return;
    }

    if (!coords) {
      setError("Add the location: tap “Use my location” or type the coordinates.");
      return;
    }

    const formData = new FormData();

    images.forEach((file) => formData.append("images", file));

    if (voiceNote) {
      formData.append("audio", voiceNote);
    }

    formData.append("isEmergency", isEmergency ? "true" : "false");
    formData.append("description", description);
    formData.append("latitude", String(coords.lat));
    formData.append("longitude", String(coords.lng));

    setLoading(true);

    try {
      const response = await api.post("/complaints/anonymous", formData);

      setSubmitted({
        issue: response.data.complaint?.issue || response.data.issue || null,
        classification: response.data.classification || null,
      });
      window.scrollTo({ top: 0 });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "Couldn't send the report. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setImages([]);
    setPhotoNote("");
    setVoiceNote(null);
    setIsEmergency(false);
    setDescription("");
    setLatitude("");
    setLongitude("");
    setBacked({});
    setError("");
    setSubmitted(null);
    setFormKey((key) => key + 1);
  }

  if (submitted) {
    const { issue, classification } = submitted;

    return (
      <div className="page drop-done">
        <section className="card drop-success" aria-live="polite">
          <span className="success-stripe" aria-hidden="true" />

          <svg className="success-check" viewBox="0 0 56 56" aria-hidden="true">
            <circle className="circle" cx="28" cy="28" r="26" />
            <path className="mark" d="M16 29.5l8 8 16-17" />
          </svg>

          <p className="eyebrow">{FEATURES.quickDrop}</p>
          <h1>Dropped. It's on the record.</h1>
          <p className="drop-success-text">
            Your report is now a public case. Anyone can follow it, and the
            city's {FEATURES.fixClock} starts as soon as it's routed.
          </p>

          {classification && (
            <div className="drop-autosort">
              <span className="drop-autosort-label">
                <Sparkles aria-hidden="true" />
                {FEATURES.autoSort}
              </span>
              {classification.category && (
                <CategoryChip category={classification.category} />
              )}
              {classification.severity && (
                <SeverityBadge severity={classification.severity} />
              )}
              {classification.confidence != null && (
                <span className="chip chip-outline">
                  {Math.round(classification.confidence * 100)}% sure
                </span>
              )}
            </div>
          )}

          <div className="drop-success-actions">
            {issue?.id && (
              <Link to={`/issues/${issue.id}`} className="btn btn-accent btn-lg">
                Open the {FEATURES.caseFile}
                <ArrowRight aria-hidden="true" />
              </Link>
            )}

            {!isAuthenticated && (
              <Link to="/register" className="btn btn-secondary btn-lg">
                Create an account
              </Link>
            )}

            <button type="button" className="btn-ghost btn-lg" onClick={startOver}>
              <RotateCcw aria-hidden="true" />
              Report another
            </button>
          </div>

          {!isAuthenticated && (
            <p className="field-hint">
              With an account, your next report lands in {FEATURES.myCases},
              earns {FEATURES.civicCred} and gets your {FEATURES.signOff} on the fix.
            </p>
          )}
        </section>
      </div>
    );
  }

  const steps = {
    photos: images.length > 0,
    place: !!coords,
  };

  return (
    <div className="page drop">
      <PageHeader
        eyebrow={FEATURES.quickDrop}
        title="Report it in under a minute"
        description={`No account and no forms to fight. A photo and a pin are enough; ${FEATURES.autoSort} works out the rest and sends it to the right crew.`}
      />

      {can("issue:report") && (
        <div className="form-info drop-signed-in">
          <span>
            You're logged in. Use {FEATURES.snapSend} to follow this report in{" "}
            {FEATURES.myCases} and earn {FEATURES.civicCred}.
          </span>
          <Link to="/citizen/report" className="btn btn-sm btn-secondary">
            Open {FEATURES.snapSend}
          </Link>
        </div>
      )}

      <div className="grid-main-side drop-grid">
        <form
          key={formKey}
          className="stack drop-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* 1 · Photos */}
          <section className="card drop-step" aria-labelledby="drop-photos-title">
            <StepHead
              n={1}
              id="drop-photos-title"
              title="Photos"
              hint={`Up to ${MAX_PHOTOS}. Close-ups and one wide shot work best.`}
              done={steps.photos}
            />

            <input
              id="drop-photos"
              className="drop-input"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />

            {images.length < MAX_PHOTOS && (
              <label
                htmlFor="drop-photos"
                className={`drop-zone ${dragging ? "is-dragging" : ""} ${images.length ? "is-compact" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  addFiles(event.dataTransfer.files);
                }}
              >
                <span className="drop-zone-icon" aria-hidden="true">
                  <ImagePlus />
                </span>
                <span className="drop-zone-text">
                  <strong>
                    {images.length ? "Add another photo" : "Take or choose photos"}
                  </strong>
                  <span>Tap here, or drag photos in</span>
                </span>
              </label>
            )}

            {previews.length > 0 && (
              <ul className="drop-thumbs" aria-label="Selected photos">
                {previews.map((preview, index) => (
                  <li key={preview.url}>
                    <img src={preview.url} alt={`Selected photo ${index + 1}`} />
                    {index === 0 && <span className="drop-cover">Cover</span>}
                    <button
                      type="button"
                      className="icon-button drop-thumb-remove"
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() => removePhoto(index)}
                    >
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="field-hint">
              {images.length}/{MAX_PHOTOS} photos
              {photoNote ? ` · ${photoNote}` : ""}
            </p>
          </section>

          {/* 2 · Location */}
          <section className="card drop-step" aria-labelledby="drop-place-title">
            <StepHead
              n={2}
              id="drop-place-title"
              title="Location"
              hint="Stand near the problem and use your location, or type the coordinates."
              done={steps.place}
            />

            <div className="drop-locate">
              <button
                type="button"
                className={coords ? "btn-secondary" : ""}
                onClick={getLocation}
                disabled={locating}
              >
                {locating ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <LocateFixed aria-hidden="true" />
                )}
                {locating
                  ? "Finding you…"
                  : coords
                    ? "Use my location again"
                    : "Use my location"}
              </button>
            </div>

            <div className="form-row drop-coords">
              <div className="field">
                <label htmlFor="drop-lat">Latitude</label>
                <input
                  id="drop-lat"
                  type="text"
                  inputMode="decimal"
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value.trim())}
                  placeholder="28.6139"
                  autoComplete="off"
                />
              </div>

              <div className="field">
                <label htmlFor="drop-lng">Longitude</label>
                <input
                  id="drop-lng"
                  type="text"
                  inputMode="decimal"
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value.trim())}
                  placeholder="77.2090"
                  autoComplete="off"
                />
              </div>
            </div>

            {coords && (
              <>
                <p className="drop-address" aria-live="polite">
                  <MapPin aria-hidden="true" />
                  {address || "Looking up the address…"}
                </p>

                <IssueMap
                  issues={nearby}
                  center={coords}
                  radius={ECHO_RADIUS}
                  height={220}
                  label="Where the problem is, with open cases nearby"
                />
              </>
            )}

            {nearby.length > 0 && (
              <div className="echo-check" role="region" aria-label={FEATURES.echoCheck}>
                <div className="echo-head">
                  <span className="echo-icon" aria-hidden="true">
                    <Radar />
                  </span>
                  <div>
                    <strong>
                      {FEATURES.echoCheck}: {nearby.length} open{" "}
                      {nearby.length === 1 ? "case" : "cases"} within{" "}
                      {formatDistance(ECHO_RADIUS)}
                    </strong>
                    <p>
                      Same problem? Backing the existing case moves it up the
                      queue faster than a second report.
                    </p>
                  </div>
                </div>

                <ul className="echo-list">
                  {nearby.map((issue) => {
                    const backers = issue._count?.upvotes ?? 0;

                    return (
                      <li key={issue.id} className="echo-item">
                        <div className="echo-info">
                          <a
                            href={`/issues/${issue.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="echo-title"
                          >
                            {issue.title || "Untitled case"}
                            <ExternalLink aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                          <span className="echo-meta">
                            {issue.category && (
                              <CategoryChip category={issue.category} short />
                            )}
                            <StatusBadge status={issue.status} />
                            {issue.distanceMeters != null && (
                              <span>{formatDistance(issue.distanceMeters)} away</span>
                            )}
                            <span>
                              {backers} {backers === 1 ? "backer" : "backers"}
                            </span>
                          </span>
                        </div>

                        {isAuthenticated ? (
                          can("issue:upvote") && (
                            <button
                              type="button"
                              className="btn-sm btn-secondary"
                              onClick={() => backIssue(issue.id)}
                              disabled={backed[issue.id]}
                            >
                              {backed[issue.id] ? (
                                <Check aria-hidden="true" />
                              ) : (
                                <ThumbsUp aria-hidden="true" />
                              )}
                              {backed[issue.id] ? "Backed" : FEATURES.backIt}
                            </button>
                          )
                        ) : (
                          <Link
                            to="/login"
                            state={{ from: location.pathname }}
                            className="btn btn-sm btn-secondary"
                          >
                            <ThumbsUp aria-hidden="true" />
                            Log in to back it
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* 3 · Details */}
          <section className="card drop-step" aria-labelledby="drop-details-title">
            <StepHead
              n={3}
              id="drop-details-title"
              title="Details"
              hint="Optional, but a sentence or a voice note helps the crew."
            />

            <div className="field">
              <label htmlFor="drop-description">What's wrong?</label>
              <textarea
                id="drop-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="e.g. Deep pothole in the left lane, right outside the bus stop. Bikes swerve into traffic to avoid it."
                rows={4}
              />
            </div>

            <div className="field">
              <span className="drop-field-label">Voice note</span>
              <VoiceRecorder onChange={setVoiceNote} />
            </div>

            <label className={`drop-alert ${isEmergency ? "is-on" : ""}`}>
              <input
                type="checkbox"
                checked={isEmergency}
                onChange={(event) => setIsEmergency(event.target.checked)}
              />
              <span className="drop-alert-icon" aria-hidden="true">
                <Siren />
              </span>
              <span className="drop-alert-text">
                <strong>Mark as {FEATURES.redAlert}</strong>
                <span>
                  Only for danger to life: an open manhole, a live wire, a
                  collapsing wall. Admins are alerted instantly.
                </span>
              </span>
            </label>
          </section>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="drop-submit">
            <ul className="drop-checklist" aria-label="Ready to send">
              <li className={steps.photos ? "is-done" : ""}>
                {steps.photos ? <CircleCheck aria-hidden="true" /> : <span aria-hidden="true" />}
                Photo
              </li>
              <li className={steps.place ? "is-done" : ""}>
                {steps.place ? <CircleCheck aria-hidden="true" /> : <span aria-hidden="true" />}
                Location
              </li>
            </ul>

            <button type="submit" className="btn-accent btn-lg" disabled={loading}>
              {loading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {loading ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>

        <aside className="stack drop-side">
          <section className="card card-navy drop-next">
            <img
              src="/images/report-dusk.png"
              alt=""
              className="drop-next-art"
              loading="lazy"
            />

            <div className="drop-next-body">
              <h2>What happens next</h2>

              <ol className="drop-next-steps">
                <li>
                  <Sparkles aria-hidden="true" />
                  <span>
                    <strong>{FEATURES.autoSort}</strong> reads the photo and
                    routes it to the right department.
                  </span>
                </li>
                <li>
                  <Radar aria-hidden="true" />
                  <span>
                    <strong>{FEATURES.echoCheck}</strong> merges repeat reports
                    so one case collects every voice.
                  </span>
                </li>
                <li>
                  <Timer aria-hidden="true" />
                  <span>
                    <strong>{FEATURES.fixClock}</strong> starts. Miss the
                    deadline and the case escalates.
                  </span>
                </li>
                <li>
                  <MapPin aria-hidden="true" />
                  <span>
                    It goes live on <strong>{FEATURES.radar}</strong> for
                    anyone to follow and back.
                  </span>
                </li>
              </ol>
            </div>
          </section>

          {!isAuthenticated && (
            <section className="card drop-account">
              <h2>Want the credit?</h2>
              <p>
                With a free account you can follow reports in {FEATURES.myCases},
                earn {FEATURES.civicCred}, chat with the crew on{" "}
                {FEATURES.directLine} and give the final {FEATURES.signOff}.
              </p>
              <div className="button-row">
                <Link to="/register" className="btn btn-secondary btn-sm">
                  Create account
                </Link>
                <Link
                  to="/login"
                  state={{ from: "/citizen/report" }}
                  className="btn btn-ghost btn-sm"
                >
                  Log in
                </Link>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function StepHead({ n, id, title, hint, done = false }) {
  return (
    <div className="drop-step-head">
      <span className={`drop-step-n ${done ? "is-done" : ""}`} aria-hidden="true">
        <span>{done ? <Check /> : n}</span>
      </span>
      <div>
        <h2 id={id}>
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  );
}
