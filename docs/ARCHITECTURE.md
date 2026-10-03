# CivicFix — Technical Architecture

Interview-ready overview: what the stack is, how data flows, and why it's built this way.

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **React 19 + Vite 8** | SPA, `react-router-dom` v7 for routing |
| Maps | **Leaflet + leaflet.heat + OpenStreetMap tiles** | pins, popups, severity-weighted heatmap |
| Styling | **Hand-rolled CSS design system** | CSS custom properties (design tokens), three themes: Heritage Teal (light), Heritage Teal Dark, Night Watch (authority/admin) |
| HTTP client | **Axios** | one instance; request interceptor attaches JWT, response interceptor self-heals 401s |
| Backend | **Node.js + Express 5 (TypeScript, tsx runtime)** | REST API on port 5000 |
| ORM | **Prisma 7** with the `@prisma/adapter-pg` **driver adapter** | typed client generated into `src/generated/prisma` |
| Database | **PostgreSQL 16** (Docker container) | schema managed by Prisma Migrate (5 migrations) |
| Auth | **JWT (jsonwebtoken) + bcryptjs** | 7-day tokens, salted hashes (cost 12) |
| File storage | **Cloudinary** | photos (image), voice notes (video resource type), streamed uploads via multer memory storage |
| AI | **Google Gemini** (`@google/genai`) | classifies report photos → title, category, severity, confidence |
| Geocoding | **OpenStreetMap Nominatim** | reverse geocode lat/lng → address |
| Email | **Nodemailer** | mirrors every in-app notification; no-ops gracefully without SMTP config |

## High-level architecture

```
Browser (React SPA, :5173)
   │  Axios (JWT in Authorization header)
   ▼
Express API (:5000)
   ├── middleware: authenticate (JWT verify) → authorizeRoles(...)
   ├── multer (memory) → Cloudinary (photos / audio)
   ├── Gemini  (photo classification)
   ├── Nominatim (reverse geocoding)
   ├── Nodemailer (email fan-out)
   └── Prisma 7 (pg driver adapter)
          ▼
     PostgreSQL 16 (Docker)

Background job (in-process): SLA breach check, every 60 s
```

Layering inside the backend: **routes** (URL + middleware chain) → **controllers** (HTTP validation & status codes) → **services** (business logic + Prisma transactions) → **Prisma client**. Cross-cutting helpers live in services (`notification.service.notifyIssueWatchers`, `image.service`, `email.service`).

## Data model (14 models)

- **User** — role (`CITIZEN | AUTHORITY | ADMIN`), points, authority identity fields (`employeeId` unique, designation, phone, department)
- **Issue** — the real-world problem: category, severity, status (12-state enum), lat/lng + address, `isEmergency`, `reopenCount`, `resolutionImageUrl`, optional department & ward
- **Complaint** — one citizen report of an issue: photos[], voice note, nullable `citizenId` (anonymous reports)
- **Assignment** — officer ↔ issue with `assignedAt / acceptedAt / completedAt` timestamps
- **StatusHistory** — append-only timeline: status, note, photo, who, when (also the audit log)
- **SLA** — per-issue deadline + breached flag · **Escalation** — level + reason
- **Upvote** (unique user+issue) · **Comment** (public) · **Message** (private thread) · **Notification**
- **ResolutionVerification** — citizen's verdict + 1–5 star rating
- **Department / Ward / CategoryRule** — org structure + auto-routing (category → department)

**Key relationship:** one *Issue* can have many *Complaints* (duplicate reports merge into one issue), many upvotes, one active assignment, one SLA, a full status history.

## The issue lifecycle (state machine)

```
REPORTED ──(admin assigns)──► ASSIGNED/ACKNOWLEDGED ──(officer accepts)──► ACKNOWLEDGED
   ──(start work)──► IN_PROGRESS ──(resolve + proof photo)──► RESOLVED
   ──(citizen approves + stars)──► CLOSED
   ──(citizen rejects)──► REOPENED (reopenCount++, assignment reactivated) → back to IN_PROGRESS
SLA job: deadline passes → SLA_BREACHED → ESCALATED (Escalation row, admins notified)
Admin can mark any issue DUPLICATE (upvotes merge into the original)
```

Every transition writes a `StatusHistory` row inside the same **Prisma transaction** as the status change, so the timeline can never disagree with the state.

## Core data flows

### 1. Report submission (the critical path)
1. Client posts `multipart/form-data` (≤5 photos, optional voice note, lat/lng, emergency flag).
2. Multer keeps files in memory → each photo streamed to Cloudinary; audio uploaded as a Cloudinary "video".
3. First photo goes to **Gemini** → `{ title, category, severity, confidence }`. The raw AI category is **normalized** against the enum (e.g. `POTHOLE → ROAD_DAMAGE`, unknown → `OTHER`) — the AI is untrusted input.
4. Lat/lng reverse-geocoded via Nominatim → human-readable address.
5. `CategoryRule` lookup auto-assigns the department.
6. `Issue` + `Complaint` created; reporter gets +5 points; if emergency, severity is forced CRITICAL and all admins are notified immediately.

### 2. Notification fan-out
`createNotification(userId, title, message)` writes the in-app row and fires an email (fire-and-forget). `notifyIssueWatchers(issueId, …)` computes the audience — upvoters ∪ complainants, de-duplicated, with exclusions for actors/complainants who get personalized messages — and is called after every state transition. Upvoting an issue is what subscribes a user to it.

### 3. SLA engine
An in-process `setInterval` job runs every 60 s:
1. Find SLAs past deadline, not yet breached, on unresolved issues → mark breached + issue → `SLA_BREACHED` (transactional, with history).
2. Escalate breached issues → `ESCALATED`, create an `Escalation` row with an incrementing level, notify all admins + the assigned officer + watchers.

### 4. RBAC enforcement (both ends)
- **Backend (authoritative):** `authenticate` verifies the JWT and stashes `{ userId, role }`; `authorizeRoles("ADMIN", …)` gates each route. Object-level checks in services (e.g. only the assigned officer may resolve; only thread participants may read private messages).
- **Frontend (UX only):** `ProtectedRoute` + role-based redirects after login; a route-aware `ThemeManager` gives authority/admin the dark Night Watch theme.
- Registration can only create CITIZEN. Authority accounts are provisioned by admins with a one-time generated password (crypto-random, bcrypt-hashed, returned exactly once).

### 5. Auth self-healing
Axios response interceptor: any `401` clears the stored token and redirects to `/login` — a stale or revoked token can never strand the UI in a half-broken state.

## Design decisions worth defending in an interview

- **One Issue, many Complaints** — deduplication is a first-class concept: nearby-issue detection (haversine, 500 m) steers reporters to upvote instead of re-filing, and admins can merge stragglers.
- **Append-only StatusHistory doubles as the audit log** — no separate audit infrastructure; the timeline is the evidence trail.
- **AI output is normalized, never trusted** — Gemini's category passes through an alias map with an `OTHER` fallback; a hallucinated category cannot crash the insert.
- **Transactions around every multi-write** — status + history + side effects commit or roll back together.
- **Emails piggyback on notifications** — one call site, one behavior toggle (SMTP env present or not).
- **Polling over WebSockets for chat** — 10 s polling is adequate at this scale and keeps the infra story simple; the upgrade path (Socket.io) is isolated to one component + one service.
- **Theme system as tokens** — three full themes from one set of CSS custom properties; components never hardcode colors.

## Known limitations / future work

- No pagination on issue lists (fine at demo scale; cursor pagination is the fix).
- JWT in localStorage (XSS surface) — refresh-token + httpOnly cookie is the production pattern.
- No rate limiting or input-schema validation library (zod) yet.
- The SLA job is in-process — a multi-instance deployment would move it to a worker/queue.
- No automated tests yet; the API was verified end-to-end manually via scripted HTTP calls.
