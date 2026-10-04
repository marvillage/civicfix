# Fixity — Feature Guide

Every feature in plain language: what it's called, who can use it, how, and why it exists.

Roles: **Citizen** (resident), **Officer** (municipal authority; `AUTHORITY` in the API), **Admin** (city operations). Some features need no account at all. Exactly who may do what is defined in one place, the permission matrix (`backend/src/auth/permissions.ts`), and admins can read it in the app under **Permission Matrix**.

> Renamed from CivicFix. The old feature names are listed in brackets so older notes still make sense.

---

## For everyone (no login needed)

### Landing page
- **How:** Open the site. Live city numbers, the five-step journey of a case, and links into every public feature.
- **Why:** A visitor understands the product in ten seconds and sees proof that it works.

### Quick Drop *(was: anonymous reporting)*
- **How:** "Report an issue" in the header, or `/report`. Photos (up to 5), an optional voice note, GPS with the address filled in, and a **Red Alert** box for hazards. No account.
- **Why:** The person standing next to an open manhole shouldn't have to create a password first.

### City Radar *(was: public issues, map, heatmap, near me)*
- **How:** `/issues`. Search, filter by category / status / ward, sort, and switch between **List**, **Map** and **Hotspots**. "Near me" sorts by distance with a 500 m – 5 km radius. Long lists load in pages ("Load more").
- **Why:** The map shows where the city is broken; Hotspots show which areas are neglected; Near me makes it personal.

### Case File *(was: issue detail page)*
- **How:** Open any case: photo gallery, voice note, key facts, the **Fix Clock** "expected fix by" bar, the full timeline with progress photos, **Back It**, share links and **Street Talk**.
- **Why:** One page tells the whole story of a problem from first photo to signed-off fix.

### City Pulse *(new; replaces the transparency page)*
- **How:** `/pulse`. One filter row (30 days / 90 days / 12 months, ward, category) drives every chart on the page:
  - headline tiles: reported (with change against the previous period and a trend line), fixed, open backlog, median time to fix, Fix Clock kept, resident rating
  - **Reported vs fixed** over time and the **backlog** curve
  - **When the city reports problems**: a weekday × hour heatmap (commute peaks stand out)
  - **What breaks**: cases per category with each category's median fix time
  - **Ward Scorecards**: a map of wards (bubble = open backlog, colour and letter = A–F grade) next to per-ward meters, with one tap to focus the whole page on a ward
  - **What each ward reports**: the category mix per ward, as shares or counts
  - **How residents rate the fixes**: the 1–5 star distribution from Sign-Offs
  - **Where the money goes**: Cost Ledger spend by category
  - **Departments**: cases fixed, median fix time, Fix Clock kept, rating and spend in one table
  
  Every chart has a table view and keyboard-readable tooltips.
- **Why:** Accountability you can see. Residents, journalists and councillors get the same numbers the admins see.

### Ward Bulletins *(new)*
- **How:** `/bulletins`. Planned roadworks, water or power outages, advisories and events, with tabs for **Active / Upcoming / Past** and filters for ward and kind. Pinned notices come first.
- **Why:** A lot of complaints are about work the city already knows about. Saying so in advance prevents duplicate reports and angry calls.

### Ward Vote *(new)*
- **How:** `/polls`. See open and closed votes, often "which of these should we fix first?" with options linked to real cases. Results show once you've voted or the vote closes.
- **Why:** Participatory budgeting in its simplest form. Residents set priorities, and the result is public.

### Cleanup Drives *(new)*
- **How:** `/drives`. Browse upcoming volunteer drives (date, place, capacity, organiser, linked case) and past ones.
- **Why:** Some problems are faster to fix together. Drives turn reporters into neighbours who act.

---

## For citizens

### Sign up / log in
- **How:** Name, email, password. New accounts are always citizens; staff roles are granted only by an admin.
- **Why:** Nobody can promote themselves into an officer.

### Snap & Send *(was: report an issue)*
- **How:** The yellow button at the top of the sidebar. Same as Quick Drop, plus points and tracking. **AutoSort** *(was: AI classification)* reads the photo and sets the category and severity.
- **Why:** A complete, geolocated, evidence-backed report in under a minute.

### Echo Check *(was: duplicate detection)*
- **How:** When you set a location, similar open cases within 500 m appear with a one-tap **Back It** button instead of filing again.
- **Why:** Fifty duplicate reports of one pothole become one case with fifty backers, which is a much stronger signal.

### Back It *(was: upvote & watch)*
- **How:** "Back it" on any case. Backers raise priority and get an alert on every status change.

### My Cases *(was: my complaints)*
- **How:** Each case shows a live timeline of every status change, note and progress photo.

### Sign-Off *(was: verify the fix + star rating)*
- **How:** When a case is resolved you see a before/after comparison. Sign it off with 1–5 stars, or reopen it with a reason.
- **Why:** The resident, not the department, closes the loop. Ratings feed the officer's scorecard and City Pulse.

### Withdraw
- **How:** On your case, while it's still unassigned.

### Direct Line *(was: private chat)* and Street Talk *(was: comments)*
- **How:** Direct Line is a private thread with the assigned officer; Street Talk is the public discussion on every case.

### Watch Zones *(new)*
- **How:** `/watch-zones`. Draw up to five circles (home, office, a child's school route): click the map or use your location, set a radius from 100 m to 5 km, and optionally pick categories. Each zone lists the open cases inside it.
- **Alerts:** whenever a **new** case is reported inside a zone and matches its categories, you get an alert (and an email when SMTP is configured). You are never alerted about your own report.
- **Why:** You learn about problems on your street without checking the site.

### Ward Vote (voting)
- **How:** Pick one option and cast your vote. One vote per poll, enforced by the database, not just the button. +2 Civic Cred.

### Cleanup Drives (taking part)
- **How:** **Propose a drive** (title, description, time at least 2 h ahead, capacity, location, optional linked case); an admin reviews it. Once approved, neighbours **RSVP** until it's full. After the drive the organiser marks attendance: **+15 Civic Cred** per attendee and **+25** for the organiser.

### Civic Cred *(was: civic points, badges & leaderboard)* and Your Footprint *(was: impact stats)*
- **How:** Points for reports (+5), sign-offs (+5), confirmed fixes (+10), votes (+2) and drives (+15/+25). Badges unlock on your dashboard; the ward leaderboard ranks contributors. Your Footprint shows reports filed, fixes you caused, and backers received.

### Alerts
- **How:** The bell in the top bar: status changes, messages, Watch Zone hits, bulletins for your ward, drive decisions. Mirrored to email when SMTP is set.

### Profile & appearance
- **How:** Edit name, bio, ward and phone; change your password; pick **Light, Dark or System** appearance (also in the user menu).

---

## For officers

### Verified accounts
- **How:** Officers can't self-register into access. An admin provisions the account (government/employee ID, designation, phone, department) and hands over a one-time password; or an officer applies at `/register/authority` and waits for approval.

### Crew Queue *(was: work queue)* and Route Map *(was: map of my assignments)*
- **How:** Your jobs, most urgent first: Red Alerts, then breached Fix Clocks, then the nearest deadlines. Each shows a live countdown. Switch to the map to plan a route.

### Job Flow *(was: accept → start → resolve)* and Site Updates *(was: progress updates)*
- **How:** Accept, start work, post Site Updates (note + photo, visible publicly), then resolve with a proof photo.

### Cost Ledger *(new)*
- **How:** On a job you're assigned to, log what the fix cost: material, labour, equipment or contractor, with a description and an amount in rupees. You can delete your own entry within 24 hours. Officers in the same department can read the ledger.
- **Why:** Every fix has a price tag. Rolled up, it powers **Budgets** and the spend charts in City Pulse.

### Budgets *(new; officers see their own department)*
- **How:** `/budgets` shows this month's budget against spend for your department, and the last six months.

### Ward Bulletins (publishing)
- **How:** Officers publish bulletins for their own department (the department is filled in automatically). Only admins can pin.

### Patrol Log *(was: field survey mode)*
- **How:** Log a problem you spotted on your rounds; it's created already acknowledged and assigned to you.

### Officer Scorecard *(was: performance scorecard)*
- **How:** Average resolution time, fixes this month, Fix Clock hit rate and your average resident rating.

---

## For admins

### Command Deck *(was: admin dashboard)*
- **How:** Headline tiles, Fix Clock compliance, monthly reports, cases by category / ward / severity / status (all with table views), Repeat Offenders, and shortcuts to every tool. **Data Export** downloads every case as CSV.

### Case Desk *(was: issue management)*, Dispatch *(was: assignments)*
- **How:** Assign and reassign officers, change statuses with notes, merge duplicates (backers move to the original). Dispatch shows every officer's workload.

### Fix Clock *(was: SLA management)*
- **How:** Set a deadline on any case. A background job checks every minute; breaches are marked, escalated with a level, and alerted to admins and the officer.

### Org & Routing *(was: departments, wards & rules)*
- **How:** Create departments and wards, then map each category to a department so new cases route themselves.

### Access Control *(was: users & roles)*
- **How:** Promote or demote users (never yourself), approve officer applications, create officer accounts with a one-time password. Role changes take effect on the user's **next request**: the API reads the current role from the database on every call, not from the token.

### Permission Matrix *(new)*
- **How:** `/admin/access`: every permission, grouped and searchable, with which roles hold it. It's read from the API, so it's always the matrix the server actually enforces.

### Budgets (managing)
- **How:** Set each department's monthly budget inline; see who is over (more than 100%) or close (85% or more), and six months of spend against budget per department.

### Ward Vote (running votes) and Bulletins (moderating)
- **How:** Open a vote with 2–6 options (optionally linked to cases) and a closing time; close it early if needed. Pin or remove any bulletin.

### Cleanup Drives (moderating)
- **How:** The **Pending review** tab lists proposals; approve or reject with a note, and the organiser is told.

### Paper Trail *(was: audit log)*
- **How:** Two tabs. **Case timeline** has every status change with who, when and why. **Admin actions** has every privileged action (role changes, approvals, bulletins, votes, budgets, drive moderation, cost deletions, org and Fix Clock changes) with the actor, time, IP and details, filterable by kind.

### Repeat Offenders *(was: chronic issues)*
- **How:** Cases reopened twice or more appear on the Command Deck: the fix itself isn't holding.

### Red Alert *(was: emergency alerts)*
- **How:** Every Red Alert report forces CRITICAL severity and alerts all admins the moment it's filed.
