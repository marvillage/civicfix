// Demo mode: an axios adapter that answers every API call from data
// recorded off a real, locally seeded CivicFix instance — so the
// frontend can be deployed as a static site with no backend.
//
// Only loaded when VITE_DEMO=1 (see src/api/axios.js). Nothing here
// talks to the network: no API, no Gemini, no Cloudinary.

import { AxiosError } from "axios";
import fixtures from "./fixtures.json";

export const DEMO_TOKEN_PREFIX = "demo-session:";

const ROLES = ["CITIZEN", "AUTHORITY", "ADMIN"];
const LATENCY_MS = 150;
const PROFILE_KEY = "civicfix_demo_profile:";

const { responses, accounts } = fixtures;

// ── Time shifting ───────────────────────────────────────────
// Timestamps are moved forward by (now - recordedAt) so "2 hours ago"
// and live SLA countdowns look the same whenever the demo is opened.

const recordedAt = Date.parse(fixtures.recordedAt);
const shiftMs = Number.isFinite(recordedAt)
  ? Date.now() - recordedAt
  : 0;
const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function revive(value) {
  if (Array.isArray(value)) {
    return value.map(revive);
  }

  if (value && typeof value === "object") {
    const copy = {};

    for (const key of Object.keys(value)) {
      copy[key] = revive(value[key]);
    }

    return copy;
  }

  if (typeof value === "string" && ISO_RE.test(value)) {
    return new Date(
      Date.parse(value) + shiftMs
    ).toISOString();
  }

  return value;
}

// Month buckets ("Sept 26") are labels, not timestamps, so they are
// rebuilt to end at the current month.
function relabelMonths(data) {
  const monthly = data?.analytics?.monthly;

  if (!Array.isArray(monthly)) return data;

  const now = new Date();

  monthly.forEach((bucket, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (monthly.length - 1 - index),
      1
    );

    bucket.month = date.toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    });
  });

  return data;
}

// ── Session ─────────────────────────────────────────────────

function safeStorage(action) {
  try {
    return action(window.localStorage);
  } catch {
    return null;
  }
}

function currentRole() {
  const token = safeStorage((storage) =>
    storage.getItem("civicfix_token")
  );

  if (!token?.startsWith(DEMO_TOKEN_PREFIX)) {
    return null;
  }

  const role = token.slice(DEMO_TOKEN_PREFIX.length);

  return ROLES.includes(role) ? role : null;
}

function accountFor(role) {
  const saved = safeStorage((storage) =>
    storage.getItem(PROFILE_KEY + role)
  );

  let overrides = {};

  try {
    overrides = saved ? JSON.parse(saved) : {};
  } catch {
    overrides = {};
  }

  return revive({ ...accounts[role], ...overrides });
}

function saveProfile(role, fields) {
  safeStorage((storage) => {
    const previous = JSON.parse(
      storage.getItem(PROFILE_KEY + role) || "{}"
    );

    storage.setItem(
      PROFILE_KEY + role,
      JSON.stringify({ ...previous, ...fields })
    );
  });
}

function roleFromLogin(body) {
  if (ROLES.includes(body?.demoRole)) {
    return body.demoRole;
  }

  const email = String(body?.email || "").toLowerCase();

  const match = ROLES.find(
    (role) => accounts[role]?.email?.toLowerCase() === email
  );

  if (match) return match;
  if (email.includes("admin")) return "ADMIN";
  if (/authority|officer|engineer|staff/.test(email)) {
    return "AUTHORITY";
  }

  return "CITIZEN";
}

// ── Request parsing ─────────────────────────────────────────

const ID_RE = /^(c[a-z0-9]{20,32}|demo-[a-z0-9-]+|\d+|[0-9a-f-]{36})$/i;

function parseRequest(config) {
  const url = new URL(config.url || "/", "http://demo.local/");

  for (const [key, value] of Object.entries(
    config.params || {}
  )) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const path =
    url.pathname.replace(/^\/api(?=\/)/, "").replace(/\/+$/, "") ||
    "/";

  const pairs = [...url.searchParams.entries()].sort((a, b) =>
    a[0] === b[0]
      ? a[1].localeCompare(b[1])
      : a[0].localeCompare(b[0])
  );

  return {
    method: (config.method || "get").toUpperCase(),
    path,
    query: pairs.map(([k, v]) => `${k}=${v}`).join("&"),
    params: Object.fromEntries(url.searchParams.entries()),
    segments: path.split("/").filter(Boolean),
  };
}

function parseBody(data) {
  if (!data) return {};

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    const body = {};

    for (const [key, value] of data.entries()) {
      if (typeof value === "string") {
        body[key] = value;
      }
    }

    return body;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  return typeof data === "object" ? data : {};
}

// ── Fixture lookup ──────────────────────────────────────────

function buckets(role) {
  return [role && responses[role], responses.public].filter(
    Boolean
  );
}

function toPattern(path) {
  return path
    .split("/")
    .map((segment) => (ID_RE.test(segment) ? ":id" : segment))
    .join("/");
}

function findFixture(role, method, path, query) {
  const base = `${method} ${path}`;
  const exact = query ? `${base}?${query}` : base;
  const sources = buckets(role);

  // 1. exact match (path + sorted query)
  for (const bucket of sources) {
    if (bucket[exact]) return bucket[exact];
  }

  // 2. same path, any query
  for (const bucket of sources) {
    const key = Object.keys(bucket).find(
      (candidate) => candidate.split("?")[0] === base
    );

    if (key) return bucket[key];
  }

  // 3. same shape with a different id — only for entity
  //    detail routes (last segment is the id), so we never
  //    show one issue's comments under another issue.
  const pattern = toPattern(path);
  const lastIsId = pattern.endsWith("/:id");

  if (pattern !== path && lastIsId) {
    for (const bucket of sources) {
      const key = Object.keys(bucket).find((candidate) => {
        const [candidateMethod, rest] = candidate.split(" ");
        return (
          candidateMethod === method &&
          toPattern(rest.split("?")[0]) === pattern
        );
      });

      if (key) return bucket[key];
    }
  }

  return null;
}

function emptyShape(segments) {
  const last =
    [...segments].reverse().find((s) => !ID_RE.test(s)) ||
    "items";

  const key = last
    .replace(/\.[a-z]+$/i, "")
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  return { [key]: [], items: [], data: [], total: 0 };
}

// ── Helpers for dynamic responses ───────────────────────────

let counter = 0;

function demoId() {
  counter += 1;
  return `demo-${Date.now().toString(36)}-${counter}`;
}

function publicIssues() {
  return (
    responses.public["GET /issues?sort=newest"]?.data?.issues || []
  );
}

function allIssues() {
  const byId = new Map();
  const lists = Object.entries(responses.public)
    .filter(([key]) => key.startsWith("GET /issues?"))
    .flatMap(([, value]) => value.data?.issues || []);

  for (const issue of lists) byId.set(issue.id, issue);

  return [...byId.values()];
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(a)));
}

function sampleIssue() {
  const issues = publicIssues();

  return (
    issues.find((issue) => issue.status === "REPORTED") ||
    issues[0] ||
    null
  );
}

function userSummary(role) {
  const account = accountFor(role);

  return {
    id: account.id,
    name: account.name,
    role: account.role,
    avatarUrl: account.avatarUrl,
  };
}

function singular(word) {
  if (!word) return "item";
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

// ── GET handlers with real logic ────────────────────────────

function listIssues(params) {
  const exact = findFixture(
    null,
    "GET",
    "/issues",
    params.status
      ? `sort=newest&status=${params.status}`
      : "sort=newest"
  );

  let issues = [...(exact?.data?.issues || publicIssues())];

  if (params.category) {
    issues = issues.filter((i) => i.category === params.category);
  }

  if (params.wardId) {
    issues = issues.filter((i) => i.wardId === params.wardId);
  }

  if (params.q) {
    const needle = params.q.toLowerCase();

    issues = issues.filter((i) =>
      [i.title, i.description, i.address, i.ward?.name]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle))
    );
  }

  if (params.sort === "oldest") {
    issues.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } else if (params.sort === "upvotes") {
    issues.sort(
      (a, b) => (b._count?.upvotes || 0) - (a._count?.upvotes || 0)
    );
  } else {
    issues.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return { issues };
}

function nearbyIssues(params) {
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const radius = Math.min(Number(params.radius) || 500, 10000);
  const limit = Number(params.limit) || 5;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { issues: [] };
  }

  const issues = publicIssues()
    .filter((i) => !params.category || i.category === params.category)
    .map((i) => ({
      ...i,
      distanceMeters: distanceMeters(lat, lng, i.latitude, i.longitude),
    }))
    .filter((i) => i.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);

  return { issues };
}

function geocode(params) {
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const nearest = allIssues()
    .map((i) => ({
      address: i.address,
      d: distanceMeters(lat, lng, i.latitude, i.longitude),
    }))
    .sort((a, b) => a.d - b.d)[0];

  if (nearest && nearest.d < 3000) {
    return { address: `Near ${nearest.address}` };
  }

  return {
    address: `Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
  };
}

// ── Mutations ───────────────────────────────────────────────

const DEMO_NOTE = "Demo mode — changes aren't saved.";

function handleMutation(role, request, body) {
  const { method, path, segments } = request;

  if (path === "/auth/login") {
    const loginRole = roleFromLogin(body);

    // A fresh demo login starts from the recorded account again.
    safeStorage((storage) =>
      storage.removeItem(PROFILE_KEY + loginRole)
    );

    return {
      message: "Logged in (demo)",
      token: DEMO_TOKEN_PREFIX + loginRole,
      user: accountFor(loginRole),
    };
  }

  if (path === "/auth/register") {
    const fields = {};
    if (body.name) fields.name = body.name;
    if (body.email) fields.email = body.email;
    saveProfile("CITIZEN", fields);

    return {
      message: "Account created (demo)",
      token: `${DEMO_TOKEN_PREFIX}CITIZEN`,
      user: accountFor("CITIZEN"),
    };
  }

  if (path === "/auth/register/authority") {
    return {
      message:
        "Registration received. An admin verifies authority accounts before first login. (Demo mode — try the Authority demo account instead.)",
    };
  }

  if (!role && !path.startsWith("/complaints/anonymous")) {
    return {
      __status: 401,
      message: "Please log in to continue.",
    };
  }

  if (path === "/auth/profile") {
    const fields = {};
    for (const key of ["name", "bio", "ward", "phone", "designation"]) {
      if (typeof body[key] === "string") fields[key] = body[key];
    }
    saveProfile(role, fields);

    return {
      message: `Profile updated. ${DEMO_NOTE}`,
      user: accountFor(role),
    };
  }

  if (path === "/auth/password") {
    return { message: `Password changed. ${DEMO_NOTE}` };
  }

  if (
    method === "POST" &&
    ["/complaints", "/complaints/anonymous", "/complaints/field"].includes(
      path
    )
  ) {
    const issue = revive(sampleIssue());
    const now = new Date().toISOString();

    return {
      message:
        "Complaint submitted. AI classified the photo as Road damage (High severity). " +
        DEMO_NOTE,
      classification: {
        category: issue?.category || "ROAD_DAMAGE",
        severity: issue?.severity || "HIGH",
        confidence: 0.91,
      },
      complaint: {
        id: demoId(),
        description: body.description || "",
        latitude: Number(body.latitude) || issue?.latitude,
        longitude: Number(body.longitude) || issue?.longitude,
        createdAt: now,
        issueId: issue?.id,
        issue,
      },
      issue,
    };
  }

  if (/^\/issues\/[^/]+\/upvote$/.test(path)) {
    return { message: "Upvoted", upvoted: true };
  }

  if (/^\/issues\/[^/]+\/comments$/.test(path)) {
    return {
      comment: {
        id: demoId(),
        issueId: segments[1],
        userId: accountFor(role).id,
        text: body.text || "",
        createdAt: new Date().toISOString(),
        user: userSummary(role),
      },
    };
  }

  if (/^\/issues\/[^/]+\/messages$/.test(path)) {
    const sender = userSummary(role);

    return {
      data: {
        id: demoId(),
        issueId: segments[1],
        senderId: sender.id,
        text: body.text || "",
        createdAt: new Date().toISOString(),
        sender,
      },
    };
  }

  if (path === "/sla/check-breaches") {
    return {
      message: `SLA check complete — no new breaches. ${DEMO_NOTE}`,
      breachedCount: 0,
    };
  }

  if (path === "/users/authority") {
    const now = new Date().toISOString();

    return {
      message: `Authority account created. ${DEMO_NOTE}`,
      user: {
        id: demoId(),
        ...body,
        role: "AUTHORITY",
        isVerified: true,
        createdAt: now,
      },
      tempPassword: "demo-only-not-real",
    };
  }

  // Generic: echo the body back as a freshly "saved" entity.
  const now = new Date().toISOString();
  const entity = {
    id: segments.find((s) => ID_RE.test(s)) || demoId(),
    ...body,
    createdAt: now,
    updatedAt: now,
  };

  const resources = segments.filter((s) => !ID_RE.test(s));
  const response = {
    message: `${method === "DELETE" ? "Deleted" : "Saved"}. ${DEMO_NOTE}`,
    success: true,
    data: entity,
  };

  for (const resource of resources) {
    response[singular(resource.replace(/-([a-z])/g, (_, c) => c.toUpperCase()))] =
      entity;
  }

  return response;
}

// ── The adapter ─────────────────────────────────────────────

function respond(config, status, data) {
  const response = {
    data,
    status,
    statusText: status < 400 ? "OK" : "Error",
    headers: { "content-type": "application/json" },
    config,
    request: { demo: true },
  };

  if (status >= 400) {
    const error = new AxiosError(
      data?.message || `Request failed with status code ${status}`,
      status >= 500
        ? AxiosError.ERR_BAD_RESPONSE
        : AxiosError.ERR_BAD_REQUEST,
      config,
      response.request,
      response
    );

    return Promise.reject(error);
  }

  return Promise.resolve(response);
}

function resolveGet(role, request, config) {
  const { path, query, params, segments } = request;

  if (path === "/auth/me") {
    return role
      ? [200, { user: accountFor(role) }]
      : [401, { message: "Not authenticated" }];
  }

  if (path === "/issues") {
    return [200, revive(listIssues(params))];
  }

  if (path === "/issues/nearby") {
    return [200, revive(nearbyIssues(params))];
  }

  if (path === "/geocode") {
    return [200, geocode(params)];
  }

  const fixture = findFixture(role, "GET", path, query);

  if (path.endsWith(".csv")) {
    const text =
      typeof fixture?.data === "string" ? fixture.data : "";

    return [
      200,
      config.responseType === "blob"
        ? new Blob([text], { type: "text/csv" })
        : text,
    ];
  }

  if (fixture && path === "/dashboard/analytics") {
    return [fixture.status, relabelMonths(revive(fixture.data))];
  }

  if (fixture) {
    return [fixture.status, revive(fixture.data)];
  }

  return [200, emptyShape(segments)];
}

export async function demoAdapter(config) {
  const request = parseRequest(config);
  const role = currentRole();

  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

  if (request.method === "GET") {
    const [status, data] = resolveGet(role, request, config);
    return respond(config, status, data);
  }

  const result = handleMutation(role, request, parseBody(config.data));
  const { __status: status = 200, ...data } = result;

  return respond(config, status, data);
}

export const demoAccounts = accounts;
