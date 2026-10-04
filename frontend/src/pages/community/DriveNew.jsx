import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Award, Send, ShieldCheck, Users } from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { PageHeader } from "../../components/ui";
import IssuePicker from "../../components/community/IssuePicker";
import LocationFields from "../../components/community/LocationFields";
import MiniMap from "../../components/community/MiniMap";
import {
  apiMessage,
  fromLocalInput,
  nextQuarter,
  toLocalInput,
  useNow,
  useWards,
} from "../../components/community/helpers";

const LEAD_MS = 2 * 3_600_000;

function defaultStart() {
  const date = new Date(Date.now() + 2 * 24 * 3_600_000);
  date.setHours(8, 0, 0, 0);
  return toLocalInput(date);
}

function validate(form) {
  const title = form.title.trim();
  const description = form.description.trim();
  const startsAt = fromLocalInput(form.startsAt);
  const capacity = Number(form.capacity);

  if (title.length < 4 || title.length > 100) {
    return "Give the drive a title of 4–100 characters.";
  }
  if (description.length < 10 || description.length > 1000) {
    return "Describe the drive in 10–1000 characters.";
  }
  if (!startsAt) return "Choose a date and time.";
  if (Date.parse(startsAt) < Date.now() + LEAD_MS) {
    return "Drives need to start at least 2 hours from now, so the city can review them.";
  }
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500) {
    return "Capacity must be a whole number from 2 to 500.";
  }
  if (form.latitude == null || form.longitude == null) {
    return "Set the meeting point: click the map, use your location, or type coordinates.";
  }

  return "";
}

export default function DriveNew() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wards = useWards(can);
  const now = useNow();

  const [form, setForm] = useState(() => ({
    title: "",
    description: "",
    startsAt: defaultStart(),
    capacity: "20",
    latitude: null,
    longitude: null,
    address: "",
    wardId: "",
    issue: null,
  }));
  const [fitTick, setFitTick] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // /drives/new?issue=<id> pre-links a case and starts at its spot.
  const issueParam = searchParams.get("issue");

  useEffect(() => {
    if (!issueParam) return undefined;

    let active = true;

    api
      .get(`/issues/${issueParam}`)
      .then((response) => {
        const issue = response.data.issue;

        if (!active || !issue) return;

        setForm((current) => ({
          ...current,
          issue: {
            id: issue.id,
            title: issue.title,
            status: issue.status,
            category: issue.category,
          },
          latitude: current.latitude ?? issue.latitude ?? null,
          longitude: current.longitude ?? issue.longitude ?? null,
          address: current.address || issue.address || "",
          wardId: current.wardId || issue.wardId || issue.ward?.id || "",
        }));
        setFitTick((tick) => tick + 1);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [issueParam]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function move(latitude, longitude, { recenter = false } = {}) {
    setForm((current) => ({ ...current, latitude, longitude }));
    if (recenter) setFitTick((tick) => tick + 1);
  }

  const markers = useMemo(
    () =>
      form.latitude != null && form.longitude != null
        ? [{ id: "meet", lat: form.latitude, lng: form.longitude, label: "Meeting point" }]
        : [],
    [form.latitude, form.longitude]
  );

  async function submit(event) {
    event.preventDefault();

    const problem = validate(form);

    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        startsAt: fromLocalInput(form.startsAt),
        capacity: Number(form.capacity),
        latitude: Number(form.latitude.toFixed(6)),
        longitude: Number(form.longitude.toFixed(6)),
      };

      if (form.address.trim()) payload.address = form.address.trim();
      if (form.wardId) payload.wardId = form.wardId;
      if (form.issue) payload.issueId = form.issue.id;

      const response = await api.post("/drives", payload);

      navigate(`/drives/${response.data.drive.id}`, { state: { sent: true } });
    } catch (submitError) {
      setError(apiMessage(submitError, "Couldn't send the proposal."));
      setSaving(false);
    }
  }

  const minStart = toLocalInput(nextQuarter(now + LEAD_MS));

  return (
    <div className="page drive-new">
      <Link to="/drives" className="back-link">
        <ArrowLeft aria-hidden="true" />
        All drives
      </Link>

      <PageHeader
        eyebrow={FEATURES.drives}
        title="Propose a Cleanup Drive"
        description="Tell neighbours what you'll clean, when and where. A moderator checks every proposal before it's listed."
      />

      <div className="grid-main-side">
        <form className="card drive-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="drive-title">Title</label>
            <input
              id="drive-title"
              value={form.title}
              maxLength={100}
              placeholder="e.g. Clear the drain mouths on Lane 3"
              onChange={(event) => update("title", event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="drive-description">What you'll do</label>
            <textarea
              id="drive-description"
              rows={4}
              maxLength={1000}
              value={form.description}
              placeholder="What needs cleaning, what to bring, where to meet, and what happens to the waste."
              onChange={(event) => update("description", event.target.value)}
              aria-describedby="drive-description-count"
              required
            />
            <span id="drive-description-count" className="field-hint">
              {form.description.trim().length} / 1000 characters
            </span>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="drive-starts">Starts</label>
              <input
                id="drive-starts"
                type="datetime-local"
                value={form.startsAt}
                min={minStart}
                onChange={(event) => update("startsAt", event.target.value)}
                aria-describedby="drive-starts-hint"
                required
              />
              <span id="drive-starts-hint" className="field-hint">
                At least 2 hours from now.
              </span>
            </div>

            <div className="field">
              <label htmlFor="drive-capacity">Volunteers needed</label>
              <input
                id="drive-capacity"
                type="number"
                inputMode="numeric"
                min={2}
                max={500}
                step={1}
                value={form.capacity}
                onChange={(event) => update("capacity", event.target.value)}
                aria-describedby="drive-capacity-hint"
                required
              />
              <span id="drive-capacity-hint" className="field-hint">
                2 to 500. RSVPs stop when it's full.
              </span>
            </div>
          </div>

          <fieldset className="zone-fieldset drive-location">
            <legend>Meeting point</legend>
            <MiniMap
              markers={markers}
              onPick={(lat, lng) => move(lat, lng)}
              fitKey={`drive-new:${fitTick}`}
              zoom={15}
              height={300}
              label="Map. Click to set the meeting point."
              pickHint={
                markers.length ? "Click to move the pin" : "Click the map to drop the pin"
              }
            />
            <LocationFields
              idPrefix="drive"
              latitude={form.latitude ?? undefined}
              longitude={form.longitude ?? undefined}
              onChange={move}
            />
            <div className="field">
              <label htmlFor="drive-address">Address or landmark (optional)</label>
              <input
                id="drive-address"
                value={form.address}
                maxLength={200}
                placeholder="e.g. Central Park gate, Model Town"
                onChange={(event) => update("address", event.target.value)}
              />
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="drive-ward">Ward (optional)</label>
            <select
              id="drive-ward"
              value={form.wardId}
              onChange={(event) => update("wardId", event.target.value)}
            >
              <option value="">Not sure / leave blank</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name} ({ward.code})
                </option>
              ))}
            </select>
          </div>

          <IssuePicker
            label={`Link a ${FEATURES.caseFile} (optional)`}
            hint="If the drive cleans up after a reported case, link it so the officer sees it."
            value={form.issue}
            onChange={(issue) => update("issue", issue)}
          />

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="button-row">
            <button type="submit" className="btn-accent btn-lg" disabled={saving}>
              <Send aria-hidden="true" />
              {saving ? "Sending…" : "Send for review"}
            </button>
            <Link to="/drives" className="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>

        <aside className="stack feature-rail" aria-label="How drives work">
          <section className="card">
            <h2 className="rail-title">What happens next</h2>
            <ol className="drive-steps is-vertical">
              <li>
                <span className="drive-step-icon" aria-hidden="true">
                  <ShieldCheck />
                </span>
                <strong>A moderator reviews it</strong>
                <span>Usually within a day. If it's sent back, the note says why.</span>
              </li>
              <li>
                <span className="drive-step-icon" aria-hidden="true">
                  <Users />
                </span>
                <strong>Neighbours join</strong>
                <span>Once approved it's listed under Upcoming and residents can RSVP.</span>
              </li>
              <li>
                <span className="drive-step-icon" aria-hidden="true">
                  <Award />
                </span>
                <strong>Mark who came</strong>
                <span>After it starts, tick the attendees: +15 {FEATURES.civicCred} each, +25 for you.</span>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
