// Shared formatters. Locale is en-IN throughout (₹, lakh grouping).

const LOCALE = "en-IN";

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return "—";

  return Number(value).toLocaleString(LOCALE);
}

// 1,284 · 12.9K · 3.4L · 2.1Cr — compact Indian notation.
export function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "—";

  const n = Number(value);
  const abs = Math.abs(n);

  if (abs >= 1e7) return `${trim(n / 1e7)}Cr`;
  if (abs >= 1e5) return `${trim(n / 1e5)}L`;
  if (abs >= 1e4) return `${trim(n / 1e3)}K`;

  return n.toLocaleString(LOCALE);
}

function trim(n) {
  return n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "");
}

export function formatINR(value, { compact = false } = {}) {
  if (value == null || Number.isNaN(value)) return "—";

  if (compact) return `₹${formatCompact(value)}`;

  return `₹${Number(value).toLocaleString(LOCALE, {
    maximumFractionDigits: 0,
  })}`;
}

export function formatPct(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return "—";

  return `${Number(value).toFixed(digits)}%`;
}

// Hours → "45 min" · "6.5 h" · "3.2 d"
export function formatHours(hours) {
  if (hours == null || Number.isNaN(hours)) return "—";

  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${trim(hours)} h`;

  return `${trim(hours / 24)} d`;
}

export function formatDate(value, options = {}) {
  if (!value) return "";

  return new Date(value).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatDateTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(value, now = Date.now()) {
  if (!value) return "";

  const seconds = Math.round((now - new Date(value).getTime()) / 1000);
  const future = seconds < 0;
  const s = Math.abs(seconds);

  const units = [
    [60, "second", 1],
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [604800, "day", 86400],
    [2629800, "week", 604800],
    [31557600, "month", 2629800],
    [Infinity, "year", 31557600],
  ];

  for (const [limit, unit, size] of units) {
    if (s < limit) {
      const n = Math.max(1, Math.floor(s / size));
      const label = `${n} ${unit}${n === 1 ? "" : "s"}`;

      if (unit === "second") return future ? "in a moment" : "just now";

      return future ? `in ${label}` : `${label} ago`;
    }
  }

  return "";
}

// ROAD_DAMAGE → "Road damage"
export function labelize(value) {
  if (!value) return "";

  const text = String(value).replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
