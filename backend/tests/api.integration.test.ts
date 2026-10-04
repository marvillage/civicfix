import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// ─────────────────────────────────────────────
// API integration tests against a real PostgreSQL database.
//
//   TEST_DATABASE_URL=postgresql://… npm test
//
// Skipped when TEST_DATABASE_URL is not set. Every row is created
// under a unique run id and removed again in after().
// ─────────────────────────────────────────────

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const JWT_SECRET = "integration-test-secret-0123456789";

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface TestUser {
  id: string;
  email: string;
  token: string;
}

describe(
  "API integration",
  { skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL is not set" },
  () => {
    const run = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const password = "Correct-Horse-9";

    let server: Server;
    let baseUrl = "";
    let prisma: typeof import("../src/lib/prisma").prisma;
    let notifyWatchZoneOwners: typeof import("../src/services/watchzone.service").notifyWatchZoneOwners;
    let permissionsFor: typeof import("../src/auth/permissions").permissionsFor;

    const users: Record<
      "citizen" | "citizen2" | "officer" | "officer2" | "admin",
      TestUser
    > = {} as never;
    let departmentId = "";
    let otherDepartmentId = "";
    let wardId = "";
    const issueIds: string[] = [];

    // ── helpers ─────────────────────────────────

    async function api(
      method: string,
      path: string,
      options: { token?: string; body?: unknown } = {}
    ): Promise<{ status: number; body: Json }> {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(options.token
            ? { Authorization: `Bearer ${options.token}` }
            : {}),
        },
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      });

      const text = await response.text();

      return {
        status: response.status,
        body: text ? JSON.parse(text) : null,
      };
    }

    const hoursFromNow = (hours: number) =>
      new Date(Date.now() + hours * 3_600_000).toISOString();

    async function waitFor<T>(
      probe: () => Promise<T | null | undefined>,
      timeoutMs = 3000
    ): Promise<T | null> {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const value = await probe();

        if (value) return value;

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return null;
    }

    // ── setup / teardown ────────────────────────

    before(async () => {
      process.env.DATABASE_URL = TEST_DATABASE_URL;
      process.env.JWT_SECRET = JWT_SECRET;
      process.env.NODE_ENV = "test";

      const jwt = (await import("jsonwebtoken")).default;
      const bcrypt = (await import("bcryptjs")).default;
      const { app } = await import("../src/app");

      ({ prisma } = await import("../src/lib/prisma"));
      ({ notifyWatchZoneOwners } = await import(
        "../src/services/watchzone.service"
      ));
      ({ permissionsFor } = await import("../src/auth/permissions"));

      server = app.listen(0);
      await once(server, "listening");
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;

      const [department, otherDepartment] = await Promise.all([
        prisma.department.create({ data: { name: `${run} Roads` } }),
        prisma.department.create({ data: { name: `${run} Water` } }),
      ]);
      departmentId = department.id;
      otherDepartmentId = otherDepartment.id;

      const ward = await prisma.ward.create({
        data: { name: `${run} Ward`, code: `${run}-W1` },
      });
      wardId = ward.id;

      const passwordHash = await bcrypt.hash(password, 4);

      const specs = {
        citizen: { role: "CITIZEN", ward: ward.code.toLowerCase() },
        citizen2: { role: "CITIZEN" },
        officer: { role: "AUTHORITY", departmentId },
        officer2: { role: "AUTHORITY", departmentId },
        admin: { role: "ADMIN" },
      } as const;

      for (const [key, spec] of Object.entries(specs)) {
        const email = `${run}-${key}@fixity.test`;
        const user = await prisma.user.create({
          data: {
            name: `${run} ${key}`,
            email,
            passwordHash,
            ...spec,
          },
        });

        users[key as keyof typeof users] = {
          id: user.id,
          email,
          token: jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
            expiresIn: "1h",
          }),
        };
      }
    });

    after(async () => {
      if (!prisma) return;

      // Let fire-and-forget notifications settle before deleting.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const userIds = Object.values(users).map((user) => user.id);

      await prisma.pollVote.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.poll.deleteMany({ where: { createdById: { in: userIds } } });
      await prisma.bulletin.deleteMany({ where: { authorId: { in: userIds } } });
      await prisma.watchZone.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.issue.deleteMany({ where: { id: { in: issueIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.ward.deleteMany({ where: { id: wardId } });
      await prisma.department.deleteMany({
        where: { id: { in: [departmentId, otherDepartmentId] } },
      });

      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await prisma.$disconnect();
    });

    // ── auth & RBAC ─────────────────────────────

    describe("auth and RBAC", () => {
      it("rejects requests without a token with 401", async () => {
        const zones = await api("GET", "/watch-zones");
        assert.equal(zones.status, 401);
        assert.equal(zones.body.code, "UNAUTHENTICATED");

        const bulletin = await api("POST", "/bulletins", { body: {} });
        assert.equal(bulletin.status, 401);
      });

      it("returns permissions on login", async () => {
        const { status, body } = await api("POST", "/auth/login", {
          body: { email: users.officer.email, password },
        });

        assert.equal(status, 200);
        assert.ok(body.token);
        assert.deepEqual(body.user.permissions, permissionsFor("AUTHORITY"));
      });

      it("serves the access matrix to admins only", async () => {
        const admin = await api("GET", "/admin/access-matrix", {
          token: users.admin.token,
        });
        assert.equal(admin.status, 200);
        assert.deepEqual(admin.body.roles, ["CITIZEN", "AUTHORITY", "ADMIN"]);
        assert.ok(
          admin.body.permissions.some(
            (entry: Json) => entry.key === "rbac:read" && entry.roles[0] === "ADMIN"
          )
        );

        const officer = await api("GET", "/admin/access-matrix", {
          token: users.officer.token,
        });
        assert.equal(officer.status, 403);
        assert.deepEqual(officer.body.missing, ["rbac:read"]);
      });

      it("drops access as soon as a user is demoted", async () => {
        const body = {
          title: "Water main flushing",
          body: "Low pressure expected while the mains are flushed.",
          kind: "ADVISORY",
          startsAt: hoursFromNow(-1),
        };

        const before = await api("POST", "/bulletins", {
          token: users.officer2.token,
          body,
        });
        assert.equal(before.status, 201);

        await prisma.user.update({
          where: { id: users.officer2.id },
          data: { role: "CITIZEN" },
        });

        // Same token, new role read from the database.
        const after = await api("POST", "/bulletins", {
          token: users.officer2.token,
          body,
        });
        assert.equal(after.status, 403);
        assert.equal(after.body.code, "FORBIDDEN");
      });
    });

    // ── bulletins ───────────────────────────────

    describe("ward bulletins", () => {
      const valid = () => ({
        title: "Night roadworks on Ring Road",
        body: "Resurfacing between the two flyovers, one lane open.",
        kind: "ROADWORKS",
        wardId,
        startsAt: hoursFromNow(-1),
        endsAt: hoursFromNow(5),
      });

      it("forbids citizens from publishing", async () => {
        const { status, body } = await api("POST", "/bulletins", {
          token: users.citizen.token,
          body: valid(),
        });

        assert.equal(status, 403);
        assert.equal(body.code, "FORBIDDEN");
      });

      it("rejects invalid input with VALIDATION_FAILED", async () => {
        const shortTitle = await api("POST", "/bulletins", {
          token: users.officer.token,
          body: { ...valid(), title: "ab" },
        });
        assert.equal(shortTitle.status, 400);
        assert.equal(shortTitle.body.code, "VALIDATION_FAILED");

        const backwards = await api("POST", "/bulletins", {
          token: users.officer.token,
          body: { ...valid(), endsAt: hoursFromNow(-3) },
        });
        assert.equal(backwards.status, 400);
        assert.equal(backwards.body.code, "VALIDATION_FAILED");
        assert.match(backwards.body.message, /endsAt/);
      });

      it("forces an officer's own department and blocks pinning", async () => {
        const created = await api("POST", "/bulletins", {
          token: users.officer.token,
          body: { ...valid(), departmentId: otherDepartmentId },
        });

        assert.equal(created.status, 201);
        assert.equal(created.body.bulletin.department.id, departmentId);
        assert.equal(created.body.bulletin.ward.id, wardId);
        assert.equal(created.body.bulletin.author.id, users.officer.id);
        assert.equal(created.body.bulletin.isActive, true);
        assert.equal(created.body.bulletin.pinned, false);

        const pinned = await api("POST", "/bulletins", {
          token: users.officer.token,
          body: { ...valid(), pinned: true },
        });
        assert.equal(pinned.status, 403);
      });

      it("notifies citizens whose profile ward matches", async () => {
        const notification = await waitFor(() =>
          prisma.notification.findFirst({
            where: {
              userId: users.citizen.id,
              title: { contains: "Night roadworks on Ring Road" },
            },
          })
        );

        assert.ok(notification, "citizen in the ward was not notified");
      });

      it("filters by status and lists pinned bulletins first", async () => {
        const admin = users.admin.token;

        const pinned = await api("POST", "/bulletins", {
          token: admin,
          body: { ...valid(), title: "Pinned water outage", kind: "OUTAGE", pinned: true },
        });
        const upcoming = await api("POST", "/bulletins", {
          token: admin,
          body: { ...valid(), title: "Upcoming cleanup event", kind: "EVENT", startsAt: hoursFromNow(24), endsAt: null },
        });
        const past = await api("POST", "/bulletins", {
          token: admin,
          body: { ...valid(), title: "Finished roadworks", startsAt: hoursFromNow(-48), endsAt: hoursFromNow(-24) },
        });

        assert.equal(pinned.status, 201);
        assert.equal(pinned.body.bulletin.pinned, true);
        assert.equal(upcoming.status, 201);
        assert.equal(past.status, 201);

        const list = async (query: string) =>
          (await api("GET", `/bulletins?wardId=${wardId}&limit=100${query}`)).body.bulletins;
        const ids = async (query: string) =>
          (await list(query)).map((bulletin: Json) => bulletin.id);

        // Pinned first (the ward feed may also hold seeded citywide
        // notices, so check the ordering rather than one position).
        const activeList = await list("");
        const pinnedFlags = activeList.map((bulletin: Json) => bulletin.pinned);
        assert.deepEqual(pinnedFlags, [...pinnedFlags].sort((a, b) => Number(b) - Number(a)));
        assert.ok(activeList.every((bulletin: Json) => bulletin.isActive));

        const active = activeList.map((bulletin: Json) => bulletin.id);
        assert.ok(active.includes(pinned.body.bulletin.id));
        assert.ok(!active.includes(upcoming.body.bulletin.id));
        assert.ok(!active.includes(past.body.bulletin.id));

        assert.ok((await ids("&status=upcoming")).includes(upcoming.body.bulletin.id));
        assert.ok((await ids("&status=past")).includes(past.body.bulletin.id));

        const all = await ids("&status=all");
        for (const created of [pinned, upcoming, past]) {
          assert.ok(all.includes(created.body.bulletin.id));
        }
      });

      it("paginates with a cursor", async () => {
        const first = await api("GET", `/bulletins?status=all&wardId=${wardId}&limit=2`);
        assert.equal(first.status, 200);
        assert.equal(first.body.bulletins.length, 2);
        assert.ok(first.body.nextCursor);

        const second = await api(
          "GET",
          `/bulletins?status=all&wardId=${wardId}&limit=2&cursor=${first.body.nextCursor}`
        );
        assert.equal(second.status, 200);

        const firstIds = first.body.bulletins.map((bulletin: Json) => bulletin.id);
        for (const bulletin of second.body.bulletins) {
          assert.ok(!firstIds.includes(bulletin.id), "pages overlap");
        }
      });

      it("lets only the author or an admin delete", async () => {
        const created = await api("POST", "/bulletins", {
          token: users.officer.token,
          body: { ...valid(), title: "Temporary diversion" },
        });
        const id = created.body.bulletin.id;

        const byCitizen = await api("DELETE", `/bulletins/${id}`, {
          token: users.citizen.token,
        });
        assert.equal(byCitizen.status, 403);

        const byAuthor = await api("DELETE", `/bulletins/${id}`, {
          token: users.officer.token,
        });
        assert.equal(byAuthor.status, 200);
        assert.ok(byAuthor.body.message);

        const again = await api("DELETE", `/bulletins/${id}`, {
          token: users.admin.token,
        });
        assert.equal(again.status, 404);
      });
    });

    // ── watch zones ─────────────────────────────

    describe("watch zones", () => {
      const center = { latitude: 28.6315, longitude: 77.2167 };
      let zoneId = "";

      it("creates a zone for the owner", async () => {
        const { status, body } = await api("POST", "/watch-zones", {
          token: users.citizen.token,
          body: { name: "Home block", ...center, radiusM: 500, categories: ["GARBAGE"] },
        });

        assert.equal(status, 201);
        assert.equal(body.zone.name, "Home block");
        assert.deepEqual(body.zone.categories, ["GARBAGE"]);
        assert.equal(typeof body.zone.openIssues, "number");
        zoneId = body.zone.id;
      });

      it("hides a zone from everyone but its owner (404)", async () => {
        const other = users.citizen2.token;

        assert.equal((await api("GET", `/watch-zones/${zoneId}/issues`, { token: other })).status, 404);
        assert.equal(
          (await api("PATCH", `/watch-zones/${zoneId}`, { token: other, body: { name: "Mine now" } })).status,
          404
        );
        assert.equal((await api("DELETE", `/watch-zones/${zoneId}`, { token: other })).status, 404);

        const list = await api("GET", "/watch-zones", { token: other });
        assert.equal(list.status, 200);
        assert.ok(!list.body.zones.some((zone: Json) => zone.id === zoneId));
      });

      it("validates the radius", async () => {
        const { status, body } = await api("POST", "/watch-zones", {
          token: users.citizen.token,
          body: { name: "Too big", ...center, radiusM: 50_000 },
        });

        assert.equal(status, 400);
        assert.equal(body.code, "VALIDATION_FAILED");
      });

      it("alerts the owner about a new matching case and lists it", async () => {
        const issue = await prisma.issue.create({
          data: {
            title: `${run} overflowing bin`,
            category: "GARBAGE",
            severity: "MEDIUM",
            latitude: center.latitude + 0.001, // ≈ 111 m north
            longitude: center.longitude,
          },
        });
        issueIds.push(issue.id);

        // Reporter is citizen2, so only the zone owner is alerted.
        const alerted = await notifyWatchZoneOwners(issue, users.citizen2.id);
        assert.ok(alerted >= 1);

        const notification = await waitFor(() =>
          prisma.notification.findFirst({
            where: { userId: users.citizen.id, title: "New case in Home block" },
          })
        );
        assert.ok(notification, "zone owner was not notified");

        const { status, body } = await api("GET", `/watch-zones/${zoneId}/issues`, {
          token: users.citizen.token,
        });
        assert.equal(status, 200);
        const listed = body.issues.find((item: Json) => item.id === issue.id);
        assert.ok(listed, "issue missing from the zone");
        assert.ok(Math.abs(listed.distanceMeters - 111) <= 2);
        assert.ok("_count" in listed && "ward" in listed);

        // The reporter is never alerted about their own case.
        const ownZone = await api("POST", "/watch-zones", {
          token: users.citizen2.token,
          body: { name: "Reporter zone", ...center, radiusM: 1000 },
        });
        assert.equal(ownZone.status, 201);

        await notifyWatchZoneOwners(issue, users.citizen2.id);
        const reporterAlert = await prisma.notification.findFirst({
          where: { userId: users.citizen2.id, title: "New case in Reporter zone" },
        });
        assert.equal(reporterAlert, null);
      });

      it("updates a zone (partial)", async () => {
        const { status, body } = await api("PATCH", `/watch-zones/${zoneId}`, {
          token: users.citizen.token,
          body: { radiusM: 1500 },
        });

        assert.equal(status, 200);
        assert.equal(body.zone.radiusM, 1500);
        assert.equal(body.zone.name, "Home block");
      });

      it("allows at most five zones (409 on the sixth)", async () => {
        const existing = (await api("GET", "/watch-zones", { token: users.citizen.token })).body.zones.length;

        for (let i = existing; i < 5; i += 1) {
          const created = await api("POST", "/watch-zones", {
            token: users.citizen.token,
            body: { name: `Zone ${i + 1}`, ...center, radiusM: 300 },
          });
          assert.equal(created.status, 201);
        }

        const sixth = await api("POST", "/watch-zones", {
          token: users.citizen.token,
          body: { name: "Zone 6", ...center, radiusM: 300 },
        });
        assert.equal(sixth.status, 409);
        assert.equal(sixth.body.code, "CONFLICT");
      });

      it("deletes a zone", async () => {
        const { status } = await api("DELETE", `/watch-zones/${zoneId}`, {
          token: users.citizen.token,
        });
        assert.equal(status, 200);
      });
    });

    // ── polls ───────────────────────────────────

    describe("ward vote", () => {
      let pollId = "";
      let optionIds: string[] = [];

      it("lets admins open a poll", async () => {
        const forbidden = await api("POST", "/polls", {
          token: users.officer.token,
          body: {},
        });
        assert.equal(forbidden.status, 403);

        const { status, body } = await api("POST", "/polls", {
          token: users.admin.token,
          body: {
            question: "Which street should be fixed first?",
            wardId,
            closesAt: hoursFromNow(48),
            options: [{ label: "Station Road" }, { label: "Temple Lane" }],
          },
        });

        assert.equal(status, 201);
        assert.equal(body.poll.isOpen, true);
        assert.equal(body.poll.options.length, 2);
        pollId = body.poll.id;
        optionIds = body.poll.options.map((option: Json) => option.id);
      });

      it("hides results from citizens who have not voted", async () => {
        const { body } = await api("GET", `/polls/${pollId}`, {
          token: users.citizen.token,
        });

        assert.equal(body.poll.resultsVisible, false);
        assert.equal(body.poll.myVoteOptionId, null);
        assert.ok(body.poll.options.every((option: Json) => option.votes === null));

        const staff = await api("GET", `/polls/${pollId}`, { token: users.officer.token });
        assert.equal(staff.body.poll.resultsVisible, true);
      });

      it("rejects an option from outside the poll", async () => {
        const { status } = await api("POST", `/polls/${pollId}/vote`, {
          token: users.citizen.token,
          body: { optionId: "not-an-option" },
        });
        assert.equal(status, 400);
      });

      it("counts one vote per citizen (409 on the second, even in parallel)", async () => {
        const pointsBefore = (await prisma.user.findUniqueOrThrow({ where: { id: users.citizen.id } })).points;

        const results = await Promise.all(
          [0, 1].map(() =>
            api("POST", `/polls/${pollId}/vote`, {
              token: users.citizen.token,
              body: { optionId: optionIds[0] },
            })
          )
        );

        const statuses = results.map((result) => result.status).sort();
        assert.deepEqual(statuses, [200, 409]);

        const ok = results.find((result) => result.status === 200)!;
        assert.equal(ok.body.poll.resultsVisible, true);
        assert.equal(ok.body.poll.myVoteOptionId, optionIds[0]);
        assert.equal(ok.body.poll.options[0].votes, 1);
        assert.equal(ok.body.poll.totalVotes, 1);

        const conflict = results.find((result) => result.status === 409)!;
        assert.equal(conflict.body.message, "You have already voted in this poll");

        const pointsAfter = (await prisma.user.findUniqueOrThrow({ where: { id: users.citizen.id } })).points;
        assert.equal(pointsAfter - pointsBefore, 2);

        const again = await api("POST", `/polls/${pollId}/vote`, {
          token: users.citizen.token,
          body: { optionId: optionIds[1] },
        });
        assert.equal(again.status, 409);
      });

      it("does not let staff vote", async () => {
        const { status } = await api("POST", `/polls/${pollId}/vote`, {
          token: users.officer.token,
          body: { optionId: optionIds[0] },
        });
        assert.equal(status, 403);
      });

      it("closes a poll and refuses later votes (400)", async () => {
        const closed = await api("POST", `/polls/${pollId}/close`, {
          token: users.admin.token,
        });
        assert.equal(closed.status, 200);
        assert.equal(closed.body.poll.isOpen, false);
        assert.ok(closed.body.poll.closedAt);

        const late = await api("POST", `/polls/${pollId}/vote`, {
          token: users.citizen2.token,
          body: { optionId: optionIds[1] },
        });
        assert.equal(late.status, 400);

        const twice = await api("POST", `/polls/${pollId}/close`, {
          token: users.admin.token,
        });
        assert.equal(twice.status, 409);

        // Closed polls show results to everyone, signed in or not.
        const anonymous = await api("GET", `/polls/${pollId}`);
        assert.equal(anonymous.body.poll.resultsVisible, true);
        assert.equal(anonymous.body.poll.options[0].votes, 1);
      });

      it("lists open polls before closed ones", async () => {
        const open = await api("POST", "/polls", {
          token: users.admin.token,
          body: {
            question: "Where should the new bins go?",
            wardId,
            closesAt: hoursFromNow(24),
            options: [{ label: "Market" }, { label: "School gate" }],
          },
        });
        assert.equal(open.status, 201);

        const { body } = await api("GET", `/polls?wardId=${wardId}`);
        const ids = body.polls.map((poll: Json) => poll.id);
        assert.ok(ids.indexOf(open.body.poll.id) < ids.indexOf(pollId));

        const closedOnly = await api("GET", `/polls?status=closed&wardId=${wardId}`);
        assert.ok(closedOnly.body.polls.every((poll: Json) => !poll.isOpen));
      });
    });

    // ── audit trail ─────────────────────────────

    describe("audit events", () => {
      it("records privileged actions with actor and ip", async () => {
        const { status, body } = await api("GET", "/admin/audit-events?action=poll.&limit=50", {
          token: users.admin.token,
        });

        assert.equal(status, 200);

        const mine = body.events.filter((event: Json) => event.actor?.id === users.admin.id);
        const actions = new Set(mine.map((event: Json) => event.action));

        assert.ok(actions.has("poll.create"));
        assert.ok(actions.has("poll.close"));
        assert.ok(mine.every((event: Json) => event.action.startsWith("poll.")));
        assert.ok(mine[0].ip, "ip was not recorded");

        const denied = await api("GET", "/admin/audit-events", { token: users.citizen.token });
        assert.equal(denied.status, 403);
      });

      it("records bulletin publish and delete", async () => {
        const events = await prisma.auditEvent.findMany({
          where: {
            actorId: users.officer.id,
            action: { in: ["bulletin.publish", "bulletin.delete"] },
          },
        });
        const actions = new Set(events.map((event) => event.action));

        assert.ok(actions.has("bulletin.publish"));
        assert.ok(actions.has("bulletin.delete"));
      });
    });
  }
);
