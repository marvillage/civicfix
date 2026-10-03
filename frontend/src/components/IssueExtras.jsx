export function EmergencyBanner({ issue }) {
  if (!issue?.isEmergency) {
    return null;
  }

  return (
    <div className="emergency-banner">
      🚨 <strong>Emergency report</strong> — flagged
      as a safety hazard and prioritised.
    </div>
  );
}

export function ChronicBadge({ issue }) {
  if (!issue || (issue.reopenCount || 0) < 2) {
    return null;
  }

  return (
    <span className="chronic-badge">
      ♻ Chronic — reopened {issue.reopenCount} times
    </span>
  );
}

export function ExpectedFix({ issue }) {
  const sla = issue?.sla;

  if (
    !sla ||
    ["RESOLVED", "CLOSED", "DUPLICATE"].includes(
      issue.status
    )
  ) {
    return null;
  }

  const start = new Date(issue.createdAt).getTime();
  const end = new Date(sla.deadline).getTime();
  const now = Date.now();

  const progress = Math.min(
    100,
    Math.max(
      0,
      ((now - start) / (end - start)) * 100
    )
  );

  const overdue = now > end || sla.breached;

  const deadlineLabel = new Date(
    sla.deadline
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="expected-fix">
      <div className="expected-fix-row">
        <span>
          {overdue
            ? "⚠ Fix deadline missed"
            : "Expected fix by"}
        </span>
        <strong>{deadlineLabel}</strong>
      </div>

      <div className="expected-fix-track">
        <div
          className={`expected-fix-bar ${
            overdue ? "expected-fix-overdue" : ""
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function VoiceNotes({ complaints }) {
  const withAudio = (complaints || []).filter(
    (complaint) => complaint.audioUrl
  );

  if (withAudio.length === 0) {
    return null;
  }

  return (
    <div className="voice-notes">
      {withAudio.map((complaint) => (
        <div
          key={complaint.id}
          className="voice-note-row"
        >
          <span>🎙 Voice note</span>
          <audio controls src={complaint.audioUrl} />
        </div>
      ))}
    </div>
  );
}
