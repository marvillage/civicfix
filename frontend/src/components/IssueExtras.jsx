import { useEffect, useState } from "react";
import { Mic, Recycle, Siren, Timer } from "lucide-react";
import { FEATURES } from "../brand";
import { formatDate, formatDateTime, formatHours } from "../lib/format";

// Small pieces of a case that several pages render (Case File,
// My Cases, the officer's job view). Styles: styles/pages/issue.css.

// Once a fix is delivered the Fix Clock stops.
const CLOCK_STOPPED = [
  "RESOLVED",
  "CITIZEN_VERIFICATION",
  "CLOSED",
  "DUPLICATE",
];

// Re-render every `ms` so countdowns stay honest.
function useNow(ms = 60000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);

    return () => clearInterval(timer);
  }, [ms]);

  return now;
}

function fixClock(issue, now) {
  const sla = issue?.sla;
  const end = sla?.deadline ? new Date(sla.deadline).getTime() : NaN;

  if (!Number.isFinite(end)) return null;

  const start = sla.durationMin
    ? end - sla.durationMin * 60000
    : new Date(issue.createdAt).getTime();
  const total = Math.max(1, end - start);
  const pct = Math.min(100, Math.max(0, ((now - start) / total) * 100));

  return {
    end,
    pct,
    hoursLeft: (end - now) / 3600000,
    overdue: !!sla.breached || now > end,
    stopped: CLOCK_STOPPED.includes(issue.status),
  };
}

export function EmergencyBanner({ issue }) {
  if (!issue?.isEmergency) {
    return null;
  }

  return (
    <div className="red-alert-banner" role="note">
      <span className="red-alert-banner-icon" aria-hidden="true">
        <Siren />
      </span>

      <div>
        <strong>{FEATURES.redAlert}</strong>
        <span>
          Flagged as a danger to life or safety. It jumps the queue and
          runs on a short {FEATURES.fixClock}.
        </span>
      </div>
    </div>
  );
}

export function ChronicBadge({ issue }) {
  if (!issue || (issue.reopenCount || 0) < 2) {
    return null;
  }

  return (
    <span
      className="chip chip-warning chronic-chip"
      title={`${FEATURES.repeatOffenders}: the fix has failed ${issue.reopenCount} times`}
    >
      <Recycle aria-hidden="true" />
      Reopened {issue.reopenCount}×
    </span>
  );
}

// Fix Clock: "Expected fix by …" with a progress bar that fills as
// the deadline approaches and turns red once it is missed.
// `bare` drops the frame and label, for cards that already carry a
// "Fix Clock" heading.
export function ExpectedFix({ issue, bare = false }) {
  const now = useNow();
  const clock = fixClock(issue, now);

  if (!clock || clock.stopped) {
    return null;
  }

  const tone = clock.overdue
    ? "meter-bad"
    : clock.pct >= 75
      ? "meter-warn"
      : "";

  return (
    <div
      className={`fix-clock ${clock.overdue ? "is-overdue" : ""} ${bare ? "is-bare" : ""}`}
    >
      <div className="fix-clock-head">
        {!bare && (
          <span className="fix-clock-label">
            <Timer aria-hidden="true" />
            {FEATURES.fixClock}
          </span>
        )}

        <span className="fix-clock-left">
          {clock.overdue
            ? `Overdue by ${formatHours(Math.max(0, -clock.hoursLeft))}`
            : `${formatHours(clock.hoursLeft)} left`}
        </span>
      </div>

      <p className="fix-clock-main">
        {clock.overdue ? "Deadline missed:" : "Expected fix by"}{" "}
        <strong>{formatDateTime(clock.end)}</strong>
      </p>

      <div
        className={`meter ${tone}`}
        role="progressbar"
        aria-label={`${FEATURES.fixClock}: share of the allowed time that has passed`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clock.pct)}
      >
        <span style={{ width: `${clock.pct}%` }} />
      </div>
    </div>
  );
}

// Compact Fix Clock for case lists: "6 h left", "Overdue", "Fix by 12 Oct".
export function FixClockChip({ issue }) {
  const now = useNow();
  const clock = fixClock(issue, now);

  if (!clock || clock.stopped) {
    return null;
  }

  if (clock.overdue) {
    return (
      <span className="chip chip-danger">
        <Timer aria-hidden="true" />
        Overdue
      </span>
    );
  }

  if (clock.pct >= 75 || clock.hoursLeft < 24) {
    return (
      <span className="chip chip-warning">
        <Timer aria-hidden="true" />
        {formatHours(clock.hoursLeft)} left
      </span>
    );
  }

  return (
    <span className="chip chip-outline">
      <Timer aria-hidden="true" />
      Fix by {formatDate(clock.end, { year: undefined })}
    </span>
  );
}

export function VoiceNotes({ complaints }) {
  const withAudio = (complaints || []).filter(
    (complaint) => complaint?.audioUrl
  );

  if (withAudio.length === 0) {
    return null;
  }

  return (
    <div className="voice-notes">
      {withAudio.map((complaint, index) => (
        <div key={complaint.id ?? index} className="voice-note">
          <span className="voice-note-icon" aria-hidden="true">
            <Mic />
          </span>

          <div className="voice-note-body">
            <strong>
              Voice note
              {withAudio.length > 1 ? ` ${index + 1}` : ""}
            </strong>
            <audio controls preload="none" src={complaint.audioUrl}>
              Your browser can't play this voice note.
            </audio>
          </div>
        </div>
      ))}
    </div>
  );
}
