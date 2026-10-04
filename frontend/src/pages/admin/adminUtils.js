// Non-component helpers for the admin workspace pages (kept apart from
// adminKit.jsx so Fast Refresh keeps working there).

import { useEffect, useState } from "react";

export function apiError(error, fallback) {
  return error?.response?.data?.message || fallback;
}

// Ticks every `ms` so countdowns stay live without a refetch.
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);

    return () => clearInterval(timer);
  }, [ms]);

  return now;
}

// 8_100_000 ms → "2 h 15 min" · 3 d 4 h · "45 min"
export function formatSpan(ms) {
  const minutes = Math.max(0, Math.round(Math.abs(ms) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return hours ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return mins ? `${hours} h ${mins} min` : `${hours} h`;

  return `${mins} min`;
}

// Fix Clock length in minutes → "4 h", "3 d", "90 min"
export function formatClockLength(durationMin) {
  const minutes = Number(durationMin);

  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes % 1440 === 0) return `${minutes / 1440} d`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  if (minutes > 120) return `${(minutes / 60).toFixed(1)} h`;

  return `${minutes} min`;
}

const CLOSED_STATUSES = ["RESOLVED", "CITIZEN_VERIFICATION", "CLOSED", "DUPLICATE"];

// Where a case stands against its Fix Clock right now.
// state: none | running | soon | overdue | breached | escalated | done
export function fixClock(issue, now = Date.now()) {
  const sla = issue?.sla;

  if (!sla) {
    return { state: "none", label: "No clock", tone: "" };
  }

  const deadline = new Date(sla.deadline).getTime();
  const left = deadline - now;

  // Finished cases: the clock stopped; say whether it was met.
  if (CLOSED_STATUSES.includes(issue.status)) {
    return sla.breached
      ? { state: "done", label: "Closed late", tone: "warning", left }
      : { state: "done", label: "Met", tone: "success", left };
  }

  if (issue.status === "ESCALATED") {
    return { state: "escalated", label: "Escalated", tone: "danger", left };
  }

  if (sla.breached || issue.status === "SLA_BREACHED") {
    return {
      state: "breached",
      label: sla.breachedAt
        ? `Breached ${formatSpan(now - new Date(sla.breachedAt).getTime())} ago`
        : "Breached",
      tone: "danger",
      left,
    };
  }

  if (left <= 0) {
    return {
      state: "overdue",
      label: `${formatSpan(left)} over`,
      tone: "danger",
      left,
    };
  }

  if (left <= 24 * 3600 * 1000) {
    return { state: "soon", label: `${formatSpan(left)} left`, tone: "warning", left };
  }

  return { state: "running", label: `${formatSpan(left)} left`, tone: "info", left };
}

export function shortId(id) {
  if (!id) return "—";

  return String(id).slice(-6).toUpperCase();
}

// YYYY-MM of a date, in local time.
export function monthKeyOf(date = new Date()) {
  const d = new Date(date);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "2026-05" → "May 26" (or "May 2026" with { long: true })
export function formatMonthKey(key, { long = false } = {}) {
  const [year, month] = String(key || "").split("-").map(Number);

  if (!year || !month) return key || "";

  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: long ? "long" : "short",
    year: long ? "numeric" : "2-digit",
  });
}
