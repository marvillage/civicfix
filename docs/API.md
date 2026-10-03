# CivicFix — API Reference

Base URL: `http://localhost:5000`

## Authentication

Send a JWT in the `Authorization` header: `Authorization: Bearer <token>`. Tokens come from login and expire in 7 days.

Role legend: **Public** (no token) · **Auth** (any logged-in user) · **CITIZEN / AUTHORITY / ADMIN** (role-restricted). Authority routes also accept ADMIN.

On any `401`, the frontend clears the stored token and redirects to login.

---

## Auth

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a citizen account. Body: `{ name, email, password }`. Role is always CITIZEN. |
| POST | `/api/auth/login` | Public | Body: `{ email, password }` → `{ token, user }` (user includes `role`, `points`). |
| GET | `/api/auth/me` | Auth | Current user profile (id, name, email, role, points). |
| PATCH | `/api/auth/profile` | Auth | Update display name. Body: `{ name }`. |
| PATCH | `/api/auth/password` | Auth | Body: `{ currentPassword, newPassword }` (min 8 chars). |

## Complaints (reports)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/complaints` | Auth | File a report. `multipart/form-data`: `images` (up to 5 files), `audio` (voice note, optional), `description`, `latitude`, `longitude`, `isEmergency` ("true"/"false"). Gemini classifies the first photo; address reverse-geocoded; +5 points. |
| POST | `/api/complaints/anonymous` | Public | Same body, no account. Complaint has no citizen. |
| POST | `/api/complaints/field` | AUTHORITY | Field survey: `multipart` with `title`, `category`, `severity`, `description`, `latitude`, `longitude`, `images`. Issue created ACKNOWLEDGED and auto-assigned to the caller. |
| GET | `/api/complaints/my` | Auth | The caller's complaints with issue, department, ward, SLA. |
| GET | `/api/complaints/:id` | Auth | One complaint (must be the owner) with full issue detail. |
| PATCH | `/api/complaints/:complaintId/verify` | Auth (owner) | Body: `{ approved: boolean, note?, stars? (1–5, only when approving) }`. Approve → issue CLOSED (+15 pts); reject → REOPENED (+5 pts, `reopenCount`+1, assignment reactivated). |
| DELETE | `/api/complaints/:id` | Auth (owner) | Withdraw. Only while status is REPORTED/AI_VERIFIED and no active assignment. Closes the issue if it was the only report. |

## Issues

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/issues` | Public | Open issues. Query: `q` (text search), `category`, `status`, `wardId`, `from`, `to` (dates), `sort` (`newest` \| `oldest` \| `upvotes`). |
| GET | `/api/issues/nearby` | Public | Query: `lat`, `lng` (required), `category?`, `radius` (m, default 500, max 10000), `limit` (default 5, max 30). Returns issues with `distanceMeters`, sorted nearest-first. |
| GET | `/api/issues/admin/all` | ADMIN | Every issue, all statuses. |
| GET | `/api/issues/:issueId` | Public | Full issue: complaints (photos, voice notes), assignments, SLA, status history, counts, `resolutionImageUrl`, `isEmergency`, `reopenCount`. |
| PATCH | `/api/issues/:issueId/status` | AUTHORITY | Body: `{ status, note? }`. Writes status history; notifies watchers. |
| POST | `/api/issues/:issueId/duplicate` | ADMIN | Body: `{ originalIssueId }`. Merges upvotes into the original, marks this one DUPLICATE, notifies watchers. |
| POST | `/api/issues/:issueId/upvote` | Auth | One upvote per user per issue. Upvoting subscribes you to that issue's notifications. |

### Comments (public discussion)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/issues/:issueId/comments` | Public | Thread with author name + role. |
| POST | `/api/issues/:issueId/comments` | Auth | Body: `{ text }` (≤ 2000 chars). |

### Messages (private thread)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/issues/:issueId/messages` | Participants | Only the issue's complainants, the assigned authority, and admins. Others get `403`. |
| POST | `/api/issues/:issueId/messages` | Participants | Body: `{ text }`. The other side is notified. |

## Assignments (authority workflow)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/assignments` | AUTHORITY/ADMIN | Body: `{ issueId, authorityId, departmentId?, wardId? }`. Reassigns the active assignment if one exists; notifies the officer. |
| GET | `/api/assignments/all` | ADMIN | Every assignment with issue + officer. |
| GET | `/api/assignments/my` | AUTHORITY | The caller's assignments (includes issue + SLA for countdowns). |
| PATCH | `/api/assignments/:id/accept` | Assigned officer | Issue → ACKNOWLEDGED; reporter + watchers notified. |
| PATCH | `/api/assignments/:id/start` | Assigned officer | Issue → IN_PROGRESS. |
| POST | `/api/assignments/:id/progress` | Assigned officer | `multipart`: `note` (required), `photo?`. Adds a timeline entry (with photo) while IN_PROGRESS; notifies watchers. |
| PATCH | `/api/assignments/:id/resolve` | Assigned officer | `multipart`: `note?`, `proof?` (photo of completed work → `issue.resolutionImageUrl`). Issue → RESOLVED. |

## Organization

| Method | Path | Access | Description |
|---|---|---|---|
| POST / GET | `/api/organization/departments` | ADMIN / +AUTHORITY | Create / list departments. |
| POST / GET | `/api/organization/wards` | ADMIN / +AUTHORITY | Create / list wards (`name`, unique `code`). |
| GET | `/api/organization/authorities` | ADMIN | List authority users for assignment pickers. |
| GET / PUT | `/api/organization/rules` | ADMIN | Auto-assignment rules. PUT body: `{ category, departmentId | null }` (null removes the rule). New issues in that category get the department automatically. |

## SLA

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/api/sla` | ADMIN | Body: `{ issueId, durationMin }`. Deadline = issue creation + duration. One SLA per issue. |
| POST | `/api/sla/check-breaches` | ADMIN | Manually trigger the breach check (also runs automatically every 60 s). |

## Dashboard & stats

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats` | AUTHORITY/ADMIN | Counts by status, category, severity. |
| GET | `/api/dashboard/analytics` | ADMIN | Category/status/ward breakdowns, avg resolution hours, SLA compliance, 6-month monthly trend. |
| GET | `/api/dashboard/public-stats` | Public | Transparency numbers + ward report cards (A–F grades). |
| GET | `/api/dashboard/leaderboard` | Public | Top 10 citizens by points. |
| GET | `/api/dashboard/my-impact` | Auth | Caller's reports, resolved count, upvotes received. |
| GET | `/api/dashboard/my-badges` | Auth | 8 computed achievement badges with earned flags. |
| GET | `/api/dashboard/my-performance` | AUTHORITY | Completed counts, avg resolution hours, SLA hit rate, avg citizen ★ rating. |
| GET | `/api/dashboard/chronic` | ADMIN | Issues reopened ≥ 2× or escalated ≥ level 2. |
| GET | `/api/dashboard/audit` | ADMIN | Status-change audit log. Query: `limit` (≤200), `offset`. Returns `{ entries, total }`. |
| GET | `/api/dashboard/export/issues.csv` | ADMIN | CSV download of all issues. |

## Users (RBAC)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/users` | ADMIN | All users with role, points, authority identity fields, activity counts. |
| POST | `/api/users/authority` | ADMIN | Body: `{ name, email, employeeId (unique), designation?, phone?, departmentId? }` → `{ user, tempPassword }`. Temp password is returned exactly once. |
| PATCH | `/api/users/:userId/role` | ADMIN | Body: `{ role: CITIZEN \| AUTHORITY \| ADMIN }`. Cannot change your own role. |

## Notifications

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/notifications` | Auth | Caller's notifications, newest first. Each also emails the user when SMTP is configured. |
| PATCH | `/api/notifications/read-all` | Auth | Mark all read. |
| PATCH | `/api/notifications/:id/read` | Auth | Mark one read. |

## Misc

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/geocode?lat=&lng=` | Public | Reverse geocode via OpenStreetMap Nominatim → `{ address }`. |
| GET | `/share/issue/:id` | Public | HTML share page with Open Graph tags (title, status, photo), then redirects to the frontend issue page. Use this URL for WhatsApp/Twitter previews. |
| GET | `/` | Public | Health: `{ message: "CivicFix backend is running" }`. |
| GET | `/api/health/db` | Public | Database connectivity check. |

## Error shape

All errors return JSON: `{ "message": "Human-readable explanation" }` with an appropriate status (`400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `500` server).
