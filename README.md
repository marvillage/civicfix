# Fixity

**Fixes that stay fixed.** Residents report broken streets (potholes, dead streetlights, garbage, leaks, blocked drains) in thirty seconds with photos, a voice note and GPS. The city works each case through a deadlined, evidence-backed pipeline, in public, and the case only closes when the resident signs off the fix.

*Formerly CivicFix. The product name lives in `frontend/src/brand.js` and `backend/src/config/brand.ts`.*

## What it does

**Report and track**
- **Snap & Send / Quick Drop**: up to 5 photos, voice notes, GPS with the address filled in, and a Red Alert flag. Works without an account.
- **AutoSort**: Gemini reads the photo and sets category and severity. The output is normalised and never trusted blindly.
- **Echo Check**: nearby open cases are offered to **Back It** instead of being filed twice.
- **City Radar**: list, map and hotspot views of every case, plus "near me".
- **Case File**: one page per case, from the first photo to the signed-off fix.
- **Sign-Off**: before/after photos and a 1–5 star rating; one tap reopens the case. Cases that keep reopening surface as **Repeat Offenders**.

**Run the city**
- **Crew Queue**: officers see their work most urgent first, with live **Fix Clock** countdowns.
- **Job Flow**: accept, start and resolve, with photo proof at every step and **Site Updates** in between.
- **Fix Clock**: deadlines enforce themselves. Breaches escalate and alert people automatically.
- **Command Deck, Case Desk, Dispatch, Org & Routing**: dashboards and tools for admins.
- **Access Control**: roles, staff approvals and one-time officer passwords.
- **Paper Trail**: an audit log of every status change and every privileged action.

**New in Fixity**
- 📈 **City Pulse**: public city analytics with one filter row (range, ward, category) driving every chart:
  - reported vs fixed, and the backlog
  - a weekday × hour heatmap
  - category breakdown with median fix times
  - a map of graded **Ward Scorecards**
  - category mix per ward
  - star ratings and spend
  - a department table

  Every chart has a table view and keyboard tooltips.
- 📣 **Ward Bulletins**: planned works, outages and advisories by ward. Officers publish for their own department; admins pin.
- 📍 **Watch Zones**: up to 5 circles per resident. You get an alert whenever a new matching case appears inside one.
- 🗳️ **Ward Vote**: participatory polls with options linked to real cases. One vote per resident, enforced by the database.
- 💰 **Cost Ledger and Budgets**: officers log what each fix cost; admins set monthly department budgets. Spend against budget and spend by category are charted.
- 🤝 **Cleanup Drives**: residents propose volunteer drives, admins moderate, neighbours RSVP up to capacity, and attendance earns Civic Cred.

The full guide is in [docs/FEATURES.md](docs/FEATURES.md).

## Full-stack engineering

| Concern | How it's handled |
|---|---|
| **RBAC** | One permission matrix (`backend/src/auth/permissions.ts`), about 35 `resource:action` permissions across 3 roles. Routes declare `requirePermission("bulletin:publish")`, never a role name. Ownership rules (only the assigned officer, only your own zone) sit in the services on top. Admins can read the matrix in-app. |
| **Fresh authorization** | The JWT proves identity only. Every request reads the user's *current* role from the database, so a demoted or unapproved account loses access immediately. |
| **UI follows the server** | `/auth/me` returns the effective permissions. Navigation, buttons and route guards use `can(permission)`; the API enforces the same checks. |
| **Validation** | zod schemas on every new endpoint (`validate({ body, query, params })`), plus env validation at boot. |
| **Errors** | Typed `HttpError`s and one central handler give consistent `{ message, code, details }` responses; Prisma conflicts map to 409. |
| **Security** | helmet headers, rate limits (auth: 30 per 15 min; writes: 120 per min), body size limits, a CORS allow-list, parameterised SQL only. |
| **Integrity** | Multi-write operations run in transactions. Unique constraints (one vote per poll, one RSVP per drive) are the real guard, with races mapped to 409. |
| **Auditability** | Append-only status history plus an `AuditEvent` row (actor, IP, details) for every privileged action. |
| **Performance** | Cursor pagination, SQL-side aggregation (`date_trunc`, time-zone-aware heatmap), a 60 s TTL cache on City Pulse, indexes on hot columns, route-level code splitting. |
| **Observability** | Request ids (`X-Request-Id`) and one access-log line per request. 500s report the id, not internals. |
| **Operations** | `app.ts` is separate from `server.ts` (so tests mount the app without a port), with graceful shutdown and a health check (`/api/health/db`). |
| **Tests** | `npm test` runs node:test unit tests (the permission matrix pinned per route, geo, rules, City Pulse helpers) and integration tests against a real Postgres (401/403/409/400 paths, race on double vote, immediate demotion). |
| **Accessibility and theming** | Designed light and dark themes (light / dark / system), token-only colours, a validated colour-blind-safe chart palette, focus rings, and a table view for every chart. |

## Tech stack

React 19 · Vite · React Router 7 · Leaflet · lucide-react — Express 5 (TypeScript) · Prisma 7 (pg driver adapter) · PostgreSQL 16 · zod · helmet · express-rate-limit — JWT + bcrypt · Cloudinary · Google Gemini · Nominatim · Nodemailer

## Quick start

```bash
# 1. Database (Docker)
docker run -d --name fixity-postgres -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=fixity -p 5432:5432 postgres:16

# 2. Backend  (backend/.env needs DATABASE_URL, JWT_SECRET (16+ chars), CLOUDINARY_*, GEMINI_API_KEY)
cd backend
npm install
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npm run seed:demo      # rich demo city: 8 wards, ~12 months of history
npm run dev            # http://localhost:5000

# 3. Frontend
cd ../frontend
npm install
npm run dev            # http://localhost:5173
```

- **Demo accounts** (after `seed:demo`): `citizen@fixity.test` / `Citizen@123`, `authority@fixity.test` / `Authority@123`, `admin@fixity.test` / `Admin@123`.
- **Tests**: `cd backend && npm test`. Set `TEST_DATABASE_URL` to a scratch database to include the integration suite.
- **Typecheck**: `npm run typecheck`.
- **Static demo** with no backend: `VITE_DEMO=1 npm run build` in `frontend/`. Every API call is answered from recorded fixtures in `src/demo`.

## Documentation

| Doc | What's inside |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | Every feature: who can use it, how, and why |
| [docs/API.md](docs/API.md) | Every endpoint with its permission, body and response |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, data model, flows, RBAC, design decisions |
| [docs/TESTING.md](docs/TESTING.md) | Automated tests and a manual walkthrough per role |
| [frontend/DESIGN.md](frontend/DESIGN.md) | The design system: tokens, components, charts, naming |

## The case lifecycle

```
REPORTED → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED (signed off)
                ↘ SLA_BREACHED → ESCALATED              ↘ REOPENED ↩
```

Every transition is transactional and writes an append-only history row, so the timeline doubles as the audit trail.
