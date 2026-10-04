// Product identity in one place. To rename the product, change
// BRAND here and in backend/src/config/brand.ts.
export const BRAND = {
  name: "Fixity",
  tagline: "Fixes that stay fixed.",
  pitch:
    "Report a broken street in thirty seconds. Watch the city fix it, on a deadline, in public, until you sign it off.",
};

export const STORAGE_KEYS = {
  token: "fixity_token",
  theme: "fixity_theme",
  sidebar: "fixity_sidebar",
};

// Feature names used across the UI, so a rename is one edit.
export const FEATURES = {
  quickDrop: "Quick Drop", // anonymous report
  snapSend: "Snap & Send", // signed-in report
  autoSort: "AutoSort", // AI classification
  radar: "City Radar", // map, hotspots, near me
  caseFile: "Case File", // issue detail
  echoCheck: "Echo Check", // duplicate detection
  backIt: "Back It", // upvote + follow
  myCases: "My Cases",
  signOff: "Sign-Off", // citizen verifies the fix
  directLine: "Direct Line", // private chat
  streetTalk: "Street Talk", // public comments
  civicCred: "Civic Cred", // points, badges, leaderboard
  footprint: "Your Footprint", // impact stats
  redAlert: "Red Alert", // emergency flag
  crewQueue: "Crew Queue", // officer work queue
  routeMap: "Route Map", // officer map
  jobFlow: "Job Flow", // accept → start → resolve
  siteUpdates: "Site Updates", // progress updates
  patrolLog: "Patrol Log", // officer field report
  scorecard: "Officer Scorecard",
  commandDeck: "Command Deck", // admin dashboard
  caseDesk: "Case Desk", // admin issue management
  dispatch: "Dispatch", // assignments
  fixClock: "Fix Clock", // SLA
  orgRouting: "Org & Routing", // departments, wards, rules
  accessControl: "Access Control", // users & roles
  permissions: "Permission Matrix",
  paperTrail: "Paper Trail", // audit log
  repeatOffenders: "Repeat Offenders", // chronic issues
  dataExport: "Data Export",
  // New in Fixity
  pulse: "City Pulse",
  bulletins: "Ward Bulletins",
  watchZones: "Watch Zones",
  wardVote: "Ward Vote",
  costLedger: "Cost Ledger",
  budgets: "Budgets",
  drives: "Cleanup Drives",
};
