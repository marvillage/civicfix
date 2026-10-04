// Helpers shared by the citizen and officer workspaces (My Cases,
// Case File, Crew Queue). Components live in CaseKit.jsx.

import { useEffect, useState } from "react";

const HOUR = 3_600_000;
const URGENT_MS = 4 * HOUR;

export const DONE_STATUSES = [
  "RESOLVED",
  "CITIZEN_VERIFICATION",
  "CLOSED",
  "DUPLICATE",
];

export const SIGN_OFF_STATUSES = ["RESOLVED", "CITIZEN_VERIFICATION"];

// Re-render on an interval so countdowns stay live.
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

// 45m · 3h 12m · 2d 4h
export function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins ? `${hours}h ${mins}m` : `${hours}h`;

  return `${mins}m`;
}

// Fix Clock state for a case.
// Returns null when there is no deadline, otherwise
// { state: "done" | "breached" | "urgent" | "ok", label, short,
//   remainingMs, progress (0–100 of the window used), deadline }.
export function fixClock({ sla, status, createdAt, done }, now = Date.now()) {
  if (!sla?.deadline || status === "DUPLICATE") return null;

  const deadline = new Date(sla.deadline).getTime();
  const start = createdAt
    ? new Date(createdAt).getTime()
    : deadline - (Number(sla.durationMin) || 0) * 60_000;
  const span = Math.max(1, deadline - start);
  const progress = Math.max(0, Math.min(100, ((now - start) / span) * 100));
  const remainingMs = deadline - now;

  if (done || DONE_STATUSES.includes(status)) {
    return {
      state: "done",
      label: sla.breached ? "Fixed after deadline" : "Fixed in time",
      short: "Done",
      remainingMs,
      progress: 100,
      deadline,
    };
  }

  if (sla.breached || remainingMs <= 0) {
    return {
      state: "breached",
      label:
        remainingMs < 0
          ? `Breached · ${formatDuration(-remainingMs)} over`
          : "Breached",
      short: "Breached",
      remainingMs,
      progress: 100,
      deadline,
    };
  }

  return {
    state: remainingMs < URGENT_MS ? "urgent" : "ok",
    label: `${formatDuration(remainingMs)} left`,
    short: formatDuration(remainingMs),
    remainingMs,
    progress,
    deadline,
  };
}

// The assignment that currently owns the case (newest first).
export function currentAssignment(issue) {
  const list = issue?.assignments ?? [];

  if (list.length === 0) return null;

  return [...list].sort(
    (a, b) =>
      new Date(b.assignedAt || 0).getTime() -
      new Date(a.assignedAt || 0).getTime()
  )[0];
}

export function firstName(name, fallback = "there") {
  return name?.trim().split(/\s+/)[0] || fallback;
}

export function greeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}
