# CivicFix — Feature Documentation

Every feature in the platform, in plain language: what it's called, how to use it, and why it exists.

Roles: **Citizen** (public user), **Authority** (municipal officer), **Admin** (platform manager). Some features need no account at all.

---

## For Everyone (no login needed)

### Landing page
- **How to use:** Open the website. The homepage explains the product with live city statistics, and has Log in / Sign up buttons in the navbar.
- **Value added:** New visitors understand what CivicFix does in ten seconds and can see real proof (live numbers) that it works.

### Anonymous reporting
- **How to use:** Click "Report anonymously" on the homepage (or go to `/report`). Add photos, an optional voice note, location — no account needed.
- **Value added:** Removes the biggest barrier to reporting. A person standing at an open manhole shouldn't need to create a password first.

### Public issues browser
- **How to use:** Go to `/issues`. Search by text, filter by category / status / ward, sort by newest, oldest, or most upvoted.
- **Value added:** Full transparency — anyone can see every open problem in the city and its current state.

### Map, heatmap, and "near me"
- **How to use:** On the public issues page, switch between List / Map / Heat views. Tap "📍 Issues near me" to see problems around your location, with a 500 m – 5 km radius picker.
- **Value added:** The map shows *where* the city is broken; the heatmap shows *which areas* are neglected; near-me makes it personal.

### Issue detail page
- **How to use:** Click any issue. You'll see photos (gallery with lightbox), voice notes, status timeline with progress photos, SLA "expected fix by" progress bar, comments, assignment info, and share buttons (copy link / WhatsApp).
- **Value added:** One page tells the complete story of an issue from report to verified fix.

### Transparency page & ward report cards
- **How to use:** Go to `/stats`. See city-wide totals, average fix time, category breakdown, and each ward graded A–F on resolution rate + SLA compliance.
- **Value added:** Public accountability. Wards compete on grades; citizens see which areas keep their promises.

---

## For Citizens

### Sign up / Log in
- **How to use:** Create an account with name, email, password. New accounts are always Citizens — staff roles can only be granted by an Admin.
- **Value added:** Secure role-based access; nobody can self-promote into an authority.

### Report an issue
- **How to use:** Dashboard → "Report an Issue". Attach up to 5 photos, record a voice note (up to 2 min), tap "Use My Location" (GPS + auto address), tick 🚨 Emergency if it's a safety hazard, submit.
- **Value added:** A complete, geolocated, evidence-backed report in under a minute. AI (Gemini) reads the photo and classifies the category and severity automatically.

### Emergency flag
- **How to use:** Tick "🚨 This is an emergency" while reporting.
- **Value added:** Severity is forced to CRITICAL, every admin is alerted instantly, and the issue jumps to the top of the authority's queue.

### Duplicate detection
- **How to use:** When you set a location on the report form, a panel appears showing similar open issues within 500 m — with one-tap Upvote instead of filing again.
- **Value added:** Fifty duplicate reports of one pothole become one issue with fifty upvotes — a much stronger signal.

### Upvoting & watching
- **How to use:** Press "👍 Upvote" on any public issue. From then on you're notified whenever that issue changes status.
- **Value added:** Upvotes raise priority; watching keeps supporters informed without re-checking the page.

### My complaints & timeline
- **How to use:** Dashboard → "My Complaints". Each complaint shows a live timeline of every status change, note, and progress photo.
- **Value added:** No more "submitted into a black hole" — you can see exactly where your report stands.

### Verify the fix + star rating
- **How to use:** When an issue is marked Resolved, your complaint page shows a before/after photo comparison and asks "Has this been resolved?" Confirm with a 1–5 star satisfaction rating, or reopen it with a reason.
- **Value added:** The citizen — not the authority — closes the loop. Ratings feed the officer's public scorecard.

### Withdraw a report
- **How to use:** On your complaint page (while it's still unassigned), press "Withdraw report".
- **Value added:** Mistakes and already-fixed issues can be cleaned up by the reporter themselves.

### Private chat with the authority
- **How to use:** On your complaint page, use the "Private thread" to message the assigned officer directly.
- **Value added:** Gate codes, exact directions, clarifications — things that don't belong in public comments.

### Comments
- **How to use:** Every issue page has a public Discussion section; any signed-in user can post.
- **Value added:** Neighbours add context ("it's worse after rain"), authorities answer publicly.

### Civic points, badges & leaderboard
- **How to use:** Earn points automatically: +5 per report, +5 for verifying, +10 bonus when a fix is confirmed. Badges (First Report, Fixer, Change Maker…) unlock on the dashboard; the Top Contributors leaderboard ranks your ward.
- **Value added:** Gamification keeps citizens engaged after their first report.

### Impact stats
- **How to use:** Dashboard tiles show reports filed, "fixed because of you", and upvotes received.
- **Value added:** Shows each citizen their concrete effect on the city.

### Notifications
- **How to use:** The dashboard shows in-app notifications (acknowledged, work started, resolved, escalated, messages…). Each also goes out as an email when SMTP is configured.
- **Value added:** Citizens never need to poll the site to know something happened.

### Profile & dark mode
- **How to use:** Click your name → Profile to change your name or password. The ☾ button (bottom-right) toggles dark mode; the choice is remembered.
- **Value added:** Basic account hygiene plus comfortable night-time use.

---

## For Authorities

### Separate, verified accounts
- **How to use:** You can't sign up as an authority. An Admin creates the account with your government/employee ID, designation, phone, and department, and hands you a one-time temporary password. Log in and change it on your Profile.
- **Value added:** Authority access is provisioned, identity-verified, and auditable — like a real municipal system.

### Work queue with SLA countdowns
- **How to use:** The Authority Dashboard lists your assigned issues sorted most-urgent-first: emergencies on top, then breached SLAs, then nearest deadlines. Each card shows a live ⏱ countdown (amber under 4 hours, red when breached). Filter by Pending / Active / Resolved via the stat cards.
- **Value added:** The queue tells you what to do *next*, not just what exists.

### Map of my assignments
- **How to use:** Toggle List/Map on the dashboard to see your issues as pins.
- **Value added:** Plan a field route instead of criss-crossing the city.

### Accept → Start → Resolve workflow
- **How to use:** On an issue: Accept the assignment (citizen is notified), Start Work, then Resolve with a resolution note and a **photo of the completed work**.
- **Value added:** A disciplined state machine with an evidence trail at every step.

### Progress updates
- **How to use:** While work is In Progress, post a note + photo ("material delivered, patching tomorrow"). It appears on the public timeline and notifies all watchers.
- **Value added:** Citizens see movement, which prevents premature reopens and angry calls.

### Field survey mode
- **How to use:** Dashboard → "+ Log field issue". Photograph a problem you spotted on your rounds; it's created pre-acknowledged and assigned to you.
- **Value added:** Officers don't have to wait for a citizen to notice what they can already see.

### Performance scorecard
- **How to use:** Dashboard tiles show your average resolution time, issues resolved this month, SLA hit rate, and average citizen ★ rating.
- **Value added:** Officers see their own numbers before anyone else does.

### Private thread & comments
- **How to use:** Same chat and discussion tools as citizens, on every assigned issue.
- **Value added:** Direct line to the reporter without exchanging phone numbers.

---

## For Admins

### Analytics dashboard
- **How to use:** The Admin Dashboard shows SLA compliance %, average resolution time, monthly report trends, and issue breakdowns by category, ward, and severity as charts.
- **Value added:** A commissioner-level view of how the city is performing.

### Users & Roles (RBAC management)
- **How to use:** Admin → Users & Roles. See every user, promote/demote between Citizen ↔ Authority ↔ Admin (never your own account), and create authority accounts with the extended identity form. The generated temporary password is shown exactly once with a copy button.
- **Value added:** Complete role lifecycle management from the UI — no database access needed.

### Issue management
- **How to use:** Admin → Manage Issues. Assign/reassign authorities, update statuses with notes, and **Mark Duplicate** (upvotes merge into the original, the duplicate closes pointing at it).
- **Value added:** Keeps the issue database clean and every report actionable.

### Departments, wards & auto-assignment rules
- **How to use:** Admin → Departments & Wards. Create departments and wards, then map each issue category to a department ("Road damage → Roads & Infrastructure").
- **Value added:** New reports route themselves to the right department the moment they're filed.

### SLA management & auto-escalation
- **How to use:** Admin → SLA Management: set a resolution deadline on any issue. A background job checks every minute; breached issues are marked, auto-escalated with an escalation level, and every admin plus the assigned officer is notified.
- **Value added:** Deadlines enforce themselves — no report can quietly rot.

### Chronic issue detection
- **How to use:** Issues reopened 2+ times get a ♻ Chronic badge and appear in the "Needs a rethink" list on the admin dashboard, with an alert when the threshold is crossed.
- **Value added:** Surfaces problems where the *fix itself* is failing — different contractor, budget, or method needed.

### Audit log
- **How to use:** Admin → Audit Log: every status change platform-wide with who, when, and why, paginated.
- **Value added:** Full accountability trail for disputes and reviews.

### CSV export
- **How to use:** "⬇ Export issues (CSV)" on the admin dashboard downloads all issues with SLA and count columns.
- **Value added:** Data goes into Excel/BI tools for reports the platform doesn't build.

### Emergency alerts
- **How to use:** Automatic — every 🚨 emergency report notifies all admins the moment it's filed.
- **Value added:** Life-safety issues skip every queue.
