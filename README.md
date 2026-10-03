# CivicFix 🏙️

**Civic issues, tracked to the finish.** A full-stack platform where citizens report civic problems (potholes, broken streetlights, garbage, water leakage, drainage) with photos, voice notes, and GPS — and municipal authorities work them through a deadlined, evidence-backed pipeline that only closes when the citizen confirms the fix.

## Highlights

- 📸 **30-second reporting** — up to 5 photos, voice notes, GPS + auto-address, emergency flag; works **without an account**
- 🤖 **AI classification** — Gemini reads the photo and assigns category + severity (normalized, never trusted blindly)
- 🗺️ **Live map, heatmap & "near me"** — every open issue on Leaflet/OpenStreetMap, severity-weighted hotspots, distance-sorted feed
- ⏱️ **Self-enforcing SLAs** — deadlines with live countdowns; breaches auto-escalate and alert admins
- ✅ **Citizen-verified closure** — before/after photo proof, 1–5 star satisfaction rating, reopen with one tap; chronic issues (reopened 2+×) get flagged
- 👥 **Real RBAC** — three roles, three different UIs: citizens (teal), authorities & admins (dark "Night Watch" control room). Authority accounts are admin-provisioned with government ID + one-time passwords
- 🏆 **Engagement loop** — civic points, 8 achievement badges, ward leaderboard, upvote-to-watch notifications
- 📊 **Transparency** — public stats page with ward report cards graded A–F, admin analytics, CSV export, full audit log
- 💬 **Communication** — public comments, private citizen↔officer chat, in-app + email notifications

## Tech stack

React 19 · Vite 8 · React Router 7 · Leaflet — Express 5 (TypeScript) · Prisma 7 (pg driver adapter) · PostgreSQL 16 — JWT + bcrypt · Cloudinary · Google Gemini · Nominatim · Nodemailer

## Quick start

```bash
# 1. Database (Docker)
docker run -d --name civicfix-postgres -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=civicfix -p 5432:5432 postgres:16

# 2. Backend  (backend/.env needs DATABASE_URL, JWT_SECRET, CLOUDINARY_*, GEMINI_API_KEY)
cd backend
npm install
npx prisma migrate deploy --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
npm run dev            # http://localhost:5000

# 3. Frontend
cd ../frontend
npm install
npm run dev            # http://localhost:5173
```

Create an admin: `npx tsx prisma/create-admin.ts` (backend folder). Optional email: set `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` in `backend/.env`.

## Documentation

| Doc | What's inside |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | Every feature: how to use it + the value it adds |
| [docs/API.md](docs/API.md) | All ~45 endpoints with methods, access rules, and bodies |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech stack, data model, core data flows, design decisions |
| [docs/INTERVIEW-PREP.md](docs/INTERVIEW-PREP.md) | Likely interview questions about this project, answered |

## The issue lifecycle

```
REPORTED → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED
                ↘ SLA_BREACHED → ESCALATED          ↘ REOPENED ↩
```

Every transition is transactional with an append-only history row — the timeline doubles as the audit log.
