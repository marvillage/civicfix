# Fixity design system

White carries content, **navy** carries structure, **signal yellow** carries action and attention.
Light and dark are both designed: navy buttons on white become yellow buttons on navy.

The reference implementation is `src/pages/admin/AdminDashboard.jsx` (Command Deck) — copy its patterns.

## Files

| File | What lives there |
|---|---|
| `src/styles/tokens.css` | All colors, radii, shadows, fonts, chart series. **The only place raw hex values may appear.** |
| `src/styles/base.css` | Reset, type, buttons, forms, alerts, badges/chips, spinner, motion |
| `src/styles/shell.css` | Logo, workspace shell (sidebar + topbar), public header/footer, page scaffold, segmented control |
| `src/styles/components.css` | Cards, stat tiles, detail grids, case cards, tables, tabs, filters, empty state, modal, timeline, meter |
| `src/styles/charts.css` | Chart kit styles |
| `src/styles/pages/*.css` | One file per area; page-specific classes only |
| `src/brand.js` | Product name, storage keys, **feature names** (`FEATURES.*`) |
| `src/lib/labels.js` | Category/status/severity labels + icons + category colors |
| `src/lib/format.js` | Number, ₹, %, hours, dates, `timeAgo` |
| `src/components/ui/index.jsx` | `PageHeader`, `SectionHeader`, `StatTile`, `StatusBadge`, `SeverityBadge`, `CategoryChip`, `Avatar`, `EmptyState`, `Loading`, `Segmented`, `Card` |
| `src/components/charts/index.jsx` | `ChartFrame`, `LineChart`, `ColumnChart`, `BarList`, `StackedBars`, `Heatmap`, `Sparkline`, `Meter`, `Legend`, `ChartTable` |
| `src/components/layout/*` | `AppShell` (signed in), `PublicShell` + `PublicHeader` + `SiteFooter` (signed out), `Layout` (picks one), navigation config |

## Page anatomy

Pages render **inside** a shell; the shell already provides navigation, theme toggle, alerts and the user menu.
So pages never render their own "Home", "My Profile" or "Log out" buttons.

```jsx
<div className="page">                     {/* vertical rhythm: 22px gaps */}
  <PageHeader eyebrow={FEATURES.x} title="…" description="…" actions={<>…</>} />
  <section className="kpi-row">…<StatTile/>…</section>
  <section className="grid-2">…cards / ChartFrame…</section>
  <section className="card">
    <SectionHeader eyebrow="…" title="…" description="…" actions={…} />
    …
  </section>
</div>
```

Layout helpers: `.grid-2`, `.grid-3`, `.grid-main-side` (content + 340px rail), `.stack`, `.stack-sm`, `.kpi-row`.
Everything must work at **360px wide** with no horizontal page scroll, and on wide screens (content max 1240px).

## Buttons & links

- Bare `<button>` = primary (navy in light / yellow in dark). Add classes to change it:
  `btn-accent` (yellow CTA in both modes — the one main action on a page), `btn-secondary` (outlined),
  `btn-ghost`, `btn-danger`, `btn-danger-ghost`, sizes `btn-sm` / `btn-lg`, `btn-block`, `icon-button` (needs `aria-label`).
- Links that look like buttons: `<Link className="btn btn-accent">`. Don't nest `<button>` inside `<Link>` in new code.
- Icons: **lucide-react only** (no emoji in UI chrome). Size comes from CSS; add `aria-hidden="true"` to decorative icons.
- Inline text links: `.text-link`.

## Forms

`.field` (or legacy `.form-group`) wraps `label` + control + `.field-hint`. `.form-row` puts fields side by side
(auto-wraps). Alerts: `.form-error`, `.form-success`, `.form-info`, `.alert-warning`. Inputs, selects, textareas,
checkboxes and file inputs are styled globally.

## Badges & chips

`<StatusBadge status>`, `<SeverityBadge severity>`, `<CategoryChip category short?>` (colored dot = the category's
chart color), role chips `.role-badge.role-citizen|role-authority|role-admin`, generic `.chip` + `.chip-accent`,
`.chip-navy`, `.chip-outline`, `.chip-success|warning|danger|info`. Emergency: `.red-alert`.
Status color is never the only signal — badges always carry a label.

## Cards & surfaces

`.card` (also legacy `.details-card`), `.card-accent` (yellow-washed highlight), `.card-navy` (dark feature card),
`.card-link` (whole card clickable), `.card-flush` (no padding, e.g. a map), `.card-head` for title rows.
Case lists: `.issue-card` / `.complaint-card` with `-header`, `.issue-meta`, `.complaint-description`.
Tables: wrap `.data-table` in `.table-scroll`; numeric cells get `.num`.
Tabs: `.tabs` + `.tab.is-active`. Filters: `.filters-bar` (+ `.search-field` with an icon). Empty: `<EmptyState>`.

## Charts

Use the kit, never a new library. Rules it already enforces: validated palette (`--series-1..8`), thin marks,
hairline grid, hover/focus tooltips, and a **table view toggle** — always pass `table={{ columns, rows }}` to
`ChartFrame`. Colors: a category always uses `CATEGORY_META[cat].series`; one-series charts use `--series-1`
(highlight one bar with `--series-2` if it's the point). Ordered scales (severity, stars) use a single-hue ramp:
`color-mix(in oklab, var(--seq-high) N%, var(--seq-low))`. Never dual axes. Text never takes the series color.

## Voice & names

Sentence case everywhere. Short, concrete, active ("Back it", "Sign off the fix"). Use `FEATURES.*` names from
`brand.js` instead of hard-coding feature names, and `BRAND.name` instead of the product name.

| Old | New |
|---|---|
| CivicFix | `BRAND.name` (Fixity) |
| Anonymous report | Quick Drop |
| Report an issue (signed in) | Snap & Send |
| AI classification | AutoSort |
| Map / heatmap / near me | City Radar (views: List, Map, Hotspots; "Near me") |
| Issue detail page | Case File |
| Duplicate detection | Echo Check |
| Upvote / watch | Back It ("12 backers") |
| My complaints | My Cases |
| Verify fix + stars | Sign-Off |
| Private chat | Direct Line |
| Comments | Street Talk |
| Points, badges, leaderboard | Civic Cred |
| Impact stats | Your Footprint |
| Emergency | Red Alert |
| Authority dashboard / work queue | Crew Queue |
| Assignment map | Route Map |
| Accept → start → resolve | Job Flow |
| Progress updates | Site Updates |
| Field survey | Patrol Log |
| Performance tiles | Officer Scorecard |
| Admin dashboard | Command Deck |
| Manage issues | Case Desk |
| Manage assignments | Dispatch |
| SLA | Fix Clock |
| Departments & wards & rules | Org & Routing |
| Users & roles | Access Control |
| Audit log | Paper Trail |
| Chronic issues | Repeat Offenders |
| CSV export | Data Export |
| Transparency page / ward report cards | City Pulse / Ward Scorecards |
| Authority (role label in UI) | Officer |

## Accessibility checklist

Every interactive element is keyboard reachable with a visible focus ring (global `:focus-visible`), icon-only
buttons have `aria-label`, images have `alt`, color is never the only signal, text contrast ≥ 4.5:1 in both
themes (use `--text`, `--text-2`, `--text-3`; never put yellow text on white — use `--accent-text`), motion
respects `prefers-reduced-motion`.

## RBAC in the UI

`const { can } = useAuth(); can("bulletin:publish")` or `<Can permission="…">`. Show or hide actions by
permission, never by role name. The server enforces the same permissions; the UI just avoids offering what will be
refused. Route guards: `<ProtectedRoute permission="…">`.
