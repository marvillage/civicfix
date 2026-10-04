import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accessMatrix,
  can,
  Permission,
  PERMISSIONS,
  permissionsFor,
  RoleName,
  ROLES,
} from "../src/auth/permissions";

// Every requirePermission() gate in src/routes, with the roles that
// route allowed before the move from authorizeRoles(). If someone
// edits the matrix in a way that changes who can reach a route,
// this table fails and makes them decide on purpose.
const CITIZEN: RoleName[] = ["CITIZEN"];
const STAFF: RoleName[] = ["AUTHORITY", "ADMIN"];
const ADMIN: RoleName[] = ["ADMIN"];
const ALL: RoleName[] = ["CITIZEN", "AUTHORITY", "ADMIN"];

const ROUTE_GATES: [route: string, permission: Permission, roles: RoleName[]][] = [
  // assignment.routes.ts
  ["POST /assignments", "assignment:dispatch", STAFF],
  ["GET /assignments/all", "assignment:read:all", ADMIN],
  ["GET /assignments/my", "assignment:work", STAFF],
  ["PATCH /assignments/:id/accept", "assignment:work", STAFF],
  ["PATCH /assignments/:id/start", "assignment:work", STAFF],
  ["POST /assignments/:id/progress", "assignment:work", STAFF],
  ["PATCH /assignments/:id/resolve", "assignment:work", STAFF],
  // complaint.routes.ts
  ["POST /complaints", "issue:report", CITIZEN],
  ["POST /complaints/field", "field:report", STAFF],
  // dashboard.routes.ts
  ["GET /dashboard/stats", "analytics:full", STAFF],
  ["GET /dashboard/analytics", "issue:read:all", ADMIN],
  ["GET /dashboard/export/issues.csv", "export:csv", ADMIN],
  ["GET /dashboard/my-performance", "performance:read:own", STAFF],
  ["GET /dashboard/audit", "audit:read", ADMIN],
  ["GET /dashboard/chronic", "issue:read:all", ADMIN],
  // issue.routes.ts + upvote.routes.ts
  ["GET /issues/admin/all", "issue:read:all", ADMIN],
  ["POST /issues/:id/comments", "issue:comment", ALL],
  ["GET /issues/:id/messages", "issue:message", ALL],
  ["POST /issues/:id/messages", "issue:message", ALL],
  ["PATCH /issues/:id/status", "issue:status", STAFF],
  ["POST /issues/:id/duplicate", "issue:duplicate", ADMIN],
  ["POST /issues/:id/upvote", "issue:upvote", ALL],
  // organization.routes.ts
  ["POST /organization/departments", "org:manage", ADMIN],
  ["GET /organization/departments", "org:read", STAFF],
  ["POST /organization/wards", "org:manage", ADMIN],
  ["GET /organization/wards", "org:read", STAFF],
  ["GET /organization/authorities", "issue:assign", ADMIN],
  ["GET /organization/rules", "org:manage", ADMIN],
  ["PUT /organization/rules", "org:manage", ADMIN],
  // sla.routes.ts
  ["POST /sla", "sla:manage", ADMIN],
  ["POST /sla/check-breaches", "sla:manage", ADMIN],
  // user.routes.ts
  ["GET /users", "user:manage", ADMIN],
  ["POST /users/authority", "user:manage", ADMIN],
  ["PATCH /users/:id/role", "user:manage", ADMIN],
  ["PATCH /users/:id/verify", "user:manage", ADMIN],
  // v2: bulletins, watch zones, polls, admin
  ["POST /bulletins", "bulletin:publish", STAFF],
  ["* /watch-zones", "watchzone:manage", ALL],
  ["POST /polls", "poll:manage", ADMIN],
  ["POST /polls/:id/vote", "poll:vote", CITIZEN],
  ["POST /polls/:id/close", "poll:manage", ADMIN],
  ["GET /admin/access-matrix", "rbac:read", ADMIN],
  ["GET /admin/audit-events", "audit:read", ADMIN],
  // v2: cost ledger, budgets, drives, pulse
  ["GET /issues/:id/costs", "cost:read", STAFF],
  ["POST /issues/:id/costs", "cost:log", STAFF],
  ["DELETE /costs/:id", "cost:log", STAFF],
  ["GET /budgets", "budget:read", STAFF],
  ["PUT /budgets", "budget:manage", ADMIN],
  ["POST /drives", "drive:propose", CITIZEN],
  ["POST /drives/:id/moderate", "drive:moderate", ADMIN],
  ["POST /drives/:id/rsvp", "drive:join", CITIZEN],
  ["DELETE /drives/:id/rsvp", "drive:join", CITIZEN],
  ["GET /pulse/budget", "analytics:full", STAFF],
];

// Permissions only an administrator may ever hold.
const ADMIN_ONLY: Permission[] = [
  "issue:read:all",
  "issue:assign",
  "issue:duplicate",
  "assignment:read:all",
  "budget:manage",
  "cost:manage",
  "bulletin:manage",
  "poll:manage",
  "drive:moderate",
  "export:csv",
  "audit:read",
  "sla:manage",
  "org:manage",
  "user:manage",
  "rbac:read",
];

// Participation that only makes sense for residents.
const CITIZEN_ONLY: Permission[] = [
  "issue:report",
  "complaint:read:own",
  "complaint:verify",
  "poll:vote",
  "drive:propose",
  "drive:join",
];

const allKeys = Object.keys(PERMISSIONS) as Permission[];

describe("permission matrix", () => {
  it("defines every permission a route asks for", () => {
    for (const [route, permission] of ROUTE_GATES) {
      assert.ok(
        permission in PERMISSIONS,
        `${route} uses unknown permission ${permission}`
      );
    }
  });

  it("keeps each route's allowed roles unchanged", () => {
    for (const [route, permission, roles] of ROUTE_GATES) {
      const granted = ROLES.filter((role) => can(role, permission));

      assert.deepEqual(
        [...granted].sort(),
        [...roles].sort(),
        `${route} (${permission})`
      );
    }
  });

  it("never gives citizens an admin-only permission", () => {
    const citizen = new Set(permissionsFor("CITIZEN"));

    for (const permission of ADMIN_ONLY) {
      assert.ok(
        !citizen.has(permission),
        `CITIZEN holds ${permission}`
      );
    }

    // Anything granted to ADMIN alone is admin-only too.
    for (const key of allKeys) {
      const roles: readonly string[] = PERMISSIONS[key].roles;

      if (roles.length === 1 && roles[0] === "ADMIN") {
        assert.ok(!citizen.has(key), `CITIZEN holds ${key}`);
      }
    }
  });

  // ADMIN holds every permission except the citizen-only
  // participation ones (voting, joining drives, signing off your
  // own case), which are deliberately CITIZEN-only.
  it("gives ADMIN every permission except citizen participation", () => {
    const missing = allKeys.filter((key) => !can("ADMIN", key)).sort();

    assert.deepEqual(missing, [...CITIZEN_ONLY].sort());

    for (const key of allKeys) {
      if (can("AUTHORITY", key)) {
        assert.ok(can("ADMIN", key), `AUTHORITY has ${key} but ADMIN does not`);
      }
    }
  });

  it("returns sorted, unique keys for every role", () => {
    for (const role of ROLES) {
      const list = permissionsFor(role);

      assert.deepEqual(list, [...new Set(list)].sort(), role);
      assert.ok(list.length > 0, `${role} has no permissions`);
    }
  });

  it("grants nothing to unknown roles", () => {
    assert.deepEqual(permissionsFor("SUPERUSER"), []);
    assert.equal(can(undefined, "issue:upvote"), false);
    assert.equal(can("", "issue:upvote"), false);
  });

  it("describes every permission for the access matrix", () => {
    const matrix = accessMatrix();

    assert.deepEqual(matrix.roles, [...ROLES]);
    assert.equal(matrix.permissions.length, allKeys.length);

    for (const entry of matrix.permissions) {
      assert.match(entry.key, /^[a-z]+(:[a-z]+)+$/);
      assert.ok(entry.group.length > 0, `${entry.key} has no group`);
      assert.ok(
        entry.description.length > 0,
        `${entry.key} has no description`
      );
      assert.ok(entry.roles.length > 0, `${entry.key} has no roles`);
      assert.ok(
        entry.roles.every((role) => ROLES.includes(role)),
        `${entry.key} names an unknown role`
      );
    }
  });
});
