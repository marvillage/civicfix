# Fixity — API Reference

Base URL: `http://localhost:5000` (all JSON routes live under `/api`).

## Conventions

- **Auth:** `Authorization: Bearer <jwt>`. Tokens come from `/api/auth/login` or `/api/auth/register` and last 7 days.
  The token proves identity only: every request reads the user's **current** role from the database, so role
  changes and revoked approvals apply immediately.
- **Access** is a permission, not a role (see `backend/src/auth/permissions.ts`, readable in-app at `/admin/access`).
  The **Access** column below names the permission. *Owner* or *Scope* means a further ownership rule enforced in the
  service. Who holds what:
  - **Citizen**: `issue:report`, `issue:upvote`, `issue:comment`, `issue:message`, `complaint:read:own`,
    `complaint:verify`, `watchzone:manage`, `poll:vote`, `drive:propose`, `drive:join`
  - **Officer (AUTHORITY)**: `issue:upvote`, `issue:comment`, `issue:message`, `issue:status`, `assignment:work`,
    `assignment:dispatch`, `field:report`, `performance:read:own`, `cost:read`, `cost:log`, `budget:read`,
    `bulletin:publish`, `watchzone:manage`, `poll:results`, `analytics:full`, `org:read`
  - **Admin**: everything officers have, plus `issue:read:all`, `issue:assign`, `issue:duplicate`,
    `assignment:read:all`, `cost:manage`, `budget:manage`, `bulletin:manage`, `poll:manage`, `drive:moderate`,
    `export:csv`, `audit:read`, `sla:manage`, `org:manage`, `user:manage`, `rbac:read`. Admins don't hold the
    citizen-only participation permissions (reporting, voting, joining drives).
- **Errors:** `{ message, code?, details? }` with a real status:
  - `400 VALIDATION_FAILED`: zod field errors are in `details`
  - `401 UNAUTHENTICATED`
  - `403 FORBIDDEN`: includes a `missing` permission list
  - `404 NOT_FOUND`
  - `409 CONFLICT`
  - `413 TOO_LARGE`
  - `429 RATE_LIMITED`
  - `500 INTERNAL`: includes a `requestId`
- **Headers:** every response carries `X-Request-Id`. Rate-limit state is in the `RateLimit` / `RateLimit-Policy`
  headers.
- **Rate limits:** login and register allow 30 per 15 min per IP; writes allow 120 per minute per IP. Both can be
  changed with `RATE_LIMIT_AUTH` / `RATE_LIMIT_WRITES`.
- **Pagination:** cursor based. Pass `limit`, then send back the `nextCursor` from the previous page as `cursor`;
  `nextCursor` is `null` on the last page.
- **Money** is in whole rupees. **Timestamps** are ISO strings.

---

## Auth

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | `{ name, email, password }` → `{ token, user }`. Always creates a CITIZEN. `user.permissions` lists what the account may do. |
| POST | `/api/auth/register/authority` | Public | Officer application (`name, email, password, employeeId, designation, phone, departmentId`). The account stays unverified until an admin approves it. |
| POST | `/api/auth/login` | Public | `{ email, password }` → `{ token, user }` with `user.permissions`. Unapproved staff get 403. |
| GET | `/api/auth/me` | Signed in | Current profile plus `permissions`. |
| PATCH | `/api/auth/profile` | Signed in | Name, bio, ward, phone; optional avatar (multipart). |
| PATCH | `/api/auth/password` | Signed in | `{ currentPassword, newPassword }` (min 8). |

## Reports (complaints)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/complaints` | `issue:report` | **Snap & Send.** Multipart: `images` (≤5), `audio?`, `description`, `latitude`, `longitude`, `isEmergency`. AutoSort (Gemini) classifies the first photo, the address is reverse-geocoded, routing rules pick the department, +5 points. A Red Alert forces CRITICAL severity and alerts every admin. After commit, matching **Watch Zone** owners are alerted. |
| POST | `/api/complaints/anonymous` | Public | **Quick Drop.** Same body, no account. |
| POST | `/api/complaints/field` | `field:report` | **Patrol Log.** `title`, `category`, `severity`, `description`, location, `images`. Created ACKNOWLEDGED and assigned to the caller. |
| GET | `/api/complaints/my` | Signed in (own) | The caller's cases with issue, ward, SLA. |
| GET | `/api/complaints/:id` | Owner | One case with the full issue detail. |
| PATCH | `/api/complaints/:complaintId/verify` | Owner | **Sign-Off.** `{ approved, note?, stars? (1–5) }`. Approve → CLOSED (+15 pts); reject → REOPENED (+5 pts, `reopenCount`+1). |
| DELETE | `/api/complaints/:id` | Owner | Withdraw, only before work starts. |

## Cases (issues)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/issues` | Public | **City Radar.** Query: `q`, `category`, `status`, `wardId`, `from`, `to`, `sort` (`newest`/`oldest`/`upvotes`), `limit` (default 50, max 200), `cursor`. Hides CLOSED and DUPLICATE unless `status` is given. → `{ issues, nextCursor }`. With `sort=upvotes`, `nextCursor` is a numeric offset string; pass it back unchanged. |
| GET | `/api/issues/nearby` | Public | **Echo Check / Near me.** `lat`, `lng`, `category?`, `radius` (≤10 km), `limit`. Items carry `distanceMeters`, nearest first. |
| GET | `/api/issues/:issueId` | Public | **Case File.** Complaints (photos, voice notes), assignments, SLA, status history, counts. |
| GET | `/api/issues/admin/all` | `issue:read:all` | **Case Desk.** Query: `view` (`open` default / `closed` / `all`), `q` (title, address, id prefix, officer name), `category`, `wardId`, `limit` (default 100, max 500), `cursor`. → `{ issues, nextCursor, total, totals: { open, closed, all } }`. Slim rows: no history, officer refs only. |
| PATCH | `/api/issues/:issueId/status` | `issue:status` | `{ status, note? }`; writes history and notifies backers. |
| POST | `/api/issues/:issueId/duplicate` | `issue:duplicate` | `{ originalIssueId }`. Backers move to the original; audited as `issue.duplicate`. |
| POST | `/api/issues/:issueId/upvote` | `issue:upvote` | **Back It.** One per user (unique constraint); backers get alerts on every change. |
| GET | `/api/issues/:issueId/comments` | Public | **Street Talk.** |
| POST | `/api/issues/:issueId/comments` | `issue:comment` | `{ text }` (≤2000). |
| GET / POST | `/api/issues/:issueId/messages` | `issue:message` + participant | **Direct Line.** Only the case's reporters, the assigned officer and admins. |

## Field work (assignments)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/assignments` | `assignment:dispatch` | `{ issueId, authorityId, departmentId?, wardId? }`. Reassigns if a job is already active. |
| GET | `/api/assignments/all` | `assignment:read:all` | **Dispatch.** Every open job plus jobs finished in the last `days` days (default 30, 1–365). Slim issue and officer refs. |
| GET | `/api/assignments/my` | `assignment:work` | **Crew Queue.** The caller's jobs with SLA for countdowns. |
| PATCH | `/api/assignments/:assignmentId/accept` | `assignment:work` + assignee | → ACKNOWLEDGED. |
| PATCH | `/api/assignments/:assignmentId/start` | `assignment:work` + assignee | → IN_PROGRESS. |
| POST | `/api/assignments/:assignmentId/progress` | `assignment:work` + assignee | **Site Update.** Multipart `note`, `photo?`. |
| PATCH | `/api/assignments/:assignmentId/resolve` | `assignment:work` + assignee | Multipart `note?`, `proof?` photo → RESOLVED. |

## Cost Ledger & budgets

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/issues/:issueId/costs` | `cost:read` + scope | Admins: any case. Officers: cases they're assigned to or in their department. → `{ costs, total }`. |
| POST | `/api/issues/:issueId/costs` | `cost:log` + scope | `{ kind: MATERIAL\|LABOUR\|EQUIPMENT\|CONTRACTOR, description (3–200), amount (1–10,000,000) }`. Officers: only on their own (latest) job; admins (`cost:manage`): any case. Not allowed on duplicates. |
| DELETE | `/api/costs/:id` | `cost:log` + scope | The officer who logged it within 24 h, or an admin. Audited as `cost.delete`. |
| GET | `/api/budgets?month=YYYY-MM` | `budget:read` | → `{ month, departments: [{ department, budget, spent, issues }] }`. Officers see only their own department. |
| PUT | `/api/budgets` | `budget:manage` | `{ departmentId, month, amount }`, upserted (one row per department per month). Audited. |

## City Pulse (analytics)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/pulse` | Public | `range` (`30d` daily / `90d` weekly / `12m` monthly buckets), `wardId?`, `category?` → `{ range, kpis, flow, backlog, byCategory, wards, heatmap, ratings, departments, spendByCategory }`. Aggregated in SQL (bucketing, IST weekday × hour heatmap) and cached for 60 s per query. Duplicates excluded. An unknown ward returns 404. |
| GET | `/api/pulse/budget?months=6` | `analytics:full` | Spend against budget per department per month (3–12 months). |
| GET | `/api/dashboard/public-stats` | Public | Headline numbers and ward report cards (landing page). |
| GET | `/api/dashboard/stats` | `analytics:full` | Counts by status, category, severity. |
| GET | `/api/dashboard/analytics` | `issue:read:all` | **Command Deck** charts: breakdowns, average fix time, SLA compliance, 6-month trend. |
| GET | `/api/dashboard/chronic` | `issue:read:all` | **Repeat Offenders.** |
| GET | `/api/dashboard/leaderboard` | Public | **Civic Cred** top contributors. |
| GET | `/api/dashboard/my-impact` · `/my-badges` | Signed in | **Your Footprint** and badges. |
| GET | `/api/dashboard/my-performance` | `performance:read:own` | **Officer Scorecard.** |
| GET | `/api/dashboard/export/issues.csv` | `export:csv` | **Data Export** (`fixity-cases-YYYY-MM-DD.csv`). |

## Community

### Ward Bulletins

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/bulletins` | Public | `status` (`active` default / `upcoming` / `past` / `all`), `wardId` (also returns citywide), `kind`, `limit`, `cursor`. Pinned first. → `{ bulletins, nextCursor }`. |
| POST | `/api/bulletins` | `bulletin:publish` | `{ title, body, kind: OUTAGE\|ROADWORKS\|ADVISORY\|EVENT, wardId?, startsAt, endsAt?, pinned? }`. Officers are forced to their own department; `pinned` needs `bulletin:manage`. Citizens whose profile ward matches are alerted. |
| DELETE | `/api/bulletins/:id` | Author (while holding `bulletin:publish`) or `bulletin:manage` | Audited. |

### Watch Zones (all routes: `watchzone:manage`, owner only)

| Method | Path | Description |
|---|---|---|
| GET | `/api/watch-zones` | `{ zones }`, each with an `openIssues` count. |
| POST | `/api/watch-zones` | `{ name (2–40), latitude, longitude, radiusM (100–5000), categories? }`. A 6th zone returns 409. |
| PATCH / DELETE | `/api/watch-zones/:id` | Another user's zone returns **404** (its existence isn't revealed). |
| GET | `/api/watch-zones/:id/issues` | Open cases inside the circle, nearest first (max 50), same shape as `/api/issues` items. |

New-case alerts: a bounding-box query narrows the candidate zones, then an exact haversine check and the category
filter confirm them. Alerts run after the report commits and never go to the reporter.

### Ward Vote

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/polls` · `/api/polls/:id` | Public (optional auth) | `status` (`open`/`closed`/`all`), `wardId`. `votes` per option are `null` unless `resultsVisible`: the poll is closed, the caller voted, or the caller holds `poll:results`. Includes `myVoteOptionId`. |
| POST | `/api/polls` | `poll:manage` | `{ question, description?, wardId?, closesAt, options: [{ label, issueId? }] (2–6) }`. |
| POST | `/api/polls/:id/vote` | `poll:vote` | `{ optionId }`. One vote per poll is enforced by a unique index: a second (or racing) vote returns 409. +2 points. |
| POST | `/api/polls/:id/close` | `poll:manage` | 409 if already closed. |

### Cleanup Drives

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/drives` | Public (optional auth) | `status`: `upcoming` (default), `past`, `pending` (needs `drive:moderate`), `mine` (signed in). |
| GET | `/api/drives/:id` | Public (optional auth) | PROPOSED or REJECTED drives are visible only to the organiser and moderators, who also get the RSVP list. |
| POST | `/api/drives` | `drive:propose` | `{ title, description, startsAt (≥2 h ahead), capacity (2–500), latitude, longitude, address?, wardId?, issueId? }` → PROPOSED; admins alerted. |
| POST | `/api/drives/:id/moderate` | `drive:moderate` | `{ decision: APPROVE\|REJECT, note? }`, only from PROPOSED. Organiser alerted; audited. |
| POST / DELETE | `/api/drives/:id/rsvp` | `drive:join` | Capacity is checked in a serializable transaction with retry. Full or duplicate returns 409; organisers can't RSVP to their own drive. |
| POST | `/api/drives/:id/attendance` | Organiser or `drive:moderate` | `{ userIds }` after the start time → COMPLETED. +15 points per attendee and +25 for the organiser, each awarded once. |

## Administration

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/users` | `user:manage` | Every user with role, points and identity fields. |
| POST | `/api/users/authority` | `user:manage` | Provision an officer → `{ user, tempPassword }` (shown once). Audited. |
| PATCH | `/api/users/:userId/role` | `user:manage` | `{ role }`; you can't change your own role. Takes effect on the user's next request. Audited. |
| PATCH | `/api/users/:userId/verify` | `user:manage` | Approve or revoke an officer application. Audited. |
| POST / GET | `/api/organization/departments` | `org:manage` / `org:read` | |
| POST / GET | `/api/organization/wards` | `org:manage` / `org:read` | |
| GET | `/api/organization/public-departments` · `/public-wards` | Public | For sign-up forms and ward pickers. |
| GET | `/api/organization/authorities` | `issue:assign` | Officer picker. |
| GET / PUT | `/api/organization/rules` | `org:manage` | Category → department routing. |
| POST | `/api/sla` | `sla:manage` | **Fix Clock.** `{ issueId, durationMin }`. |
| POST | `/api/sla/check-breaches` | `sla:manage` | Runs the breach check now (it also runs every 60 s). |
| GET | `/api/dashboard/audit` | `audit:read` | **Paper Trail**: status changes. `limit`, `offset`. |
| GET | `/api/admin/audit-events` | `audit:read` | **Paper Trail**: privileged actions. `limit`, `cursor`, `action` (prefix such as `user.`). → `{ events, nextCursor }` with actor, IP and JSON `meta`. |
| GET | `/api/admin/access-matrix` | `rbac:read` | **Permission Matrix**: `{ roles, permissions: [{ key, group, description, roles }] }`. |

Audited actions:
- `user.role.change`, `user.verify`, `user.authority.create`
- `bulletin.publish`, `bulletin.delete`
- `poll.create`, `poll.close`
- `budget.set`, `drive.moderate`, `cost.delete`
- `issue.duplicate`
- `org.department.create`, `org.ward.create`, `org.rule.set`
- `sla.set`

## Notifications & misc

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/notifications` | Signed in | Alerts for the caller (also emailed when SMTP is configured). |
| PATCH | `/api/notifications/read-all` · `/:notificationId/read` | Signed in (own) | |
| GET | `/api/geocode?lat=&lng=` | Public | Reverse geocode via Nominatim. |
| GET | `/share/issue/:id` | Public | Share page with Open Graph tags, then a redirect to the Case File. |
| GET | `/` · `/api/health/db` | Public | Liveness and database check. |
