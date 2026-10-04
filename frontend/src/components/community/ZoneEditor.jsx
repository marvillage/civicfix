import { Save } from "lucide-react";
import { CATEGORIES, CATEGORY_META } from "../../lib/labels";
import LocationFields from "./LocationFields";
import { formatMeters } from "./helpers";

const RADIUS_MIN = 100;
const RADIUS_MAX = 5000;

// Create / edit form for a Watch Zone. The centre is picked on the
// page's map (click) or with LocationFields (geolocation or typed
// coordinates), so the form works without a pointer.
export default function ZoneEditor({
  draft,
  isEdit,
  saving,
  error,
  onChange,
  onMove,
  onSubmit,
  onCancel,
}) {
  const allCategories = draft.categories.length === 0;

  function toggleCategory(category) {
    const has = draft.categories.includes(category);

    onChange({
      categories: has
        ? draft.categories.filter((item) => item !== category)
        : [...draft.categories, category],
    });
  }

  return (
    <form
      className="card zone-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
      aria-labelledby="zone-editor-title"
    >
      <div className="zone-editor-head">
        <p className="eyebrow">{isEdit ? "Edit zone" : "New zone"}</p>
        <h2 id="zone-editor-title">
          {isEdit ? `Edit “${draft.originalName}”` : "Draw a Watch Zone"}
        </h2>
        <p>Click the map to place the centre, then size the circle.</p>
      </div>

      <div className="field">
        <label htmlFor="zone-name">Name</label>
        <input
          id="zone-name"
          value={draft.name}
          maxLength={40}
          placeholder="e.g. Home, School run, Shop"
          onChange={(event) => onChange({ name: event.target.value })}
          required
        />
      </div>

      <div className="field">
        <div className="range-head">
          <label htmlFor="zone-radius">Radius</label>
          <output htmlFor="zone-radius">{formatMeters(draft.radiusM)}</output>
        </div>
        <input
          id="zone-radius"
          type="range"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          step={50}
          value={draft.radiusM}
          aria-valuetext={formatMeters(draft.radiusM)}
          onChange={(event) => onChange({ radiusM: Number(event.target.value) })}
        />
        <div className="range-scale" aria-hidden="true">
          <span>100 m</span>
          <span>5 km</span>
        </div>
      </div>

      <fieldset className="field zone-fieldset">
        <legend>Centre</legend>
        <LocationFields
          idPrefix="zone"
          latitude={draft.latitude}
          longitude={draft.longitude}
          onChange={onMove}
        />
      </fieldset>

      <fieldset className="field zone-fieldset">
        <legend>Categories</legend>
        <p className="field-hint">
          {allCategories
            ? "Alerting on every kind of case. Pick some to narrow it down."
            : `Alerting on ${draft.categories.length} of ${CATEGORIES.length} kinds of case.`}
        </p>
        <div className="chip-filter">
          {CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            const on = draft.categories.includes(category);

            return (
              <button
                key={category}
                type="button"
                className={`filter-chip category-toggle ${on ? "is-active" : ""}`}
                aria-pressed={on}
                onClick={() => toggleCategory(category)}
              >
                <span className={`cat-dot cat-${category}`} aria-hidden="true" />
                <Icon aria-hidden="true" />
                {meta.label}
              </button>
            );
          })}
        </div>
        {!allCategories && (
          <button
            type="button"
            className="btn-ghost btn-sm zone-all"
            onClick={() => onChange({ categories: [] })}
          >
            Alert on every category
          </button>
        )}
      </fieldset>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="button-row">
        <button type="submit" className="btn-accent" disabled={saving}>
          <Save aria-hidden="true" />
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create zone"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
