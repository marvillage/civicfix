import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  ClipboardPlus,
  Receipt,
  Timer,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { PageHeader } from "../../components/ui";
import { CATEGORIES, CATEGORY_META, SEVERITY_LABEL } from "../../lib/labels";
import { LocationPicker, PhotoPicker } from "../CaseKit";

const SEVERITIES = [
  { key: "LOW", hint: "Cosmetic, no risk", ramp: 30 },
  { key: "MEDIUM", hint: "Nuisance, slows people", ramp: 55 },
  { key: "HIGH", hint: "Risk of injury or damage", ramp: 78 },
  { key: "CRITICAL", hint: "Danger to life", ramp: 100 },
];

function StepHead({ number, title, hint }) {
  return (
    <div className="snap-step-head">
      <span className="snap-step-num" aria-hidden="true">
        {number}
      </span>
      <div>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  );
}

export default function FieldReport() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ROAD_DAMAGE");
  const [severity, setSeverity] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geo, setGeo] = useState({ pin: "", address: "" });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Show the address for the pin so the officer can sanity-check it.
  const lat = Number(latitude);
  const lng = Number(longitude);
  const pin =
    latitude && longitude && Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat},${lng}`
      : "";
  const address = geo.pin === pin ? geo.address : "";

  useEffect(() => {
    if (!pin) return undefined;

    const [lat, lng] = pin.split(",").map(Number);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/geocode", { params: { lat, lng } });

        if (!cancelled) setGeo({ pin, address: response.data.address || "" });
      } catch {
        if (!cancelled) setGeo({ pin, address: "" });
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pin]);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (title.trim().length < 4) {
      setError("Give the problem a short title, like “Collapsed drain cover on 4th Cross”.");
      return;
    }

    if (images.length === 0) {
      setError("Add at least one photo.");
      return;
    }

    if (!latitude || !longitude) {
      setError("Location is required: use GPS at the spot or type coordinates.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("category", category);
    formData.append("severity", severity);
    formData.append("description", description);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);

    images.forEach((file) => formData.append("images", file));

    setLoading(true);

    try {
      const response = await api.post("/complaints/field", formData);
      const issueId = response.data.issue?.id;

      navigate(issueId ? `/authority/issues/${issueId}` : "/authority");
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "Unable to log the field report."
      );
      setLoading(false);
    }
  }

  return (
    <div className="page snap patrol">
      <PageHeader
        eyebrow={FEATURES.patrolLog}
        title="Log a problem from the field"
        description={`Spotted something on your rounds? Log it here. It's created already accepted and assigned to you, with the ${FEATURES.fixClock} running.`}
      />

      <form onSubmit={handleSubmit} className="grid-main-side snap-layout" noValidate>
        <div className="snap-steps">
          <section className="card snap-step" aria-labelledby="pl-what">
            <StepHead
              number={1}
              title={<span id="pl-what">What is it?</span>}
              hint="You're the expert here, so you set the category and severity."
            />

            <div className="field">
              <label htmlFor="field-title">Title</label>
              <input
                id="field-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Collapsed drain cover on 4th Cross"
                maxLength={120}
                required
              />
            </div>

            <fieldset className="pl-fieldset">
              <legend>Category</legend>
              <div className="pl-cats">
                {CATEGORIES.map((key) => {
                  const meta = CATEGORY_META[key];
                  const Icon = meta.icon;

                  return (
                    <label
                      key={key}
                      className={`pl-option pl-cat ${category === key ? "is-on" : ""}`}
                    >
                      <input
                        type="radio"
                        name="field-category"
                        value={key}
                        checked={category === key}
                        onChange={() => setCategory(key)}
                        className="pl-radio"
                      />
                      <span className={`cat-dot cat-${key}`} aria-hidden="true" />
                      <Icon aria-hidden="true" />
                      <span>{meta.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="pl-fieldset">
              <legend>Severity</legend>
              <div className="pl-sevs">
                {SEVERITIES.map((item) => (
                  <label
                    key={item.key}
                    className={`pl-option pl-sev ${severity === item.key ? "is-on" : ""}`}
                    style={{
                      "--sev": `color-mix(in oklab, var(--seq-high) ${item.ramp}%, var(--seq-low))`,
                    }}
                  >
                    <input
                      type="radio"
                      name="field-severity"
                      value={item.key}
                      checked={severity === item.key}
                      onChange={() => setSeverity(item.key)}
                      className="pl-radio"
                    />
                    <span className="pl-sev-swatch" aria-hidden="true" />
                    <span className="pl-sev-text">
                      <strong>{SEVERITY_LABEL[item.key]}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="card snap-step" aria-labelledby="pl-photos">
            <StepHead
              number={2}
              title={<span id="pl-photos">Photos</span>}
              hint="These become the case's “before” shots for the citizen Sign-Off."
            />
            <PhotoPicker
              id="field-images"
              files={images}
              onChange={setImages}
              max={5}
            />
          </section>

          <section className="card snap-step" aria-labelledby="pl-where">
            <StepHead
              number={3}
              title={<span id="pl-where">Where is it?</span>}
              hint="Use GPS while standing at the spot."
            />
            <LocationPicker
              idPrefix="field"
              latitude={latitude}
              longitude={longitude}
              setLatitude={setLatitude}
              setLongitude={setLongitude}
              address={address}
              onError={setError}
              hint="The pin sets the ward and the Fix Clock rules."
            />
          </section>

          <section className="card snap-step" aria-labelledby="pl-notes">
            <StepHead
              number={4}
              title={<span id="pl-notes">Notes for the record</span>}
            />
            <div className="field">
              <label htmlFor="field-description">Description</label>
              <textarea
                id="field-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Size, depth, what's needed to fix it, access notes…"
                rows={4}
              />
            </div>
          </section>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="snap-submit">
            <button type="submit" className="btn-accent btn-lg" disabled={loading}>
              {loading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <ClipboardPlus aria-hidden="true" />
              )}
              {loading ? "Logging…" : `Add to my ${FEATURES.crewQueue}`}
            </button>
          </div>
        </div>

        <aside className="snap-aside">
          <div className="card snap-guide-body pl-guide">
            <h2>What happens next</h2>
            <ol className="snap-guide-steps">
              <li>
                <span aria-hidden="true">
                  <ClipboardCheck />
                </span>
                <div>
                  <strong>It's yours straight away</strong>
                  <p>The case is created accepted and assigned to you, so you can start work right away.</p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">
                  <Timer />
                </span>
                <div>
                  <strong>The {FEATURES.fixClock} starts</strong>
                  <p>Same deadline rules as a citizen report. It shows publicly on {FEATURES.radar}.</p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">
                  <Receipt />
                </span>
                <div>
                  <strong>Log updates and costs</strong>
                  <p>Post {FEATURES.siteUpdates} as you go and record spend in the {FEATURES.costLedger}.</p>
                </div>
              </li>
            </ol>
          </div>
        </aside>
      </form>
    </div>
  );
}
