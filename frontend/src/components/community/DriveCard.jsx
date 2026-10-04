import { Link } from "react-router-dom";
import { CircleCheck, Clock, FileText, MapPin, Star } from "lucide-react";
import { Avatar } from "../ui";
import { driveState, formatWhen } from "./helpers";

// "Central Park Gate · Model Town", without repeating the ward
// when the address already names it.
function placeLabel(drive) {
  const address = drive.address?.trim();
  const ward = drive.ward?.name;

  if (address && ward && !address.toLowerCase().includes(ward.toLowerCase())) {
    return `${address} · ${ward}`;
  }

  return address || ward || "Location on the map";
}

export function DriveStatusChip({ drive, now }) {
  const state = driveState(drive, now);

  return <span className={`chip chip-${state.tone}`}>{state.label}</span>;
}

// "18 of 30 joined" with a fill bar. Fill reads capacity, not a
// grade, so it keeps one neutral tone whatever the level.
export function CapacityMeter({ drive, large = false }) {
  const pct = Math.min(100, (drive.rsvpCount / Math.max(1, drive.capacity)) * 100);
  const left = Math.max(0, drive.capacity - drive.rsvpCount);
  const done = drive.status === "COMPLETED";

  return (
    <div className={`capacity ${large ? "capacity-large" : ""}`}>
      <div className="capacity-labels">
        <span>
          <strong>{drive.rsvpCount}</strong> of {drive.capacity} joined
        </span>
        <span className="capacity-left">
          {done
            ? `${drive.attendedCount} turned up`
            : left === 0
              ? "Full"
              : `${left} ${left === 1 ? "spot" : "spots"} left`}
        </span>
      </div>
      <div
        className={`capacity-bar ${left === 0 && !done ? "is-full" : ""}`}
        role="meter"
        aria-label="Volunteers joined"
        aria-valuemin={0}
        aria-valuemax={drive.capacity}
        aria-valuenow={drive.rsvpCount}
        aria-valuetext={`${drive.rsvpCount} of ${drive.capacity} joined`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DateTile({ value }) {
  const date = new Date(value);

  return (
    <span className="date-tile" aria-hidden="true">
      <span className="date-tile-month">
        {date.toLocaleDateString("en-IN", { month: "short" })}
      </span>
      <strong>{date.getDate()}</strong>
      <span className="date-tile-day">
        {date.toLocaleDateString("en-IN", { weekday: "short" })}
      </span>
    </span>
  );
}

export default function DriveCard({ drive, now }) {
  return (
    <article className="card drive-card" aria-labelledby={`drive-${drive.id}`}>
      <div className="drive-card-top">
        <DateTile value={drive.startsAt} />

        <div className="drive-card-head">
          <div className="drive-chips">
            <DriveStatusChip drive={drive} now={now} />
            {drive.isOrganizer && (
              <span className="chip chip-navy">
                <Star aria-hidden="true" />
                You organise
              </span>
            )}
            {drive.myRsvp && (
              <span className="chip chip-success">
                <CircleCheck aria-hidden="true" />
                {drive.myRsvp.attended ? "You attended" : "You're going"}
              </span>
            )}
          </div>

          <h3 id={`drive-${drive.id}`}>
            <Link to={`/drives/${drive.id}`} className="drive-card-link">
              {drive.title}
            </Link>
          </h3>
        </div>
      </div>

      <ul className="drive-facts">
        <li>
          <Clock aria-hidden="true" />
          <time dateTime={drive.startsAt}>{formatWhen(drive.startsAt)}</time>
        </li>
        <li>
          <MapPin aria-hidden="true" />
          <span>
            {placeLabel(drive)}
          </span>
        </li>
        {drive.issue && (
          <li>
            <FileText aria-hidden="true" />
            <span className="drive-case">For: {drive.issue.title}</span>
          </li>
        )}
      </ul>

      {drive.status !== "PROPOSED" && drive.status !== "REJECTED" && (
        <CapacityMeter drive={drive} />
      )}

      <div className="drive-card-foot">
        <Avatar user={drive.organizer} size={28} />
        <span>
          Organised by <strong>{drive.organizer?.name}</strong>
        </span>
      </div>
    </article>
  );
}
