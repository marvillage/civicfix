import { useState } from "react";
import { Building2, Clock, MapPin, Pin, Trash2 } from "lucide-react";
import { Avatar } from "../ui";
import {
  BULLETIN_KINDS,
  bulletinTiming,
  formatRange,
} from "./helpers";

export function KindChip({ kind }) {
  const meta = BULLETIN_KINDS[kind] ?? BULLETIN_KINDS.ADVISORY;
  const Icon = meta.icon;

  return (
    <span className={`chip kind-chip kind-${meta.tone}`}>
      <Icon aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function BulletinCard({ bulletin, now, canDelete, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const meta = BULLETIN_KINDS[bulletin.kind] ?? BULLETIN_KINDS.ADVISORY;
  const timing = bulletinTiming(bulletin, now);
  const timingTone =
    timing.phase === "upcoming"
      ? "chip-info"
      : timing.phase === "past"
        ? "chip-outline"
        : timing.soon
          ? "chip-warning"
          : "chip-success";

  async function remove() {
    setBusy(true);

    const ok = await onDelete(bulletin);

    if (!ok) {
      setBusy(false);
      setConfirming(false);
    }
  }

  const author = bulletin.author;
  const byline = [author?.designation, bulletin.department?.name ?? "City admin"]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`bulletin-card kind-edge-${meta.tone} ${bulletin.pinned ? "is-pinned" : ""}`}
      aria-labelledby={`bulletin-${bulletin.id}`}
    >
      <div className="bulletin-tags">
        {bulletin.pinned && (
          <span className="chip chip-accent pinned-marker">
            <Pin aria-hidden="true" />
            Pinned
          </span>
        )}
        <KindChip kind={bulletin.kind} />
        <span className="chip chip-outline">
          <MapPin aria-hidden="true" />
          {bulletin.ward
            ? `${bulletin.ward.name} · ${bulletin.ward.code}`
            : "Citywide"}
        </span>
        <span className={`chip ${timingTone} bulletin-timing`}>
          <Clock aria-hidden="true" />
          {timing.text}
        </span>
      </div>

      <h3 id={`bulletin-${bulletin.id}`}>{bulletin.title}</h3>

      <p className="bulletin-body">{bulletin.body}</p>

      <div className="bulletin-foot">
        <span className="bulletin-author">
          <Avatar user={author} size={30} />
          <span>
            <strong>{author?.name ?? "City staff"}</strong>
            <small>
              <Building2 aria-hidden="true" />
              {byline}
            </small>
          </span>
        </span>

        <time className="bulletin-window" dateTime={bulletin.startsAt}>
          {formatRange(bulletin.startsAt, bulletin.endsAt)}
        </time>

        {canDelete && !confirming && (
          <button
            type="button"
            className="btn-ghost btn-sm bulletin-remove"
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden="true" />
            Remove
          </button>
        )}

        {canDelete && confirming && (
          <span className="inline-confirm" role="group" aria-label="Confirm removal">
            <span>Remove this bulletin?</span>
            <button
              type="button"
              className="btn-danger btn-sm"
              onClick={remove}
              disabled={busy}
            >
              {busy ? "Removing…" : "Remove"}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Keep
            </button>
          </span>
        )}
      </div>
    </article>
  );
}
