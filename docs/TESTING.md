# Fixity — Testing Guide

Two layers: automated tests in the backend, and a manual walkthrough per role against the demo city.

## Automated tests

```bash
cd backend
npm run typecheck                    # tsc, zero errors expected
npm test                             # unit tests (integration suite skipped)
TEST_DATABASE_URL=postgresql://… npm test   # + integration tests against a scratch database
```

`TEST_DATABASE_URL` must point at a migrated, disposable database. Every row the tests create is cleaned up.

| File | What it proves |
|---|---|
| `tests/permissions.test.ts` | The role set that reaches every gated route is pinned, so a matrix edit can't silently widen or narrow access. Citizens never hold admin-only permissions; admins hold everything officers hold. |
| `tests/geo.test.ts` | Haversine distances against known points, circle containment, bounding box ⊇ circle. |
| `tests/bulletin-rules.test.ts` | Active / upcoming / past windows; the Prisma `where` filters select exactly what the JS rules accept. |
| `tests/poll-rules.test.ts` | When poll results are visible (closed, voted, or staff). |
| `tests/pulse.test.ts` | City Pulse helpers: IST day/week/month buckets, median, A–F grades, backlog series, TTL cache eviction. |
| `tests/api.integration.test.ts` | Over real HTTP on a real Postgres: 401 without a token; citizen → 403 on publishing; officers' bulletins pinned to their department; a pin attempt by an officer → 403; watch zones owner-only (404) and capped at 5 (409); zone alerts reach owners but not the reporter; two simultaneous votes → exactly one 200 and one 409; voting on a closed poll → 400; a **demoted user's old token gets 403 immediately**; invalid input → 400 `VALIDATION_FAILED`; audit rows recorded with IP. |

Frontend: `cd frontend && npm run lint && npm run build`.

## Demo accounts

Seed the demo city first (`cd backend && npm run seed:demo`, about 3 s, re-runnable). It has 8 wards, about 800
cases over 12 months, and costs, budgets, bulletins, votes, drives and watch zones.

| Role | Email | Password | Notes |
|---|---|---|---|
| Citizen | `citizen@fixity.test` | `Citizen@123` | Kushagra Srivastava, Gandhi Nagar. Cases in every state, one fix waiting for Sign-Off, 2 Watch Zones, a pending drive proposal |
| Citizen | `priya@fixity.test`, `rahul@fixity.test`, `aisha@fixity.test` | `Citizen@123` | About 70 more neighbours exist, e.g. `sameer.khan@fixity.test` |
| Officer | `authority@fixity.test` | `Authority@123` | Sunil Kumar, Roads. Open jobs, a year of history, a Cost Ledger |
| Officer | `engineer@fixity.test` | `Authority@123` | Meera Joshi, Water. Has the live Red Alert |
| Admin | `admin@fixity.test` | `Admin@123` | Everything |

No backend handy? `cd frontend && VITE_DEMO=1 npm run dev`: the login page has one-click Citizen, Officer and Admin
buttons, and the whole app runs on recorded data.

---

## 1. Signed out

1. `/`: landing page with live numbers, the four-step journey, the six new features and ward grades.
   Toggle the theme (moon/sun) and reload: the choice sticks, with no flash.
2. **City Radar** (`/issues`):
   - Search, category chips, status, ward and sort filters (all kept in the URL).
   - **List / Map / Hotspots** views, and **Near me** with a radius ring.
   - "Load more" pages through the cases.
3. Open a **Case File**:
   - Gallery lightbox (arrow keys, Escape), Fix Clock bar, timeline with progress photos, crew steps, share
     buttons, mini map.
   - **Back it** sends you to log in and back again.
4. **City Pulse** (`/pulse`):
   - Switch 30 days / 90 days / 12 months, pick a ward, then a category. Every chart follows the filters.
   - Hover the line chart, or focus it and use the arrow keys.
   - Tap a ward bubble, then **Focus the Pulse on …**.
   - Use the table icon on any chart.
5. **Quick Drop** (`/report`): photos, voice note, GPS, Red Alert. Echo Check suggests nearby cases to back
   instead.
6. **Bulletins**, **Ward Vote** and **Drives** are all readable without an account; actions say "Log in to …".
7. Visit `/nope` for the 404 page.

## 2. Citizen

1. **Home**:
   - The waiting Sign-Off banner, Your Footprint tiles, Civic Cred badges and leaderboard.
   - "Around your ward": bulletins, votes, drives, Watch Zones.
2. **Snap & Send**: up to 5 photos, voice note, location. Echo Check offers **Back It** on nearby cases. Tick
   **Red Alert** to see the emergency flow.
3. **My Cases** → the Resolved case → **Sign-Off**: compare before and after, rate 1–5 stars, or reopen with a
   reason.
4. **Direct Line** on an in-progress case; **Street Talk** on any case.
5. **Watch Zones**:
   - Add a zone by clicking the map or using your location, set the radius and pick categories.
   - Select a zone to list the open cases inside it.
   - A 6th zone is refused.
   - Then file a report inside a zone with another citizen account: the zone owner gets an alert in the bell.
6. **Ward Vote**: cast a vote. The results appear and the vote is locked; a second vote is refused.
7. **Cleanup Drives**: RSVP to an upcoming drive, then cancel. **Propose a drive**: it shows "Sent for review" and
   appears under **Mine** as Proposed.
8. **Profile**: edit details, change password, pick Light / Dark / System.

## 3. Officer

1. **Crew Queue**:
   - Open jobs, most urgent first, with live Fix Clock countdowns (amber under 4 h, red when breached).
   - Filters: Open / To accept / Active / Resolved, with "Show more".
   - Switch to **Route Map**, and check the **Officer Scorecard**.
2. Open a job and run the **Job Flow**:
   - **Accept**, then **Start work**.
   - Post a **Site Update** with a photo.
   - **Resolve** with a proof photo.
3. **Cost Ledger** on the job:
   - Log material, labour or contractor spend, and delete your own entry within 24 h.
   - The total rolls up into **Budgets** (`/budgets`, your department only, no edit controls).
4. **Patrol Log**: file a case you spotted; it arrives already acknowledged and assigned to you.
5. **Ward Bulletins**: publish one. Your department is filled in, and there is no pin option.

## 4. Admin

1. **Command Deck**:
   - Tiles, the Fix Clock meter, monthly reports, and category / ward / severity / pipeline charts (each with a
     table view).
   - Repeat Offenders.
   - **Data Export** CSV.
2. **Case Desk**:
   - Open / Unassigned / Late come from the open set; **Closed** and **All** page from the server ("50 of 754",
     Load more).
   - Assign, change status with a note, open a case's Cost Ledger, merge a duplicate with the search picker.
3. **Dispatch**: every open job plus the last 30 days, workload per officer, and jobs waiting longest to be
   accepted.
4. **Fix Clock**: set a deadline with a preset and a live preview; **Run breach check**.
5. **Org & Routing**: add a department or ward, and route a category to a department.
6. **Access Control**:
   - Promote or demote with a confirm step (never yourself), approve officer applications.
   - Create an officer: the one-time password is shown once, with a copy button.
7. **Permission Matrix**: every permission × role, grouped and searchable.
8. **Paper Trail**: the **Case timeline** and **Admin actions** tabs (filter by kind, Load more).
9. **Budgets**:
   - Edit a department's monthly budget inline.
   - Rows turn amber at 85% and red over 100%.
   - Six months of spend against budget per department.
10. **Ward Vote**: open a vote with options linked to cases, then **Close now**. **Drives → Pending review**:
    approve or reject with a note.

## 5. RBAC and security checks

- As a citizen, open `/admin` or `/budgets`: you're sent back to your home. Call `GET /api/users` with the citizen
  token: 403 with `missing: ["user:manage"]`.
- As an officer, open `/admin/users`: redirected. `PUT /api/budgets` returns 403.
- **Instant revocation**: log in as an officer in one tab; as admin, demote them to Citizen. Their next click gets
  403 or 401 with no wait for token expiry.
- Read another citizen's watch zone (`GET /api/watch-zones/<their id>/issues`): 404.
- Send `GET /api/issues/admin/all?view=bogus` as admin: 400 `VALIDATION_FAILED` with field details.
- Hammer `POST /api/auth/login`: 429 after 30 tries in 15 minutes.
- Responses carry `X-Request-Id`, `Content-Security-Policy` and `X-Content-Type-Options` headers.
- Corrupt the stored token in localStorage and reload: the app clears it and returns to login.
