# Fixity — Technical Architecture

What the stack is, how data flows, and why it's built this way.

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **React 19 + Vite** | SPA with `react-router-dom` 7, route-level code splitting (`React.lazy`) |
| Design system | **Hand-rolled CSS with design tokens** | `styles/tokens.css` (white / signal yellow / navy, separately designed light and dark), base → shell → components → charts → per-page files; documented in `frontend/DESIGN.md` |
| Charts | **In-house SVG/HTML chart kit** | `components/charts`: line/area with crosshair, columns, bars, stacked bars, heatmap, sparkline, meter. Validated colour-blind-safe palette, tooltips, table view on every chart |
| Maps | **Leaflet + leaflet.heat + OpenStreetMap** | pins, hotspots, ward bubbles, watch-zone circles; tiles re-toned for dark mode |
| Icons | **lucide-react** | no emoji in UI chrome |
| HTTP client | **Axios** | one instance; request interceptor attaches the JWT, response interceptor self-heals 401s; demo-mode adapter |
| Backend | **Node.js + Express 5 (TypeScript)** | `app.ts` builds the app, `server.ts` runs it |
| Validation | **zod 4** | request bodies/queries/params and environment variables |
| Security | **helmet, express-rate-limit, CORS allow-list** | plus body size limits and request ids |
| ORM | **Prisma 7** with the `@prisma/adapter-pg` driver adapter | typed client in `src/generated/prisma`; raw SQL only through tagged templates |
| Database | **PostgreSQL 16** | 7 migrations, indexes on status/createdAt/ward and the new tables |
| Auth | **JWT + bcryptjs** | 7-day tokens (identity only); salted hashes (cost 12) |
| Files / AI / geo / mail | **Cloudinary, Google Gemini, Nominatim, Nodemailer** | unchanged from v1 |
| Tests | **node:test via tsx** | unit tests and integration tests against a real Postgres |

## High-level architecture

```
Browser (React SPA)
   │  Axios (Bearer JWT)          ← UI shows/hides by user.permissions
   ▼
Express API
   ├── requestLogger (X-Request-Id) → helmet → CORS → json(1mb) → rate limits
   ├── authenticate: verify JWT → load CURRENT role from DB
   ├── requirePermission("resource:action")   ← permissions.ts (single source of truth)
   ├── validate({ body, query, params })       ← zod
   ├── controllers (thin) → services (logic, ownership checks, transactions)
   ├── recordAudit(...) for privileged actions
   └── errorHandler (HttpError / Prisma → JSON; 500s report requestId)
          ▼
     Prisma 7 → PostgreSQL 16

In-process jobs: Fix Clock breach + escalation check every 60 s
In-memory cache: City Pulse responses, 60 s TTL, size-capped
```

Layering inside the backend: **routes** (URL + middleware chain: auth → permission → validation) → **controllers** (HTTP shape, status codes) → **services** (business rules, ownership, Prisma transactions) → **Prisma**. Pure rule functions (`*.rules.ts`, `pulse.helpers.ts`, `lib/geo.ts`) have no I/O and are unit tested.

## RBAC

```
Role ──has──▶ Permission ("bulletin:publish", "cost:log", …)  ──gates──▶ Route
                                                     + ownership checks in services
```

- `backend/src/auth/permissions.ts` declares every permission with its group, description and roles. `can(role, permission)` and `permissionsFor(role)` are the only ways code asks about access.
- Routes use `requirePermission(...)`. No route names a role. `tests/permissions.test.ts` pins the role set that reaches each route, so changing the matrix can't silently widen or narrow access.
- **Ownership** is enforced where the data is: only the currently assigned officer can resolve or log costs on a job; officers read costs and budgets only for their own department; watch zones are owner-only (another user's zone is a 404, which doesn't reveal that it exists); bulletins from officers are forced to their own department.
- **Freshness:** `authenticate` reads `{ role, isVerified }` from the database on every request. A role change or revoked approval applies on the user's next request.
- **The frontend follows the server.** `/auth/me` and `/auth/login` return `permissions`. The sidebar (`components/layout/navigation.js`), action buttons (`can()` / `<Can>`) and route guards (`<ProtectedRoute permission>`) all use them. Hiding a button is UX only; the API enforces the same check.
- Admins can read the live matrix at `/admin/access` (`GET /admin/access-matrix`).

## Data model (25 models)

**v1:** User · Issue · Complaint · Assignment · StatusHistory · SLA · Escalation · Upvote · Comment · Message · Notification · ResolutionVerification · Department · Ward · CategoryRule

**v2:**
- **Bulletin**: title, body, kind (OUTAGE / ROADWORKS / ADVISORY / EVENT), optional ward (null = citywide) and department, time window, pinned.
- **WatchZone**: owner, centre, radius (100–5000 m), category filter (empty = all).
- **Poll → PollOption → PollVote**: `@@unique([pollId, userId])` makes "one vote each" a database guarantee.
- **WorkCost**: per-issue cost lines in whole rupees. **DepartmentBudget**: `@@unique([departmentId, month])`.
- **Drive → DriveRsvp**: proposal → moderation → RSVP (`@@unique([driveId, userId])`) → attendance.
- **AuditEvent**: actor, dotted action (`user.role.change`), entity, JSON meta, IP, time.

Key relationship (unchanged): one *Issue* has many *Complaints* (duplicates merge), backers, one SLA, a full status history, and now costs, poll options and drives.

## Core flows

### 1. Report → alerts
1. Multipart upload (≤5 photos + voice note). Photos and audio go to Cloudinary; Gemini classifies the first photo (normalised to the enum).
2. Inside one transaction: the issue, the complaint and the reporter's points are written together.
3. **After commit**, fire-and-forget: Watch Zone alerts. A bounding-box query narrows candidate zones, an exact haversine check (`lib/geo.ts`) confirms them, categories must match, and each owner is notified once (never the reporter). A failed alert can never fail the report.

### 2. City Pulse
`GET /pulse?range=30d|90d|12m&wardId&category` is public and cached for 60 s per normalised query.
- Bucketed flow (`date_trunc`), counts and the weekday × hour heatmap are computed in SQL. The heatmap uses `(createdAt AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'`.
- Medians, the backlog series and A–F ward grades are computed in JS.
- "Resolved at" is the first RESOLVED row in the status history. Duplicates are excluded everywhere.
- `GET /pulse/budget` (staff) returns monthly spend against budget per department.

### 3. Ward Vote race
Two simultaneous votes by one user: both pass validation, and the database unique constraint rejects the second (P2002). The central handler maps it to 409 "You have already voted in this poll". This is covered by an integration test.

### 4. Cleanup Drive capacity
RSVP counts and inserts inside one transaction, so a full drive returns 409. The unique constraint stops double-joining. Attendance can be marked only after the start time, only by the organiser or a moderator, and only for people who RSVP'd. It awards points once.

### 5. Fix Clock engine (unchanged)
Every 60 s, overdue SLAs are marked breached, then escalated with a level, and admins, the officer and backers are notified. Status and history are written in one transaction.

## Frontend structure

```
src/
  brand.js                 product name, storage keys, FEATURES.* names
  context/                 AuthContext (user, can, homePath), ThemeContext (light/dark/system)
  components/layout/       AppShell (navy sidebar + topbar), PublicShell, Layout, navigation
  components/ui/           PageHeader, StatTile, badges, EmptyState, Segmented…
  components/charts/       chart kit
  components/community/    bulletin, poll, drive, watch-zone building blocks
  pages/                   public · auth · citizen · authority · admin · community · pulse
  demo/                    VITE_DEMO=1 adapter, recorded fixtures, per-area mocks
  styles/                  tokens · base · shell · components · charts · pages/*
```

Shared pages (City Radar, City Pulse, Bulletins, Ward Vote, Drives) render inside the **workspace** when signed in and inside the **public chrome** when signed out, so one route serves both audiences.

## Design decisions worth defending

- **Permissions, not roles, at every call site**: adding a role or moving a capability is a one-line change, and a test proves nothing else moved.
- **The database decides access, the token only proves identity**: this trades one indexed primary-key read per request for instant revocation.
- **Constraints over app logic for invariants**: one vote, one RSVP and one budget per month are unique indexes. App code turns the violation into a friendly 409.
- **Side effects after commit**: notifications and emails can't roll back or block the write that caused them.
- **Aggregate in SQL, cache briefly**: City Pulse stays fast on a year of history without a separate analytics store. The 60 s cache is honest for a public dashboard.
- **Charts built in-house**: about 900 lines, themed by tokens, accessible (tooltips on focus, table views) and with no dependency to keep in sync.
- **Designed dark mode**: navy buttons on white become yellow on navy; chart colours have their own validated dark steps rather than inverted ones.

## Known limitations / future work

- JWT in localStorage (XSS surface). Production should use refresh tokens in httpOnly cookies plus CSRF protection.
- Rate limits and the City Pulse cache are in-process. Several instances would need Redis.
- The Fix Clock job is in-process. Several instances would move it to a worker or queue.
- Chat polls every 10 s. WebSockets are the upgrade path.
- Older v1 controllers still use their own try/catch style. New code uses `asyncHandler` + `HttpError`; migrate the rest over time.
