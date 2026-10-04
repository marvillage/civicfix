import { useState } from "react";
import { Plus, Send, X } from "lucide-react";
import api from "../../api/axios";
import IssuePicker from "./IssuePicker";
import {
  apiMessage,
  fromLocalInput,
  toLocalInput,
  useNow,
} from "./helpers";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

let optionKey = 0;

function blankOption() {
  optionKey += 1;
  return { key: optionKey, label: "", issue: null };
}

function defaultCloseTime() {
  const date = new Date(Date.now() + 7 * 24 * 3_600_000);
  date.setHours(20, 0, 0, 0);
  return toLocalInput(date);
}

function validate(form) {
  const question = form.question.trim();
  const closesAt = fromLocalInput(form.closesAt);

  if (question.length < 8 || question.length > 160) {
    return "Ask a question of 8–160 characters.";
  }
  if (form.description.trim().length > 600) {
    return "Keep the description under 600 characters.";
  }
  if (!closesAt || Date.parse(closesAt) <= Date.now()) {
    return "Pick a closing time in the future.";
  }
  if (form.options.length < MIN_OPTIONS || form.options.length > MAX_OPTIONS) {
    return "A Ward Vote needs 2 to 6 options.";
  }
  if (form.options.some((option) => !option.label.trim())) {
    return "Every option needs a label.";
  }

  const labels = form.options.map((option) => option.label.trim().toLowerCase());

  if (new Set(labels).size !== labels.length) {
    return "Two options have the same label.";
  }

  return "";
}

// "Open a Ward Vote" (poll:manage): question, optional ward and
// description, closing time, 2–6 options each optionally linked to
// a Case File.
export default function PollForm({ wards, onCreated, onCancel }) {
  const [form, setForm] = useState(() => ({
    question: "",
    description: "",
    wardId: "",
    closesAt: defaultCloseTime(),
    options: [blankOption(), blankOption()],
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const now = useNow();

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateOption(key, patch) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.key === key ? { ...option, ...patch } : option
      ),
    }));
  }

  function addOption() {
    setForm((current) =>
      current.options.length >= MAX_OPTIONS
        ? current
        : { ...current, options: [...current.options, blankOption()] }
    );
  }

  function removeOption(key) {
    setForm((current) =>
      current.options.length <= MIN_OPTIONS
        ? current
        : {
            ...current,
            options: current.options.filter((option) => option.key !== key),
          }
    );
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
        question: form.question.trim(),
        closesAt: fromLocalInput(form.closesAt),
        options: form.options.map((option) => {
          const item = { label: option.label.trim() };
          if (option.issue) item.issueId = option.issue.id;
          return item;
        }),
      };

      if (form.description.trim()) payload.description = form.description.trim();
      if (form.wardId) payload.wardId = form.wardId;

      const response = await api.post("/polls", payload);

      onCreated(response.data.poll);
    } catch (submitError) {
      setError(apiMessage(submitError, "Couldn't open the Ward Vote."));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="poll-question">Question</label>
        <input
          id="poll-question"
          value={form.question}
          maxLength={160}
          placeholder="e.g. What should Gandhi Nagar fix first?"
          onChange={(event) => update("question", event.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="poll-description">Description (optional)</label>
        <textarea
          id="poll-description"
          value={form.description}
          maxLength={600}
          rows={3}
          placeholder="What's at stake, the budget, and what happens with the result."
          onChange={(event) => update("description", event.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="poll-ward">Ward</label>
          <select
            id="poll-ward"
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

        <div className="field">
          <label htmlFor="poll-closes">Closes</label>
          <input
            id="poll-closes"
            type="datetime-local"
            value={form.closesAt}
            min={toLocalInput(now)}
            onChange={(event) => update("closesAt", event.target.value)}
            required
          />
        </div>
      </div>

      <fieldset className="poll-form-options">
        <legend>
          Options <span className="field-hint">({form.options.length} of {MAX_OPTIONS})</span>
        </legend>

        <ol>
          {form.options.map((option, index) => (
            <li key={option.key} className="poll-form-option">
              <span className="poll-form-number" aria-hidden="true">
                {index + 1}
              </span>

              <div className="poll-form-option-body">
                <div className="poll-form-option-row">
                  <label htmlFor={`poll-option-${option.key}`} className="sr-only">
                    Option {index + 1}
                  </label>
                  <input
                    id={`poll-option-${option.key}`}
                    value={option.label}
                    maxLength={80}
                    placeholder={`Option ${index + 1}`}
                    onChange={(event) =>
                      updateOption(option.key, { label: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => removeOption(option.key)}
                    disabled={form.options.length <= MIN_OPTIONS}
                    aria-label={`Remove option ${index + 1}`}
                    title="Remove option"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>

                <IssuePicker
                  compact
                  label={`Link a case to option ${index + 1} (optional)`}
                  value={option.issue}
                  onChange={(issue) => updateOption(option.key, { issue })}
                />
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={addOption}
          disabled={form.options.length >= MAX_OPTIONS}
        >
          <Plus aria-hidden="true" />
          Add an option
        </button>
      </fieldset>

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
          {saving ? "Opening…" : "Open the vote"}
        </button>
      </div>
    </form>
  );
}
