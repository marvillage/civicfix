// Building blocks shared by the citizen and officer workspaces:
// Fix Clock chip + panel, case timeline, photo picker, location
// picker, Civic Cred badges and a back link. Styles: citizen.css
// ("Case kit" section). Pure helpers live in caseUtils.js.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  Camera,
  CircleCheck,
  CircleCheckBig,
  Footprints,
  HeartHandshake,
  ImagePlus,
  LocateFixed,
  Lock,
  MapPin,
  Medal,
  Megaphone,
  Timer,
  TimerOff,
  Trophy,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { FEATURES } from "../brand";
import { formatDuration } from "./caseUtils";
import { STATUS_LABEL } from "../lib/labels";
import { formatDateTime, labelize, timeAgo } from "../lib/format";

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="case-back">
      <ArrowLeft aria-hidden="true" />
      {children}
    </Link>
  );
}

// ─────────────────────────────────────────────
// Fix Clock
// ─────────────────────────────────────────────

const STATE_LABEL = {
  ok: "On track",
  urgent: "Due soon",
  breached: "Breached",
  done: "Done",
};

const CLOCK_ICON = {
  ok: Timer,
  urgent: Timer,
  breached: TimerOff,
  done: CircleCheck,
};

export function FixClockChip({ clock, long = false }) {
  if (!clock) return null;

  const Icon = CLOCK_ICON[clock.state] ?? Timer;

  return (
    <span className={`chip fix-chip fix-chip-${clock.state}`}>
      <Icon aria-hidden="true" />
      <span className="sr-only">{FEATURES.fixClock}: </span>
      {long || clock.state === "breached" || clock.state === "done"
        ? clock.label
        : `${clock.short} left`}
    </span>
  );
}

export function FixClockPanel({ clock }) {
  if (!clock) {
    return (
      <div className="fix-panel">
        <span className="detail-label">{FEATURES.fixClock}</span>
        <p className="fix-panel-empty">
          No deadline yet. The clock starts once the case is routed to
          a department.
        </p>
      </div>
    );
  }

  const live = clock.state === "ok" || clock.state === "urgent";
  const overBy = clock.remainingMs < 0 ? formatDuration(-clock.remainingMs) : "";
  const Icon = CLOCK_ICON[clock.state] ?? Timer;

  return (
    <div className={`fix-panel fix-panel-${clock.state}`}>
      <div className="fix-panel-top">
        <span className="detail-label">{FEATURES.fixClock}</span>
        <span className={`chip fix-chip fix-chip-${clock.state}`}>
          <Icon aria-hidden="true" />
          {STATE_LABEL[clock.state]}
        </span>
      </div>

      <strong className="fix-panel-big">
        {live
          ? clock.short
          : clock.state === "breached"
            ? overBy || "Past deadline"
            : clock.label}
        {live && <small> to go</small>}
        {clock.state === "breached" && overBy && <small> over</small>}
      </strong>

      <div
        className="fix-track"
        role="progressbar"
        aria-label="Share of the Fix Clock used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clock.progress)}
      >
        <span style={{ width: `${clock.progress}%` }} />
      </div>

      <p className="fix-panel-foot">
        Deadline {formatDateTime(clock.deadline)}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────

export function CaseTimeline({ history }) {
  const items = history ?? [];

  if (items.length === 0) {
    return <p className="empty-inline">No updates yet.</p>;
  }

  return (
    <ol className="timeline case-timeline">
      {items.map((entry, index) => {
        const isLast = index === items.length - 1;
        const isSiteUpdate =
          entry.status === "IN_PROGRESS" &&
          items[index - 1]?.status === "IN_PROGRESS";

        return (
          <li
            key={entry.id ?? index}
            className={`timeline-item ${isLast ? "timeline-item-last" : ""} ${
              isSiteUpdate ? "is-site-update" : ""
            }`}
          >
            <span className="timeline-marker" aria-hidden="true" />

            <div className="timeline-content">
              <div className="timeline-title-row">
                <strong>
                  {isSiteUpdate
                    ? "Site update"
                    : (STATUS_LABEL[entry.status] ?? labelize(entry.status))}
                </strong>
                {isLast && <span className="timeline-current">Now</span>}
              </div>

              {entry.note && <p>{entry.note}</p>}

              {entry.imageUrl && (
                <img
                  className="timeline-photo"
                  src={entry.imageUrl}
                  alt="Photo attached to this update"
                  loading="lazy"
                />
              )}

              <time dateTime={entry.createdAt}>
                {formatDateTime(entry.createdAt)} ·{" "}
                {timeAgo(entry.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────
// Photo picker (≤ max images, previews, remove)
// ─────────────────────────────────────────────

function PreviewThumb({ file, index, onRemove, showCover }) {
  const [url, setUrl] = useState(null);

  // Object URLs are an external resource: create on mount, revoke on
  // unmount. (A memoised URL would be revoked by StrictMode re-mounts.)
  useEffect(() => {
    const next = URL.createObjectURL(file);
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(next);

    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <li className="pick-preview">
      {url && <img src={url} alt={`Selected photo ${index + 1}`} />}

      {showCover && index === 0 && <span className="pick-cover">Cover</span>}

      <button
        type="button"
        className="pick-remove"
        onClick={onRemove}
        aria-label={`Remove photo ${index + 1}`}
      >
        <X aria-hidden="true" />
      </button>
    </li>
  );
}

export function PhotoPicker({ id, files, onChange, max = 5, label }) {
  const full = files.length >= max;

  function handlePick(event) {
    const picked = [...(event.target.files || [])];

    onChange([...files, ...picked].slice(0, max));
    event.target.value = "";
  }

  return (
    <div className="pick-photos">
      {files.length > 0 && (
        <ul className="pick-previews">
          {files.map((file, index) => (
            <PreviewThumb
              key={`${file.name}-${file.lastModified}-${index}`}
              file={file}
              index={index}
              showCover={max > 1}
              onRemove={() =>
                onChange(files.filter((_, i) => i !== index))
              }
            />
          ))}
        </ul>
      )}

      <label
        className={`pick-drop ${files.length ? "is-compact" : ""} ${
          full ? "is-full" : ""
        }`}
        htmlFor={id}
      >
        <input
          id={id}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={handlePick}
          disabled={full}
        />

        <span className="pick-drop-icon" aria-hidden="true">
          {files.length ? <ImagePlus /> : <Camera />}
        </span>

        <span className="pick-drop-text">
          <strong>
            {full
              ? max === 1
                ? "Photo added"
                : `${max} of ${max} photos added`
              : files.length
                ? "Add another photo"
                : (label ?? "Take or choose photos")}
          </strong>
          <span>
            {full
              ? max === 1
                ? "Remove it to choose another."
                : "Remove one to swap it out."
              : max === 1
                ? "Straight from your camera or gallery."
                : `Up to ${max}. The first one is the cover.`}
          </span>
        </span>
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────
// Location picker (GPS + manual coordinates)
// ─────────────────────────────────────────────

export function LocationPicker({
  idPrefix,
  latitude,
  longitude,
  setLatitude,
  setLongitude,
  address,
  onError,
  hint = "Stand at the spot and tap the button, or type coordinates.",
}) {
  const [locating, setLocating] = useState(false);

  function locate() {
    onError?.("");

    if (!navigator.geolocation) {
      onError?.("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
      },
      () => {
        setLocating(false);
        onError?.(
          "Unable to get your location. Please allow location access."
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="pick-geo">
      <div className="pick-geo-head">
        <button
          type="button"
          className="btn-secondary"
          onClick={locate}
          disabled={locating}
        >
          {locating ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <LocateFixed aria-hidden="true" />
          )}
          {locating ? "Finding you…" : "Use my location"}
        </button>
        <span className="field-hint">{hint}</span>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-lat`}>Latitude</label>
          <input
            id={`${idPrefix}-lat`}
            type="text"
            inputMode="decimal"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="28.6139"
            required
          />
        </div>

        <div className="field">
          <label htmlFor={`${idPrefix}-lng`}>Longitude</label>
          <input
            id={`${idPrefix}-lng`}
            type="text"
            inputMode="decimal"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="77.2090"
            required
          />
        </div>
      </div>

      {address && (
        <p className="pick-geo-address" aria-live="polite">
          <MapPin aria-hidden="true" />
          {address}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Civic Cred badges
// ─────────────────────────────────────────────

// The API sends an emoji per badge; the UI uses its own icons.
const BADGE_ICON = {
  "first-report": Megaphone,
  streetwise: Footprints,
  "civic-hero": Medal,
  fixer: Wrench,
  "change-maker": Trophy,
  "closing-the-loop": CircleCheckBig,
  "popular-voice": Users,
  supporter: HeartHandshake,
};

export function BadgeGrid({ badges, compact = false }) {
  if (!badges?.length) return null;

  return (
    <ul className={`cred-badges ${compact ? "is-compact" : ""}`}>
      {badges.map((badge) => {
        const Icon = BADGE_ICON[badge.id] ?? Award;

        return (
          <li
            key={badge.id}
            className={`cred-badge ${badge.earned ? "is-earned" : "is-locked"}`}
            title={badge.description}
          >
            <span className="cred-medal" aria-hidden="true">
              <Icon />
              {!badge.earned && (
                <span className="cred-lock">
                  <Lock />
                </span>
              )}
            </span>
            <span className="cred-badge-text">
              <strong>{badge.name}</strong>
              {!compact && <small>{badge.description}</small>}
              <span className="sr-only">
                {badge.earned ? "Earned" : "Not earned yet"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
