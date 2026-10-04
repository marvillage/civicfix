import {
  CircleHelp,
  Construction,
  Droplets,
  Lightbulb,
  Trash2,
  Waves,
} from "lucide-react";

// Display metadata for enums. `series` ties a category to the same
// chart color everywhere (color follows the entity, never its rank).
export const CATEGORY_META = {
  ROAD_DAMAGE: {
    label: "Road damage",
    short: "Roads",
    icon: Construction,
    series: "var(--series-1)",
  },
  STREETLIGHT: {
    label: "Streetlight",
    short: "Lights",
    icon: Lightbulb,
    series: "var(--series-2)",
  },
  GARBAGE: {
    label: "Garbage",
    short: "Garbage",
    icon: Trash2,
    series: "var(--series-3)",
  },
  WATER_LEAKAGE: {
    label: "Water leakage",
    short: "Water",
    icon: Droplets,
    series: "var(--series-4)",
  },
  DRAINAGE: {
    label: "Drainage",
    short: "Drains",
    icon: Waves,
    series: "var(--series-5)",
  },
  OTHER: {
    label: "Other",
    short: "Other",
    icon: CircleHelp,
    series: "var(--series-other)",
  },
};

export const CATEGORIES = Object.keys(CATEGORY_META);

export const STATUS_LABEL = {
  REPORTED: "Reported",
  AI_VERIFIED: "AutoSorted",
  ASSIGNED: "Assigned",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CITIZEN_VERIFICATION: "Awaiting sign-off",
  CLOSED: "Closed",
  DUPLICATE: "Duplicate",
  SLA_BREACHED: "Fix Clock breached",
  ESCALATED: "Escalated",
  REOPENED: "Reopened",
};

export const OPEN_STATUSES = [
  "REPORTED",
  "AI_VERIFIED",
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "SLA_BREACHED",
  "ESCALATED",
  "REOPENED",
];

export const SEVERITY_LABEL = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export function statusClass(status = "") {
  return `status-badge status-${status.toLowerCase().replace(/_/g, "-")}`;
}

export function categoryLabel(category) {
  return CATEGORY_META[category]?.label ?? category ?? "";
}
