import { useState } from "react";
import { Send } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/auth";
import {
  BULLETIN_KINDS,
  BULLETIN_KIND_KEYS,
  apiMessage,
  fromLocalInput,
  toLocalInput,
} from "./helpers";

function validate(form) {
  const title = form.title.trim();
  const body = form.body.trim();
  const startsAt = fromLocalInput(form.startsAt);
  const endsAt = fromLocalInput(form.endsAt);

  if (title.length < 4 || title.length > 120) {
    return "Give the bulletin a title of 4–120 characters.";
  }
  if (body.length < 10 || body.length > 2000) {
    return "Write a message of 10–2000 characters.";
  }
  if (!startsAt) return "Choose when the bulletin starts.";
  if (form.endsAt && !endsAt) return "The end time isn't a valid date.";
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return "The end time must be after the start time.";
  }

  return "";
}

// Publish form for Ward Bulletins (bulletin:publish). Officers
// publish for their own department; pinning needs bulletin:manage.
export default function BulletinForm({ wards, onPublished, onCancel }) {
  const { user, can } = useAuth();
  const canPin = can("bulletin:manage");

  const [form, setForm] = useState(() => ({
    title: "",
    body: "",
    kind: "ADVISORY",
    wardId: "",
    startsAt: toLocalInput(Date.now()),
    endsAt: "",
    pinned: false,
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

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
        body: form.body.trim(),
        kind: form.kind,
        startsAt: fromLocalInput(form.startsAt),
      };

      if (form.wardId) payload.wardId = form.wardId;
      if (form.endsAt) payload.endsAt = fromLocalInput(form.endsAt);
      if (canPin && form.pinned) payload.pinned = true;

      const response = await api.post("/bulletins", payload);

      onPublished(response.data.bulletin);
    } catch (submitError) {
      setError(apiMessage(submitError, "Couldn't publish the bulletin."));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {user?.department?.name && (
        <p className="form-info">
          Published for {user.department.name}. Residents of the ward you
          pick get an alert.
        </p>
      )}

      <fieldset className="field kind-picker">
        <legend>Type</legend>
        <div className="kind-options">
          {BULLETIN_KIND_KEYS.map((key) => {
            const meta = BULLETIN_KINDS[key];
            const Icon = meta.icon;

            return (
              <label
                key={key}
                className={`kind-option kind-${meta.tone} ${form.kind === key ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="bulletin-kind"
                  value={key}
                  checked={form.kind === key}
                  onChange={() => update("kind", key)}
                />
                <Icon aria-hidden="true" />
                {meta.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="bulletin-title">Title</label>
        <input
          id="bulletin-title"
          value={form.title}
          maxLength={120}
          onChange={(event) => update("title", event.target.value)}
          placeholder="e.g. Water supply off in Blocks A–D until 6 pm"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="bulletin-body">Message</label>
        <textarea
          id="bulletin-body"
          value={form.body}
          maxLength={2000}
          onChange={(event) => update("body", event.target.value)}
          placeholder="What's happening, where, and what residents should do."
          aria-describedby="bulletin-body-count"
          required
        />
        <span id="bulletin-body-count" className="field-hint">
          {form.body.trim().length} / 2000 characters
        </span>
      </div>

      <div className="field">
        <label htmlFor="bulletin-ward">Ward</label>
        <select
          id="bulletin-ward"
          value={form.wardId}
          onChange={(event) => update("wardId", event.target.value)}
        >
          <option value="">Citywide (every ward)</option>
          {wards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              {ward.name} ({ward.code})
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="bulletin-starts">Starts</label>
          <input
            id="bulletin-starts"
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => update("startsAt", event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="bulletin-ends">Ends (optional)</label>
          <input
            id="bulletin-ends"
            type="datetime-local"
            value={form.endsAt}
            min={form.startsAt || undefined}
            onChange={(event) => update("endsAt", event.target.value)}
            aria-describedby="bulletin-ends-hint"
          />
          <span id="bulletin-ends-hint" className="field-hint">
            Leave empty for “until further notice”.
          </span>
        </div>
      </div>

      {canPin && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(event) => update("pinned", event.target.checked)}
          />
          Pin to the top of the board
        </label>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-accent" disabled={saving}>
          <Send aria-hidden="true" />
          {saving ? "Publishing…" : "Publish bulletin"}
        </button>
      </div>
    </form>
  );
}
