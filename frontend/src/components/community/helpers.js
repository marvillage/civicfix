// Shared, non-visual helpers for the community features
// (Ward Bulletins, Watch Zones, Ward Vote, Cleanup Drives).

import { useEffect, useState } from "react";
import { CalendarDays, Info, TrafficCone, ZapOff } from "lucide-react";
import api from "../../api/axios";
import { formatDate } from "../../lib/format";

// Default map view: the city centre used by the seeded wards.
export const CITY_CENTER = [28.6175, 77.214];

export const BULLETIN_KINDS = {
  OUTAGE: { label: "Outage", icon: ZapOff, tone: "outage" },
  ROADWORKS: { label: "Roadworks", icon: TrafficCone, tone: "roadworks" },
  ADVISORY: { label: "Advisory", icon: Info, tone: "advisory" },
  EVENT: { label: "Event", icon: CalendarDays, tone: "event" },
};

export const BULLETIN_KIND_KEYS = Object.keys(BULLETIN_KINDS);

// The API's error message, or a friendly fallback.
export function apiMessage(error, fallback = "Something went wrong. Try again.") {
  return error?.response?.data?.message || fallback;
}

export function apiStatus(error) {
  return error?.response?.status ?? null;
}

// Re-renders every `intervalMs` so countdowns stay true.
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

// 45 min · 3 h · 2 d (for "Ends in …" / "… ago")
export function formatSpan(ms) {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.round(minutes / 60);

  if (hours < 48) return `${hours} h`;

  return `${Math.round(hours / 24)} d`;
}

// 80 m · 450 m · 1.2 km · 5 km
export function formatMeters(meters) {
  if (meters == null || Number.isNaN(Number(meters))) return "—";

  const value = Number(meters);

  if (value < 1000) return `${Math.round(value / 10) * 10 || Math.round(value)} m`;

  return `${(value / 1000).toFixed(1).replace(/\.0$/, "")} km`;
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Sat, 5 Oct · 7:30 am"
export function formatWhen(value) {
  const date = new Date(value);

  return `${date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${formatTime(date)}`;
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// "4 Oct, 10:00 am – 6:00 pm" · "4 Oct, 10:00 am – 6 Oct, 9:00 am"
export function formatRange(startsAt, endsAt) {
  const start = new Date(startsAt);
  const day = (date) =>
    date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const head = `${day(start)}, ${formatTime(start)}`;

  if (!endsAt) return `From ${head}`;

  const end = new Date(endsAt);

  return sameDay(start, end)
    ? `${head} – ${formatTime(end)}`
    : `${head} – ${day(end)}, ${formatTime(end)}`;
}

// The time window of a bulletin in words, relative to `now`.
export function bulletinTiming(bulletin, now = Date.now()) {
  const start = Date.parse(bulletin.startsAt);
  const end = bulletin.endsAt ? Date.parse(bulletin.endsAt) : null;

  if (start > now) {
    return { phase: "upcoming", text: `Starts in ${formatSpan(start - now)}` };
  }

  if (end != null && end <= now) {
    return { phase: "past", text: `Ended ${formatSpan(now - end)} ago` };
  }

  if (end == null) return { phase: "active", text: "Until further notice" };

  return {
    phase: "active",
    text: `Ends in ${formatSpan(end - now)}`,
    soon: end - now < 6 * 3_600_000,
  };
}

// <input type="datetime-local"> value in local time.
export function toLocalInput(value) {
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Rounds a timestamp up to the next quarter hour.
export function nextQuarter(ms) {
  const quarter = 15 * 60_000;
  return Math.ceil(ms / quarter) * quarter;
}

export function wardLabel(ward) {
  return ward ? `${ward.name} (${ward.code})` : "Citywide";
}

// Ward list for filters and forms. Staff (org:read) get the full
// list; everyone else gets the wards that appear on public cases.
export function useWards(can) {
  const canRead = can("org:read");
  const [wards, setWards] = useState([]);

  useEffect(() => {
    let active = true;

    const fromIssues = () =>
      api.get("/issues", { params: { limit: 200 } }).then((res) => {
        const byId = new Map();

        for (const issue of res.data.issues || []) {
          if (issue.ward?.id) byId.set(issue.ward.id, issue.ward);
        }

        return [...byId.values()];
      });

    const request = api
      .get(canRead ? "/organization/wards" : "/organization/public-wards")
      .then((res) => res.data.wards || [])
      .catch(() => [])
      .then((list) => (list.length ? list : fromIssues()));

    request
      .then((list) => {
        if (!active) return;

        setWards(
          list
            .map(({ id, name, code }) => ({ id, name, code }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      })
      .catch(() => {
        // Ward lists are a convenience; forms still work without one.
      });

    return () => {
      active = false;
    };
  }, [canRead]);

  return wards;
}

// Adds wards seen in loaded data to a base list (deduplicated).
export function mergeWards(base, extra) {
  const byId = new Map(base.map((ward) => [ward.id, ward]));

  for (const ward of extra) {
    if (ward?.id && !byId.has(ward.id)) {
      byId.set(ward.id, { id: ward.id, name: ward.name, code: ward.code });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Reads a CSS custom property (theme-aware colors for Leaflet).
export function cssVar(name, fallback = "") {
  if (typeof window === "undefined") return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

// Cleanup Drive state in words, for chips and buttons.
export function driveState(drive, now = Date.now()) {
  const start = Date.parse(drive.startsAt);
  const full = drive.rsvpCount >= drive.capacity;

  switch (drive.status) {
    case "PROPOSED":
      return { key: "review", label: "In review", tone: "warning" };
    case "REJECTED":
      return { key: "rejected", label: "Not approved", tone: "danger" };
    case "CANCELLED":
      return { key: "cancelled", label: "Cancelled", tone: "outline" };
    case "COMPLETED":
      return { key: "completed", label: "Completed", tone: "success" };
    default:
      break;
  }

  if (start <= now && now - start < 6 * 3_600_000) {
    return { key: "live", label: "Happening now", tone: "accent" };
  }

  if (start <= now) {
    return { key: "ended", label: "Awaiting attendance", tone: "outline" };
  }

  if (full) return { key: "full", label: "Full", tone: "navy" };

  return { key: "open", label: "Open to join", tone: "info" };
}

// ── Ward Vote ───────────────────────────────────────────────

// Options in ballot order with shares; `leader` marks the top
// option(s) once anyone has voted.
export function pollRows(poll) {
  const options = [...(poll.options || [])].sort(
    (a, b) => a.position - b.position
  );
  const total = options.reduce((sum, option) => sum + (option.votes ?? 0), 0);
  const max = Math.max(0, ...options.map((option) => option.votes ?? 0));

  return options.map((option) => {
    const votes = option.votes ?? 0;

    return {
      id: option.id,
      label: option.label,
      votes,
      share: total ? (votes / total) * 100 : 0,
      leader: max > 0 && votes === max,
      mine: option.id === poll.myVoteOptionId,
      issue: option.issue,
    };
  });
}

export function pollTiming(poll, now = Date.now()) {
  if (poll.isOpen) {
    const left = Date.parse(poll.closesAt) - now;

    return left > 0 ? `Closes in ${formatSpan(left)}` : "Closing now";
  }

  return `Closed ${formatDate(poll.closedAt ?? poll.closesAt, {
    year: undefined,
  })}`;
}

export function votesLabel(count) {
  return `${Number(count || 0).toLocaleString("en-IN")} ${count === 1 ? "vote" : "votes"}`;
}
