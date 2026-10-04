# Fixity — frontend

React 19 + Vite single-page app. See the [project README](../README.md) for the product and
[DESIGN.md](DESIGN.md) for the design system (tokens, components, charts, naming).

```bash
npm install
npm run dev        # http://localhost:5173, talks to VITE_API_URL (default http://localhost:5000)
npm run build      # production bundle in dist/
npm run lint       # oxlint
```

## Demo mode

`VITE_DEMO=1 npm run dev` (or `npm run build`) answers every API call in the browser:

- `src/demo/fixtures.json`: responses recorded from a real, seeded backend, per role. Timestamps are shifted so
  "2 hours ago" and countdowns stay current.
- `src/demo/mocks/*`: stateful handlers for the community features, the Cost Ledger, budgets and the admin audit
  feed, so votes, RSVPs and logged costs stick for the session.
- `src/demo/demoAdapter.js`: the axios adapter that routes requests, filters and pages the case list locally,
  and handles logins ("Explore without signing up" on the login page).

No data leaves the browser in demo mode, and nothing is saved.

## Layout

```
src/
  brand.js              product name, storage keys, feature names
  context/              auth (user, permissions, can()) and theme (light/dark/system)
  components/layout/    workspace shell, public chrome, navigation config
  components/ui/        page header, stat tiles, badges, modal, empty states…
  components/charts/    the chart kit
  pages/                one folder per area
  styles/               tokens → base → shell → components → charts → pages/*
```
