// ─────────────────────────────────────────────
// RBAC — the single source of truth for who may do what.
//
// Routes ask for a permission (requirePermission), never for a
// role, so changing what a role can do is a one-line edit here.
// Ownership rules ("only the assigned officer", "only your own
// watch zone") live in the services, on top of these checks.
// ─────────────────────────────────────────────

export const ROLES = ["CITIZEN", "AUTHORITY", "ADMIN"] as const;

export type RoleName = (typeof ROLES)[number];

interface PermissionDef {
  group: string;
  description: string;
  roles: readonly RoleName[];
}

const ALL: readonly RoleName[] = ROLES;
const STAFF: readonly RoleName[] = ["AUTHORITY", "ADMIN"];
const ADMIN: readonly RoleName[] = ["ADMIN"];
const CITIZEN: readonly RoleName[] = ["CITIZEN"];

export const PERMISSIONS = {
  // Cases (issues & complaints)
  // Any signed-in account could file a report before RBAC moved to
  // permissions, so staff keep it; their own flow is field:report.
  // Citizens file reports; officers use Patrol Log (field:report).
  "issue:report": {
    group: "Cases",
    description: "File a report with photos, voice note and location",
    roles: CITIZEN,
  },
  "issue:upvote": {
    group: "Cases",
    description: "Back an issue and follow its updates",
    roles: ALL,
  },
  "issue:comment": {
    group: "Cases",
    description: "Post in the public Street Talk thread",
    roles: ALL,
  },
  "issue:message": {
    group: "Cases",
    description: "Use the private Direct Line on cases you are part of",
    roles: ALL,
  },
  "complaint:read:own": {
    group: "Cases",
    description: "See your own cases and their timelines",
    roles: CITIZEN,
  },
  "complaint:verify": {
    group: "Cases",
    description: "Sign off (or reopen) a fix on your own case",
    roles: CITIZEN,
  },
  "issue:read:all": {
    group: "Cases",
    description: "See every case, including internal fields",
    roles: ADMIN,
  },
  "issue:status": {
    group: "Cases",
    description: "Change a case's status with a note",
    roles: STAFF,
  },
  "issue:assign": {
    group: "Cases",
    description: "Assign or reassign a case to an officer",
    roles: ADMIN,
  },
  "issue:duplicate": {
    group: "Cases",
    description: "Merge a duplicate case into the original",
    roles: ADMIN,
  },

  // Field work
  "assignment:work": {
    group: "Field work",
    description: "Accept, start, update and resolve your assigned jobs",
    roles: STAFF,
  },
  "assignment:dispatch": {
    group: "Field work",
    description: "Hand a case to an officer, or pass your job on to a colleague",
    roles: STAFF,
  },
  "assignment:read:all": {
    group: "Field work",
    description: "See every assignment across departments",
    roles: ADMIN,
  },
  "field:report": {
    group: "Field work",
    description: "Log a Patrol Log report spotted on rounds",
    roles: STAFF,
  },
  "performance:read:own": {
    group: "Field work",
    description: "See your own officer scorecard",
    roles: STAFF,
  },

  // Cost Ledger
  "cost:read": {
    group: "Cost Ledger",
    description: "See work costs on cases in your scope",
    roles: STAFF,
  },
  "cost:log": {
    group: "Cost Ledger",
    description: "Log material, labour and contractor costs on your jobs",
    roles: STAFF,
  },
  "cost:manage": {
    group: "Cost Ledger",
    description: "Log or remove costs on any case, citywide",
    roles: ADMIN,
  },
  "budget:read": {
    group: "Cost Ledger",
    description: "See department budgets and spend (officers: own department)",
    roles: STAFF,
  },
  "budget:manage": {
    group: "Cost Ledger",
    description: "Set monthly department budgets",
    roles: ADMIN,
  },

  // Community
  "bulletin:publish": {
    group: "Community",
    description: "Publish Ward Bulletins (officers: for their own department)",
    roles: STAFF,
  },
  "bulletin:manage": {
    group: "Community",
    description: "Pin or remove any bulletin",
    roles: ADMIN,
  },
  "watchzone:manage": {
    group: "Community",
    description: "Create Watch Zones and get alerts for new cases inside them",
    roles: ALL,
  },
  "poll:vote": {
    group: "Community",
    description: "Vote once in each open Ward Vote",
    roles: CITIZEN,
  },
  "poll:results": {
    group: "Community",
    description: "See live Ward Vote results before voting or closing",
    roles: STAFF,
  },
  "poll:manage": {
    group: "Community",
    description: "Open and close Ward Votes",
    roles: ADMIN,
  },
  "drive:propose": {
    group: "Community",
    description: "Propose a Cleanup Drive",
    roles: CITIZEN,
  },
  "drive:join": {
    group: "Community",
    description: "RSVP to approved Cleanup Drives",
    roles: CITIZEN,
  },
  "drive:moderate": {
    group: "Community",
    description: "Approve or reject proposed Cleanup Drives",
    roles: ADMIN,
  },

  // Insight
  "analytics:full": {
    group: "Insight",
    description: "See the full City Pulse, including spend against budget",
    roles: STAFF,
  },
  "export:csv": {
    group: "Insight",
    description: "Download every case as CSV",
    roles: ADMIN,
  },
  "audit:read": {
    group: "Insight",
    description: "Read the Paper Trail of status changes and admin actions",
    roles: ADMIN,
  },

  // Administration
  "sla:manage": {
    group: "Administration",
    description: "Set Fix Clock deadlines and run breach checks",
    roles: ADMIN,
  },
  "org:manage": {
    group: "Administration",
    description: "Manage departments, wards and routing rules",
    roles: ADMIN,
  },
  "org:read": {
    group: "Administration",
    description: "See departments, wards and officers",
    roles: STAFF,
  },
  "user:manage": {
    group: "Administration",
    description: "Change roles, approve staff and provision officer accounts",
    roles: ADMIN,
  },
  "rbac:read": {
    group: "Administration",
    description: "View the Access Control matrix",
    roles: ADMIN,
  },
} as const satisfies Record<string, PermissionDef>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is RoleName {
  return (
    typeof value === "string" &&
    (ROLES as readonly string[]).includes(value)
  );
}

export function can(
  role: string | undefined,
  permission: Permission
): boolean {
  if (!isRole(role)) return false;

  const roles: readonly RoleName[] =
    PERMISSIONS[permission].roles;

  return roles.includes(role);
}

// Sorted, so clients (and tests) can compare lists directly.
export function permissionsFor(role: string): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[])
    .filter((permission) => can(role, permission))
    .sort();
}

// Shape served to the Access Control screen.
export function accessMatrix() {
  return {
    roles: [...ROLES],
    permissions: (
      Object.entries(PERMISSIONS) as [Permission, PermissionDef][]
    ).map(([key, def]) => ({
      key,
      group: def.group,
      description: def.description,
      roles: [...def.roles],
    })),
  };
}
