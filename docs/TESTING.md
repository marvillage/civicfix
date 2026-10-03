# CivicFix — Manual Testing Guide

Everything below works against the seeded demo database. Run `npm run seed` inside `backend/` to reset to this exact state at any time.

## Demo accounts

| Role | Email | Password | What they have |
|---|---|---|---|
| Citizen | `citizen@civicfix.test` | `Citizen@123` | 65 points, 5 reports across statuses, one awaiting verification, a private chat thread, unread notifications |
| Citizen | `priya@civicfix.test` | `Citizen@123` | 120 points, top of the leaderboard, reported the emergency |
| Citizen | `rahul@civicfix.test` | `Citizen@123` | 45 points |
| Citizen | `aisha@civicfix.test` | `Citizen@123` | 25 points |
| Authority | `authority@civicfix.test` | `Authority@123` | Sunil Kumar, Junior Engineer, Roads — 7 assignments in every workflow state |
| Authority | `engineer@civicfix.test` | `Authority@123` | Meera Joshi, Assistant Engineer, Water — has the live emergency |
| Admin | `admin@civicfix.test` | `Admin@123` | Full analytics, users, audit log, chronic list |

On the login page there are **three one-click buttons** that fill these credentials for you.

## Seeded data at a glance

16 issues covering every status: REPORTED, AI_VERIFIED, ASSIGNED, ACKNOWLEDGED, IN_PROGRESS (including a live emergency), RESOLVED (2 awaiting verification), CLOSED (2 with star ratings), SLA_BREACHED, ESCALATED (2 escalation levels), REOPENED (chronic, reopened 3×), DUPLICATE, plus an anonymous report. Also 4 departments, 4 wards, 5 auto-assignment rules, 29 upvotes, 8 comments, a 4-message private thread, 10 notifications, and 9 SLAs (some active, some breached).

---

## 1. Public pages (no login)

1. Open `http://localhost:5173` — cinematic homepage, live stat counters animate up from zero.
2. **Browse issues** → try the search box (`pothole`), the category/status/ward filters, and each sort option.
3. Switch **List → Map → Heat**. Map pins are colored by severity; Heat shows hotspot density.
4. Click **📍 Issues near me** and allow location — the feed becomes distance-sorted with a radius picker.
5. Open any issue: photo gallery (click a thumbnail for the lightbox), voice note player on the pothole issue, SLA "expected fix by" bar, status timeline with progress photos, comments, and **Copy link / WhatsApp** share buttons.
6. **Transparency** (`/stats`) — city totals, category chart, and ward report cards graded A–F.
7. **Report anonymously** (`/report`) — submit with photos, a voice note, and the emergency checkbox. No login needed.
8. Visit a nonsense URL like `/nope` to see the 404 pigeon page.

## 2. Citizen

Log in as `citizen@civicfix.test`.

1. **Dashboard** — civic points chip, impact tiles, notifications (3 unread), recent complaints, earned badges, leaderboard (you are 2nd behind Priya).
2. **Report an Issue** — attach up to 5 photos, record a voice note, tap *Use My Location*. Watch the address auto-fill and the **"Already reported near this spot?"** panel appear with an Upvote button. Tick the 🚨 emergency box to see that flow. On submit you get the animated success tick.
3. **My Complaints** → open *Cracked footpath slabs near the vegetable market* (status Resolved):
   - See the **before/after photo comparison**
   - Give a **1–5 star rating** and confirm — the issue closes and your points jump
   - Or reject it to reopen (adds to the reopen count)
4. Open *Road surface broken outside the community hall* (In Progress) — read the **private thread** with Sunil Kumar and reply, then post a public comment.
5. Find a REPORTED complaint of yours and use **Withdraw report** (only available before work starts).
6. Click your name in the header → **Profile**: change your avatar, edit name/bio/ward/phone, view badges and impact, change your password.
7. Toggle **dark mode** with the ☾ button (bottom-right) — it persists across reloads.

## 3. Authority

Log in as `authority@civicfix.test` (or `engineer@civicfix.test` for the emergency).

1. **Dashboard** switches to the dark *Night Watch* theme automatically.
2. Scorecard tiles: avg resolution time, resolved this month, SLA hit rate, citizen ★ rating.
3. The queue is **sorted by urgency** — emergencies first, then breached SLAs, then nearest deadline. Each card shows a live ⏱ countdown (amber under 4 hours, red when breached).
4. Filter with the stat cards (Total / Pending / Active / Resolved) and toggle **List → Map** to see your assignments geographically.
5. Open the ASSIGNED issue (*Water pipeline leaking*, as Meera) → **Accept** → **Start Work**.
6. On an IN_PROGRESS issue: **post a progress update** with a note and photo (appears on the public timeline and notifies watchers), then **Resolve** with a resolution note and a **proof photo**.
7. **+ Log field issue** — file a report yourself; it's created pre-acknowledged and assigned to you.
8. Use the private thread on any assigned issue to message the reporter.

## 4. Admin

Log in as `admin@civicfix.test`.

1. **Dashboard**: stat tiles, SLA compliance %, average resolution time, 6-month trend column chart, bar charts by category / ward / severity, and the **"Needs a rethink" chronic issues** list.
2. **⬇ Export issues (CSV)** downloads the full dataset.
3. **Manage Issues** — assign or reassign an authority; use **Mark Duplicate** (paste another issue's ID) to merge upvotes.
4. **Manage Assignments** — the full assignment table with SLA badges and status filters.
5. **Departments & Wards** — create one, then set an **auto-assignment rule** (category → department). File a new report in that category and watch it route automatically.
6. **SLA Management** — set a deadline on an issue; the background job checks every 60 seconds and will breach/escalate it automatically.
7. **Users & Roles** — promote/demote anyone, and **create an authority account** with government ID, designation, phone, and department. The temporary password is shown exactly once with a copy button. Log out and sign in with it to confirm.
8. **Audit Log** — every status change across the platform, paginated.

## 5. Security checks worth trying

- Log in as a citizen and manually visit `/admin` → redirected away.
- Log in as an authority and visit `/admin/users` → redirected away.
- Open a private thread on an issue you are not part of → the thread does not appear.
- Register a new account → it is always a CITIZEN; there is no way to self-assign a staff role.
- Edit your stored token in localStorage to garbage and refresh → the app clears it and returns you to login.

## Resetting

```bash
cd backend
npm run seed     # wipes and rebuilds the entire demo dataset
```
