import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CircleCheck,
  CircleX,
  Clock,
  FileText,
  HandHeart,
  MapPin,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import {
  Avatar,
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import MiniMap from "../../components/community/MiniMap";
import {
  CapacityMeter,
  DriveStatusChip,
} from "../../components/community/DriveCard";
import {
  apiMessage,
  apiStatus,
  formatSpan,
  formatWhen,
  useNow,
} from "../../components/community/helpers";
import { formatDateTime } from "../../lib/format";

function flashClass(tone) {
  if (tone === "success") return "form-success";
  if (tone === "warning") return "alert alert-warning";
  if (tone === "error") return "form-error";
  return "form-info";
}

// Join / leave. Shown in the header so it's the first thing on
// every screen size.
function RsvpAction({ drive, started, busy, onRsvp }) {
  const { can, isAuthenticated } = useAuth();
  const location = useLocation();
  const full = drive.rsvpCount >= drive.capacity;

  if (drive.status !== "APPROVED" || started || drive.isOrganizer) return null;

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        state={{ from: location.pathname }}
        className="btn btn-accent"
      >
        <HandHeart aria-hidden="true" />
        Log in to join
      </Link>
    );
  }

  if (!can("drive:join")) return null;

  if (drive.myRsvp) {
    return (
      <button
        type="button"
        className="btn-danger-ghost"
        onClick={() => onRsvp(false)}
        disabled={busy}
      >
        <CircleX aria-hidden="true" />
        {busy ? "Leaving…" : "Cancel my RSVP"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn-accent"
      onClick={() => onRsvp(true)}
      disabled={busy || full}
    >
      <HandHeart aria-hidden="true" />
      {full ? "Drive is full" : busy ? "Joining…" : "Join this drive"}
    </button>
  );
}

function JoinState({ drive, started, now }) {
  const { can, isAuthenticated } = useAuth();
  const start = Date.parse(drive.startsAt);
  const full = drive.rsvpCount >= drive.capacity;

  if (drive.status === "PROPOSED") {
    return (
      <p className="join-state">
        <ShieldCheck aria-hidden="true" />
        Waiting for a moderator. Volunteers can join once it's approved.
      </p>
    );
  }

  if (drive.status === "REJECTED") {
    return (
      <p className="join-state">
        <CircleX aria-hidden="true" />
        This proposal wasn't approved.
      </p>
    );
  }

  if (drive.status === "COMPLETED") {
    return (
      <p className="join-state">
        <CircleCheck aria-hidden="true" />
        Done. {drive.attendedCount} of {drive.rsvpCount} volunteers turned up.
      </p>
    );
  }

  if (started) {
    return (
      <p className="join-state">
        <Clock aria-hidden="true" />
        Started {formatSpan(now - start)} ago. RSVPs are closed.
      </p>
    );
  }

  if (drive.isOrganizer) {
    return (
      <p className="join-state">
        <UserCheck aria-hidden="true" />
        You're organising this drive. Share the link to fill it up.
      </p>
    );
  }

  if (drive.myRsvp) {
    return (
      <p className="join-state is-good">
        <CircleCheck aria-hidden="true" />
        You're going. Starts in {formatSpan(start - now)}.
      </p>
    );
  }

  if (isAuthenticated && !can("drive:join")) {
    return (
      <p className="join-state">
        <Users aria-hidden="true" />
        Joining is open to resident accounts.
      </p>
    );
  }

  return (
    <p className="join-state">
      <Clock aria-hidden="true" />
      {full
        ? "Every spot is taken. Check back in case someone drops out."
        : `Starts in ${formatSpan(start - now)}. RSVPs close when it starts.`}
    </p>
  );
}

function AttendancePanel({ drive, rsvps, onRecorded }) {
  const [checked, setChecked] = useState(
    () => new Set(rsvps.filter((rsvp) => rsvp.attended).map((rsvp) => rsvp.user.id))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const alreadyMarked = new Set(
    rsvps.filter((rsvp) => rsvp.attended).map((rsvp) => rsvp.user.id)
  );
  const newlyChecked = [...checked].filter((id) => !alreadyMarked.has(id));
  const allChecked = rsvps.every((rsvp) => checked.has(rsvp.user.id));

  function toggle(userId) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();

    if (newlyChecked.length === 0) {
      setError("Tick at least one volunteer who turned up.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await api.post(`/drives/${drive.id}/attendance`, {
        userIds: [...checked],
      });

      onRecorded(response.data.drive, newlyChecked.length);
    } catch (saveError) {
      setError(apiMessage(saveError, "Couldn't record attendance."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="attendance" noValidate>
      <div className="attendance-head">
        <p className="field-hint">
          Tick who actually turned up. Each attendee gets +15{" "}
          {FEATURES.civicCred}; the organiser gets +25 once. Marks can be
          added later but not removed.
        </p>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() =>
            setChecked(
              allChecked
                ? new Set(alreadyMarked)
                : new Set(rsvps.map((rsvp) => rsvp.user.id))
            )
          }
        >
          {allChecked ? "Clear new ticks" : "Tick everyone"}
        </button>
      </div>

      <ul className="volunteer-list is-checklist">
        {rsvps.map((rsvp) => {
          const locked = alreadyMarked.has(rsvp.user.id);

          return (
            <li key={rsvp.user.id}>
              <label className={`volunteer ${checked.has(rsvp.user.id) ? "is-checked" : ""}`}>
                <input
                  type="checkbox"
                  checked={checked.has(rsvp.user.id)}
                  disabled={locked}
                  onChange={() => toggle(rsvp.user.id)}
                />
                <Avatar user={rsvp.user} size={28} />
                <span className="volunteer-name">{rsvp.user.name}</span>
                {locked && <span className="chip chip-success">Marked</span>}
              </label>
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="button-row">
        <button type="submit" className="btn-accent" disabled={saving}>
          <UserCheck aria-hidden="true" />
          {saving
            ? "Saving…"
            : `Record attendance${newlyChecked.length ? ` (${newlyChecked.length})` : ""}`}
        </button>
        {newlyChecked.length > 0 && (
          <span className="field-hint">
            +{newlyChecked.length * 15} {FEATURES.civicCred} for volunteers
          </span>
        )}
      </div>
    </form>
  );
}

function ModerationPanel({ drive, onModerated, started }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function decide(decision) {
    if (decision === "REJECT" && note.trim().length < 5) {
      setError("Tell the organiser why, so they can fix it and propose again.");
      return;
    }

    setBusy(decision);
    setError("");

    try {
      const body = { decision };
      if (note.trim()) body.note = note.trim();

      const response = await api.post(`/drives/${drive.id}/moderate`, body);

      onModerated(response.data.drive, decision);
    } catch (moderateError) {
      setError(apiMessage(moderateError, "Couldn't save the decision."));
      setBusy("");
    }
  }

  return (
    <section className="card card-accent moderation" aria-labelledby="moderation-title">
      <p className="eyebrow">Moderation</p>
      <h2 id="moderation-title">Review this proposal</h2>
      <p className="section-lede">
        Check the place is safe and not an active work site, and that the
        time works. The organiser is notified of your decision.
      </p>

      <div className="field">
        <label htmlFor="moderation-note">Note to the organiser</label>
        <textarea
          id="moderation-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional when approving. Needed when sending it back."
        />
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {started && (
        <p className="field-hint">
          The start time has passed, so this proposal can only be rejected.
        </p>
      )}

      <div className="button-row">
        <button
          type="button"
          className="btn-accent"
          onClick={() => decide("APPROVE")}
          disabled={!!busy || started}
        >
          <CircleCheck aria-hidden="true" />
          {busy === "APPROVE" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          className="btn-danger-ghost"
          onClick={() => decide("REJECT")}
          disabled={!!busy}
        >
          <CircleX aria-hidden="true" />
          {busy === "REJECT" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </section>
  );
}

export default function DriveDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { can } = useAuth();
  const now = useNow(30_000);

  const [drive, setDrive] = useState(null);
  const [rsvps, setRsvps] = useState(null);
  // Which drive the loaded data belongs to; loading is derived.
  const [status, setStatus] = useState({ id: null, missing: false, error: "" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(() =>
    location.state?.sent
      ? {
          tone: "success",
          text: "Sent for review. A moderator checks every proposal before it's listed, and we'll alert you when it's approved.",
        }
      : null
  );

  // The "sent" flag is one-shot: drop it from history so a reload
  // doesn't show the banner again.
  useEffect(() => {
    if (location.state?.sent) {
      window.history.replaceState({ ...window.history.state, usr: null }, "");
    }
  }, [location.state]);

  // Refresh after an action (RSVP list, attendance, moderation).
  const load = useCallback(async () => {
    const response = await api.get(`/drives/${id}`);
    setDrive(response.data.drive);
    setRsvps(response.data.rsvps ?? null);
  }, [id]);

  useEffect(() => {
    let active = true;

    api
      .get(`/drives/${id}`)
      .then((response) => {
        if (!active) return;

        setDrive(response.data.drive);
        setRsvps(response.data.rsvps ?? null);
        setStatus({ id, missing: false, error: "" });
      })
      .catch((fetchError) => {
        if (!active) return;

        const missing = apiStatus(fetchError) === 404;

        setStatus({
          id,
          missing,
          error: missing ? "" : apiMessage(fetchError, "Couldn't load this drive."),
        });
      });

    return () => {
      active = false;
    };
  }, [id]);

  const loading = status.id !== id;
  const { missing, error } = status;

  async function handleRsvp(join) {
    setBusy(true);
    setFlash(null);

    try {
      const response = join
        ? await api.post(`/drives/${id}/rsvp`)
        : await api.delete(`/drives/${id}/rsvp`);

      setDrive(response.data.drive);
      setFlash(
        join
          ? {
              tone: "success",
              text: `You're in. See you ${formatWhen(response.data.drive.startsAt)}.`,
            }
          : {
              tone: "info",
              text: "You've left this drive. Your spot is open for someone else.",
            }
      );
    } catch (rsvpError) {
      const status = apiStatus(rsvpError);

      setFlash({
        tone: status === 409 ? "warning" : "error",
        text: apiMessage(rsvpError, "Couldn't update your RSVP."),
      });

      // Full, already joined or already started: show the real state.
      if (status === 409 || status === 400) {
        load().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  function handleRecorded(next, count) {
    setDrive(next);
    setFlash({
      tone: "success",
      text: `Attendance recorded for ${count} ${count === 1 ? "volunteer" : "volunteers"}. The drive is marked complete.`,
    });
    load().catch(() => {});
  }

  function handleModerated(next, decision) {
    setDrive(next);
    setFlash(
      decision === "APPROVE"
        ? { tone: "success", text: "Approved. It's now listed under Upcoming and residents can join." }
        : { tone: "info", text: "Sent back to the organiser with your note." }
    );
    load().catch(() => {});
  }

  const back = (
    <Link to="/drives" className="back-link">
      <ArrowLeft aria-hidden="true" />
      All drives
    </Link>
  );

  if (loading) return <Loading label="Loading the drive…" />;

  if (missing || !drive) {
    return (
      <div className="page">
        {back}
        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : (
          <EmptyState icon={HandHeart} title="This drive isn't available">
            It may still be waiting for review, or the link is wrong.
          </EmptyState>
        )}
      </div>
    );
  }

  const start = Date.parse(drive.startsAt);
  const started = start <= now;
  const canManage = drive.isOrganizer || can("drive:moderate");
  const attendanceOpen =
    canManage &&
    started &&
    (drive.status === "APPROVED" || drive.status === "COMPLETED") &&
    rsvps &&
    rsvps.length > 0;

  return (
    <div className="page drive-detail">
      {back}

      <PageHeader
        eyebrow={FEATURES.drives}
        title={drive.title}
        actions={
          <RsvpAction
            drive={drive}
            started={started}
            busy={busy}
            onRsvp={handleRsvp}
          />
        }
      >
        <div className="drive-chips page-subhead">
          <DriveStatusChip drive={drive} now={now} />
          {drive.isOrganizer && (
            <span className="chip chip-navy">You organise this</span>
          )}
          {drive.myRsvp && (
            <span className="chip chip-success">
              <CircleCheck aria-hidden="true" />
              {drive.myRsvp.attended ? "You attended" : "You're going"}
            </span>
          )}
          <span className="poll-timing">
            <Clock aria-hidden="true" />
            {formatWhen(drive.startsAt)}
          </span>
        </div>
      </PageHeader>

      {flash && (
        <div className={flashClass(flash.tone)} role="status">
          {flash.text}
        </div>
      )}

      {drive.status === "REJECTED" && (
        <div className="alert alert-warning" role="note">
          <span>
            <strong>Not approved.</strong>{" "}
            {drive.moderationNote || "A moderator sent this proposal back."}
          </span>
        </div>
      )}

      <div className="grid-main-side">
        <div className="stack drive-main">
          {can("drive:moderate") && drive.status === "PROPOSED" && (
            <ModerationPanel
              drive={drive}
              started={started}
              onModerated={handleModerated}
            />
          )}

          <section className="card" aria-labelledby="drive-about">
            <h2 id="drive-about" className="rail-title">
              About this drive
            </h2>
            <p className="drive-description">{drive.description}</p>

            <dl className="details-grid drive-details">
              <div className="detail-item">
                <dt className="detail-label">When</dt>
                <dd className="detail-value">{formatDateTime(drive.startsAt)}</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Meeting point</dt>
                <dd className="detail-value">{drive.address || "Pinned on the map"}</dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Ward</dt>
                <dd className="detail-value">
                  {drive.ward ? `${drive.ward.name} (${drive.ward.code})` : "—"}
                </dd>
              </div>
              <div className="detail-item">
                <dt className="detail-label">Organiser</dt>
                <dd className="detail-value drive-organizer">
                  <Avatar user={drive.organizer} size={26} />
                  {drive.organizer?.name}
                </dd>
              </div>
            </dl>

            {drive.issue && (
              <Link to={`/issues/${drive.issue.id}`} className="linked-case drive-linked-case">
                <FileText aria-hidden="true" />
                <span>
                  <small>Cleaning up after</small>
                  <strong>{drive.issue.title}</strong>
                  <span className="meta-row">
                    <CategoryChip category={drive.issue.category} short />
                    <StatusBadge status={drive.issue.status} />
                    <span>Open the {FEATURES.caseFile}</span>
                  </span>
                </span>
              </Link>
            )}
          </section>

          <section className="card card-flush" aria-label="Meeting point map">
            <MiniMap
              markers={[
                {
                  id: drive.id,
                  lat: drive.latitude,
                  lng: drive.longitude,
                  label: drive.address || drive.title,
                },
              ]}
              zoom={16}
              height={280}
              label={`Map: meeting point${drive.address ? ` at ${drive.address}` : ""}`}
            />
            <div className="map-caption">
              <span>
                <MapPin aria-hidden="true" />
                {drive.address || "Meeting point"}
              </span>
              <a
                className="text-link"
                href={`https://www.openstreetmap.org/?mlat=${drive.latitude}&mlon=${drive.longitude}#map=17/${drive.latitude}/${drive.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in OpenStreetMap
              </a>
            </div>
          </section>

          {canManage && rsvps && drive.status !== "PROPOSED" && drive.status !== "REJECTED" && (
            <section className="card" aria-labelledby="drive-volunteers">
              <div className="section-head">
                <div>
                  <p className="eyebrow">
                    {drive.isOrganizer ? "Your volunteers" : "Volunteers"}
                  </p>
                  <h2 id="drive-volunteers">
                    {attendanceOpen ? "Who turned up?" : `${rsvps.length} signed up`}
                  </h2>
                </div>
              </div>

              {rsvps.length === 0 ? (
                <p className="empty-inline">
                  No one has joined yet. Share the drive with your neighbours.
                </p>
              ) : attendanceOpen ? (
                <AttendancePanel
                  key={rsvps.filter((rsvp) => rsvp.attended).length}
                  drive={drive}
                  rsvps={rsvps}
                  onRecorded={handleRecorded}
                />
              ) : (
                <>
                  <ul className="volunteer-list">
                    {rsvps.map((rsvp) => (
                      <li key={rsvp.user.id} className="volunteer">
                        <Avatar user={rsvp.user} size={28} />
                        <span className="volunteer-name">{rsvp.user.name}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="field-hint attendance-later">
                    Attendance opens when the drive starts, {formatWhen(drive.startsAt)}.
                    Each volunteer you mark present gets +15 {FEATURES.civicCred}.
                  </p>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="stack feature-rail" aria-label="Joining">
          <section className="card join-card">
            <h2 className="rail-title">Volunteers</h2>
            {drive.status !== "PROPOSED" && drive.status !== "REJECTED" && (
              <CapacityMeter drive={drive} large />
            )}
            <JoinState drive={drive} started={started} now={now} />
          </section>

          <section className="card card-navy rail-callout">
            <span className="rail-callout-icon" aria-hidden="true">
              <Award />
            </span>
            <h2>+15 {FEATURES.civicCred} per attendee</h2>
            <p>
              The organiser marks who turned up once the drive starts.
              Everyone marked present gets +15, and the organiser +25 for
              running it.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
