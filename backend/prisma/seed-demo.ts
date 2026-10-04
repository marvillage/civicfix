import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import {
  BulletinKind,
  CostKind,
  IssueCategory,
  IssueStatus,
  Prisma,
  Severity,
} from "../src/generated/prisma/client";
import { lastMonthKeys } from "../src/services/pulse.helpers";

/**
 * Demo seed: mock accounts + realistic data covering every feature
 * and every issue status, so the whole app can be tested by hand.
 *
 * Two layers:
 *   1. Curated stories — hand-written recent cases, people,
 *      conversations and photos the demo walks through. They stay
 *      the newest cases in the system.
 *   2. Generated history — about a year of cases from a seeded
 *      PRNG (same output for the same day), with seasonal and
 *      daily rhythms, ward and department performance differences,
 *      costs, budgets and ratings, so City Pulse has something
 *      real to say. Plus bulletins, polls, drives, watch zones and
 *      an audit trail.
 *
 *   npm run seed:demo     -> wipe everything and reseed
 */

const PASSWORDS = {
  citizen: "Citizen@123",
  authority: "Authority@123",
  admin: "Admin@123",
};

// ─────────────────────────────────────────────
// TIME
// ─────────────────────────────────────────────

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const IST_OFFSET = 330 * 60_000; // Asia/Kolkata, no DST

// Street photos bundled with the frontend (frontend/public/demo). The
// seed key picks the closest subject; variants alternate by key so
// "pothole-a" and "pothole-b" don't show the same picture.
const DEMO_PHOTOS: [RegExp, string[]][] = [
  [/proof|resolved/, ["resolved-road", "resolved-street"]],
  [/progress/, ["progress-crew"]],
  [/streetlight|lamp|light/, ["streetlight-lane", "streetlight-dusk"]],
  [/water|pipe|leak/, ["water-main"]],
  [/drain|sewage|manhole|cover|flood/, ["drain-waterlogged"]],
  [/garbage|bin|debris|waste/, ["garbage-bin"]],
  [/pothole|road|cavein|chronic|footpath|dup|crack/, ["road-pothole", "road-cracked"]],
];

function keyHash(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

const photo = (seed: string) => {
  const match = DEMO_PHOTOS.find(([pattern]) => pattern.test(seed));
  const files = match?.[1] ?? ["road-pothole"];

  return `/demo/${files[keyHash(seed) % files.length]}.webp`;
};

const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=112548&textColor=ffc629`;

const hoursAgo = (h: number) => new Date(NOW - h * HOUR);

const hoursAhead = (h: number) => new Date(NOW + h * HOUR);

const daysAgo = (d: number) => hoursAgo(d * 24);

// Local midnight today, and a wall-clock time on a local day
// relative to today (negative = past).
const TODAY_IST =
  Math.floor((NOW + IST_OFFSET) / DAY) * DAY - IST_OFFSET;

const istAt = (dayOffset: number, hour: number, minute = 0) =>
  new Date(TODAY_IST + dayOffset * DAY + (hour * 60 + minute) * 60_000);

// Monday = 0 … Sunday = 6, for today in India.
const TODAY_WEEKDAY =
  (new Date(TODAY_IST + IST_OFFSET).getUTCDay() + 6) % 7;

// Generated history ends before the oldest "recent" curated
// story, so the curated cases are always the newest.
const HISTORY_ENDS = NOW - 150 * HOUR;

// ─────────────────────────────────────────────
// SEEDED RANDOMNESS
// ─────────────────────────────────────────────

function mulberry32(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const rand = mulberry32(20_261_004);

const between = (min: number, max: number) =>
  min + rand() * (max - min);

const randInt = (min: number, max: number) =>
  Math.floor(between(min, max + 1));

const chance = (p: number) => rand() < p;

const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)];

function pickWeighted<T>(
  items: readonly T[],
  weight: (item: T) => number
): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let r = rand() * total;

  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }

  return items[items.length - 1];
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

// Standard normal (Box–Muller).
function gaussian() {
  const u = 1 - rand();
  const v = rand();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Knuth's method; fine for the small daily rates used here.
function poisson(lambda: number) {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = rand();

  while (p > limit) {
    k++;
    p *= rand();
  }

  return k;
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const makeId = () =>
  "c" +
  Array.from(
    { length: 24 },
    () => ID_ALPHABET[Math.floor(rand() * 36)]
  ).join("");

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, step: number) =>
  Math.max(step, Math.round(value / step) * step);

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

// ─────────────────────────────────────────────
// ORGANISATION
// ─────────────────────────────────────────────

type DeptKey = "roads" | "sanitation" | "water" | "electrical";

const DEPT_KEYS: DeptKey[] = [
  "roads",
  "sanitation",
  "water",
  "electrical",
];

// How each department performs: median fix time (hours, at
// MEDIUM severity), citizen rating, how often a fix fails.
const DEPARTMENTS: Record<
  DeptKey,
  {
    name: string;
    fixMedianH: number;
    rating: number;
    reopen: number;
    breachPenalty: number;
  }
> = {
  roads: {
    name: "Roads & Infrastructure",
    fixMedianH: 70,
    rating: 3.3,
    reopen: 0.07,
    breachPenalty: 0.04,
  },
  sanitation: {
    name: "Sanitation & Waste",
    fixMedianH: 20,
    rating: 3.85,
    reopen: 0.025,
    breachPenalty: 0,
  },
  water: {
    name: "Water & Drainage",
    fixMedianH: 46,
    rating: 3.45,
    reopen: 0.04,
    breachPenalty: 0.02,
  },
  electrical: {
    name: "Electrical & Lighting",
    fixMedianH: 28,
    rating: 4.15,
    reopen: 0.03,
    breachPenalty: -0.02,
  },
};

const CATEGORY_DEPT: Record<IssueCategory, DeptKey> = {
  ROAD_DAMAGE: "roads",
  OTHER: "roads",
  GARBAGE: "sanitation",
  WATER_LEAKAGE: "water",
  DRAINAGE: "water",
  STREETLIGHT: "electrical",
};

interface WardSpec {
  key: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  volume: number; // relative report volume
  quality: number; // 0 (struggling) … 1 (excellent)
  affinity?: Partial<Record<IssueCategory, number>>;
  streets: string[];
}

// The first four are the original demo wards (their centres
// match the curated stories); the last four ring central Delhi.
const WARDS: WardSpec[] = [
  {
    key: "W12",
    name: "Gandhi Nagar",
    code: "W-12",
    lat: 28.615,
    lng: 77.2105,
    volume: 1.0,
    quality: 0.55,
    streets: [
      "Gandhi Market Road",
      "DAV School Lane",
      "Main Bazaar",
      "Gali No. 4",
      "Shiv Mandir Marg",
    ],
  },
  {
    key: "W7",
    name: "Nehru Colony",
    code: "W-07",
    lat: 28.62,
    lng: 77.206,
    volume: 0.85,
    quality: 0.75,
    streets: [
      "Nehru Colony Junction",
      "Block C",
      "4th Cross",
      "Nehru Colony Main Road",
      "Community Park",
    ],
  },
  {
    key: "W3",
    name: "Rajendra Park",
    code: "W-03",
    lat: 28.6098,
    lng: 77.215,
    volume: 0.7,
    quality: 0.7,
    streets: [
      "Park Road",
      "Clinic Road",
      "Lane 3",
      "Rajendra Park Market",
      "Gurudwara Road",
    ],
  },
  {
    key: "W21",
    name: "Model Town",
    code: "W-21",
    lat: 28.6225,
    lng: 77.2185,
    volume: 1.0,
    quality: 0.35,
    affinity: { ROAD_DAMAGE: 1.3 },
    streets: [
      "Station Road",
      "Community Hall Road",
      "Central Park Gate",
      "Flyover Ramp",
      "Model Town Bus Stop",
    ],
  },
  {
    key: "W15",
    name: "Karol Bagh",
    code: "W-15",
    lat: 28.6519,
    lng: 77.1907,
    volume: 1.4,
    quality: 0.45,
    affinity: { GARBAGE: 1.5, ROAD_DAMAGE: 1.1 },
    streets: [
      "Ajmal Khan Road",
      "Gaffar Market",
      "Pusa Road",
      "Bank Street",
      "Arya Samaj Road",
    ],
  },
  {
    key: "W02",
    name: "Civil Lines",
    code: "W-02",
    lat: 28.6805,
    lng: 77.224,
    volume: 0.6,
    quality: 0.9,
    affinity: { STREETLIGHT: 1.3, GARBAGE: 0.7 },
    streets: [
      "Rajpur Road",
      "Alipur Road",
      "Underhill Road",
      "Shamnath Marg",
      "Civil Lines Metro Gate",
    ],
  },
  {
    key: "W09",
    name: "Daryaganj",
    code: "W-09",
    lat: 28.6425,
    lng: 77.2405,
    volume: 1.0,
    quality: 0.3,
    affinity: { WATER_LEAKAGE: 1.4, DRAINAGE: 1.3 },
    streets: [
      "Netaji Subhash Marg",
      "Ansari Road",
      "Golcha Cinema Lane",
      "Delite Cinema Crossing",
      "Kasturba Hospital Road",
    ],
  },
  {
    key: "W27",
    name: "Laxmi Nagar",
    code: "W-27",
    lat: 28.631,
    lng: 77.276,
    volume: 1.5,
    quality: 0.2,
    affinity: { DRAINAGE: 1.5, WATER_LEAKAGE: 1.3 },
    streets: [
      "Vikas Marg",
      "Laxmi Nagar Metro",
      "Shakarpur Chowk",
      "Lalita Park",
      "Ramesh Park Road",
    ],
  },
];

// ─────────────────────────────────────────────
// RHYTHMS — how often each category is reported
// ─────────────────────────────────────────────

const CATEGORIES: IssueCategory[] = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "GARBAGE",
  "WATER_LEAKAGE",
  "DRAINAGE",
  "OTHER",
];

// Reports per day citywide at a seasonal factor of 1.
const BASE_PER_DAY: Record<IssueCategory, number> = {
  ROAD_DAMAGE: 0.55,
  STREETLIGHT: 0.36,
  GARBAGE: 0.6,
  WATER_LEAKAGE: 0.3,
  DRAINAGE: 0.22,
  OTHER: 0.08,
};

// Month factors, Jan … Dec. Monsoon (Jul–Sep) floods drains
// and breaks roads and pipes; long foggy winter nights expose
// dead streetlights; festivals (Oct–Nov, Holi in March) pile
// up garbage.
const SEASON: Record<IssueCategory, number[]> = {
  ROAD_DAMAGE: [0.9, 0.85, 0.9, 0.95, 1, 1.05, 1.5, 1.6, 1.4, 1.1, 0.95, 0.9],
  STREETLIGHT: [1.7, 1.5, 1.1, 0.9, 0.75, 0.7, 0.8, 0.8, 0.9, 1.15, 1.55, 1.8],
  GARBAGE: [0.95, 0.95, 1.2, 1, 1, 0.95, 1.05, 1.05, 1, 1.45, 1.6, 1.05],
  WATER_LEAKAGE: [0.7, 0.7, 0.8, 1, 1.25, 1.35, 1.9, 2, 1.6, 0.9, 0.75, 0.7],
  DRAINAGE: [0.4, 0.4, 0.45, 0.5, 0.7, 1.4, 3.2, 3.4, 2.4, 0.8, 0.5, 0.45],
  OTHER: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

// Monday … Sunday: people report on the way to work; Sundays
// are quiet.
const WEEKDAY_FACTOR = [1.15, 1.05, 1, 1, 0.95, 0.8, 0.55];

// Local hour weights: commute peaks 8–10 am and 6–9 pm.
const HOUR_WEIGHTS = [
  0.2, 0.1, 0.1, 0.1, 0.15, 0.4, 1, 2, 3.6, 3.8, 2.8, 2, 1.7, 1.6,
  1.5, 1.5, 1.7, 2.3, 3.2, 3.6, 3.2, 2.2, 1.2, 0.5,
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// Dead streetlights are noticed after dark.
const hourWeight = (category: IssueCategory, hour: number) =>
  HOUR_WEIGHTS[hour] *
  (category === "STREETLIGHT" && (hour >= 18 || hour <= 5) ? 1.8 : 1);

// One-off days: Diwali 2025 and Holi 2026 clean-ups, and the
// monsoon's cloudbursts.
const SPECIAL_DAYS: Record<string, Partial<Record<IssueCategory, number>>> =
  {
    "2025-10-21": { GARBAGE: 3 },
    "2025-10-22": { GARBAGE: 2 },
    "2026-03-05": { GARBAGE: 2 },
    "2026-07-14": { DRAINAGE: 4, WATER_LEAKAGE: 2, ROAD_DAMAGE: 1.5 },
    "2026-07-29": { DRAINAGE: 3.5, WATER_LEAKAGE: 1.8 },
    "2026-08-11": { DRAINAGE: 4, WATER_LEAKAGE: 2, ROAD_DAMAGE: 1.6 },
    "2026-08-23": { DRAINAGE: 3, ROAD_DAMAGE: 1.4 },
    "2026-09-03": { DRAINAGE: 2.5, WATER_LEAKAGE: 1.5 },
  };

const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// LOW, MEDIUM, HIGH, CRITICAL
const SEVERITY_MIX: Record<IssueCategory, number[]> = {
  ROAD_DAMAGE: [15, 45, 30, 10],
  STREETLIGHT: [30, 50, 18, 2],
  GARBAGE: [35, 50, 13, 2],
  WATER_LEAKAGE: [10, 45, 35, 10],
  DRAINAGE: [10, 40, 35, 15],
  OTHER: [50, 40, 10, 0],
};

const SLA_HOURS: Record<Severity, number> = {
  LOW: 168,
  MEDIUM: 120,
  HIGH: 72,
  CRITICAL: 24,
};

const SEVERITY_FIX: Record<Severity, number> = {
  LOW: 1.3,
  MEDIUM: 1,
  HIGH: 0.7,
  CRITICAL: 0.3,
};

// ─────────────────────────────────────────────
// COPY — titles, notes, comments
// ─────────────────────────────────────────────

const TITLES: Record<IssueCategory, string[]> = {
  ROAD_DAMAGE: [
    "Pothole on {street}",
    "Deep pothole near {street}",
    "Broken road surface on {street}",
    "Road sinking at {street}",
    "Damaged speed breaker on {street}",
    "Cracked footpath on {street}",
    "Loose paver blocks at {street}",
  ],
  STREETLIGHT: [
    "Streetlight not working on {street}",
    "Three streetlights dark on {street}",
    "Flickering streetlight near {street}",
    "Leaning streetlight pole at {street}",
    "Exposed wiring at lamp post, {street}",
  ],
  GARBAGE: [
    "Garbage pile-up on {street}",
    "Overflowing community bin at {street}",
    "Garbage not collected for days on {street}",
    "Construction debris dumped on {street}",
    "Garbage being burnt near {street}",
  ],
  WATER_LEAKAGE: [
    "Water pipeline leaking on {street}",
    "Burst water main at {street}",
    "Leaking valve chamber near {street}",
    "Dirty water in supply on {street}",
    "Clean water wasting from broken pipe at {street}",
  ],
  DRAINAGE: [
    "Blocked drain on {street}",
    "Waterlogging after rain at {street}",
    "Sewage overflowing on {street}",
    "Missing drain cover at {street}",
    "Choked storm drain near {street}",
  ],
  OTHER: [
    "Fallen tree branch blocking {street}",
    "Stray cattle blocking traffic on {street}",
    "Broken park bench near {street}",
    "Illegal hoarding on {street}",
    "Damaged bus shelter at {street}",
  ],
};

const DESCRIPTIONS: Record<IssueCategory, string[]> = {
  ROAD_DAMAGE: [
    "Two-wheelers swerve into the next lane to avoid it. It fills with water whenever it rains.",
    "The surface has broken up over a few metres and loose gravel is spreading across the road.",
    "Autos and cycles keep bottoming out here. It gets worse every week.",
  ],
  STREETLIGHT: [
    "The stretch is completely dark after 7 pm. Women and older residents avoid walking here.",
    "The lamp has been out for over a week. Chain snatching was reported nearby.",
    "It flickers on and off all night, which is worse than no light at all.",
  ],
  GARBAGE: [
    "Bins have not been cleared for days. Stray dogs are scattering waste across the footpath.",
    "Shops and households are dumping waste in the open. The smell reaches the houses nearby.",
    "A pile of mixed waste is blocking half the lane and attracting flies.",
  ],
  WATER_LEAKAGE: [
    "Clean water has been flowing onto the road since morning. Supply pressure in homes has dropped.",
    "The leak is undermining the road surface; it is starting to sink near the pipe.",
    "Residents are getting muddy water in their taps since the leak started.",
  ],
  DRAINAGE: [
    "Even a short shower leaves knee-deep water here for hours. Shops have water coming in.",
    "The drain is choked with silt and plastic. Mosquitoes are breeding in the standing water.",
    "Sewage is surfacing onto the street and the smell is unbearable.",
  ],
  OTHER: [
    "It has been like this for days and nobody seems responsible for it.",
    "It is blocking the footpath, so people are walking on the road.",
  ],
};

const IMAGES: Record<IssueCategory, string[]> = {
  ROAD_DAMAGE: ["/demo/road-pothole.webp", "/demo/road-cracked.webp"],
  STREETLIGHT: ["/demo/streetlight-dusk.webp", "/demo/streetlight-lane.webp"],
  GARBAGE: ["/demo/garbage-bin.webp"],
  WATER_LEAKAGE: ["/demo/water-main.webp"],
  DRAINAGE: ["/demo/drain-waterlogged.webp"],
  OTHER: ["/demo/road-cracked.webp"],
};

const RESOLVED_IMAGE: Record<IssueCategory, string> = {
  ROAD_DAMAGE: "/demo/resolved-road.webp",
  OTHER: "/demo/resolved-road.webp",
  STREETLIGHT: "/demo/resolved-street.webp",
  GARBAGE: "/demo/resolved-street.webp",
  WATER_LEAKAGE: "/demo/resolved-street.webp",
  DRAINAGE: "/demo/resolved-street.webp",
};

const PROGRESS_IMAGE = "/demo/progress-crew.webp";

const RESOLUTION_NOTES: Record<IssueCategory, string[]> = {
  ROAD_DAMAGE: [
    "Pothole cut, filled with hot mix and rolled. Please verify.",
    "Surface relaid over the damaged stretch.",
    "Paver blocks reset and edges sealed.",
  ],
  STREETLIGHT: [
    "Faulty driver replaced; light tested after dusk.",
    "New LED fitting installed and wiring insulated.",
    "Feeder fault fixed; all lights on the stretch working.",
  ],
  GARBAGE: [
    "Site cleared and swept; bin emptied.",
    "Debris lifted by tipper truck and the spot cleaned.",
    "Area cleared and added to the evening collection round.",
  ],
  WATER_LEAKAGE: [
    "Damaged pipe section replaced and pressure tested.",
    "Valve gland repacked; leak stopped.",
    "Leak repaired and the trench backfilled.",
  ],
  DRAINAGE: [
    "Drain desilted and the outlet cleared.",
    "New drain cover fitted.",
    "Sewer line jetted; flow restored.",
  ],
  OTHER: [
    "Obstruction removed and the area cleared.",
    "Repaired and handed back for public use.",
  ],
};

const PROGRESS_NOTES = [
  "Site inspected and measured. Material requisitioned from the depot.",
  "Crew on site. Work will continue tomorrow morning.",
  "Waiting on a traffic diversion permit before digging.",
  "First half done; finishing the remaining stretch next.",
];

const REOPEN_REASONS = [
  "the fix broke apart within two weeks",
  "the problem came back after the first rain",
  "only half the stretch was repaired",
  "it was not fixed at all",
];

const RATING_COMMENTS: Record<number, string[]> = {
  1: ["Took far too long and the fix is already failing.", "Nobody updated us for days."],
  2: ["Fixed eventually, but it took several follow-ups.", "Patchy work."],
  3: ["Okay job, slower than it should have been.", "It is fixed. Took a while."],
  4: ["Good work, thank you.", "Fixed properly, a bit slow to start."],
  5: ["Fixed the next morning. Excellent response.", "Very quick and clean work. Thank you!"],
};

// What fixes cost (whole rupees), by category: total range per
// case, and the ledger lines a crew would log.
const COST_RANGE: Record<IssueCategory, [number, number]> = {
  STREETLIGHT: [1_500, 8_000],
  ROAD_DAMAGE: [4_000, 60_000],
  DRAINAGE: [10_000, 120_000],
  WATER_LEAKAGE: [8_000, 90_000],
  GARBAGE: [500, 6_000],
  OTHER: [1_000, 15_000],
};

const COST_LINES: Record<IssueCategory, Array<[CostKind, string]>> = {
  STREETLIGHT: [
    ["MATERIAL", "LED luminaire and driver"],
    ["MATERIAL", "Cable, choke and junction box"],
    ["LABOUR", "Lineman crew (2 workers)"],
    ["EQUIPMENT", "Hydraulic ladder truck hire"],
  ],
  ROAD_DAMAGE: [
    ["MATERIAL", "Hot-mix asphalt"],
    ["MATERIAL", "Cold-mix bags and tack coat"],
    ["LABOUR", "Patching crew"],
    ["EQUIPMENT", "Road roller hire"],
    ["CONTRACTOR", "Contractor: base layer reconstruction"],
  ],
  DRAINAGE: [
    ["CONTRACTOR", "Desilting contractor"],
    ["EQUIPMENT", "Super-sucker machine hire"],
    ["MATERIAL", "RCC drain cover and frame"],
    ["LABOUR", "Sewer gang (4 workers)"],
  ],
  WATER_LEAKAGE: [
    ["MATERIAL", "DI pipe section and repair collar"],
    ["LABOUR", "Plumbing crew"],
    ["EQUIPMENT", "JCB excavator (4 hours)"],
    ["CONTRACTOR", "Contractor: main repair and road restoration"],
  ],
  GARBAGE: [
    ["LABOUR", "Extra sanitation shift"],
    ["EQUIPMENT", "Tipper truck trip"],
    ["MATERIAL", "Replacement community bin"],
  ],
  OTHER: [
    ["LABOUR", "Field crew"],
    ["MATERIAL", "Fixtures and fittings"],
    ["EQUIPMENT", "Tree cutter and pickup hire"],
  ],
};

// ─────────────────────────────────────────────
// PEOPLE
// ─────────────────────────────────────────────

interface OfficerSpec {
  name: string;
  email: string;
  dept: DeptKey;
  designation: string;
  employeeId: string;
  phone: string;
  joinedDaysAgo: number;
  weight: number;
}

// Joined the field team alongside the two curated officers.
const NEW_OFFICERS: OfficerSpec[] = [
  { name: "Ravi Shankar Yadav", email: "ravi.yadav@fixity.test", dept: "roads", designation: "Assistant Engineer", employeeId: "MCD-2021-0412", phone: "+91 98110 40412", joinedDaysAgo: 640, weight: 1 },
  { name: "Pooja Negi", email: "pooja.negi@fixity.test", dept: "roads", designation: "Junior Engineer", employeeId: "MCD-2022-0233", phone: "+91 98110 50233", joinedDaysAgo: 520, weight: 0.8 },
  { name: "Arjun Malhotra", email: "arjun.malhotra@fixity.test", dept: "water", designation: "Junior Engineer", employeeId: "DJB-2020-1187", phone: "+91 98110 61187", joinedDaysAgo: 700, weight: 1 },
  { name: "Farhan Qureshi", email: "farhan.qureshi@fixity.test", dept: "sanitation", designation: "Sanitary Inspector", employeeId: "MCD-2019-0921", phone: "+91 98110 70921", joinedDaysAgo: 760, weight: 1.1 },
  { name: "Kavita Rawat", email: "kavita.rawat@fixity.test", dept: "sanitation", designation: "Sanitation Supervisor", employeeId: "MCD-2022-0610", phone: "+91 98110 80610", joinedDaysAgo: 480, weight: 1 },
  { name: "Deepak Chauhan", email: "deepak.chauhan@fixity.test", dept: "electrical", designation: "Junior Engineer (Electrical)", employeeId: "BSES-2020-3341", phone: "+91 98110 93341", joinedDaysAgo: 690, weight: 1 },
  { name: "Neha Bhatia", email: "neha.bhatia@fixity.test", dept: "electrical", designation: "Assistant Engineer (Electrical)", employeeId: "BSES-2021-2207", phone: "+91 98110 92207", joinedDaysAgo: 600, weight: 1 },
];

// Promoted from a citizen account three weeks ago; no history.
const NEWEST_OFFICER: OfficerSpec = {
  name: "Imran Siddiqui",
  email: "imran.siddiqui@fixity.test",
  dept: "electrical",
  designation: "Lineman Supervisor",
  employeeId: "BSES-2026-0091",
  phone: "+91 98110 90091",
  joinedDaysAgo: 21,
  weight: 0,
};

const FIRST_NAMES = [
  "Aarav", "Aditya", "Rohan", "Nikhil", "Manish", "Vikram", "Sanjay",
  "Harish", "Gaurav", "Tarun", "Yash", "Mohit", "Ankit", "Rajesh",
  "Ananya", "Diya", "Isha", "Kavya", "Nandini", "Pallavi", "Ritika",
  "Sakshi", "Shreya", "Tanvi", "Bhavna", "Jyoti", "Neelam", "Rekha",
  "Sunita", "Vandana",
];

const LAST_NAMES = [
  "Sharma", "Gupta", "Agarwal", "Bansal", "Chopra", "Kapoor", "Mehra",
  "Arora", "Sethi", "Khanna", "Saxena", "Tiwari", "Pandey", "Mishra",
  "Dubey", "Bisht", "Jain", "Chauhan", "Goel", "Bhardwaj",
];

const FIXED_NAMES = [
  "Sameer Khan", "Ayesha Rizvi", "Naved Ansari", "Zoya Siddiqui",
  "Faisal Ahmed", "Farah Qureshi", "Gurpreet Singh", "Simran Kaur",
  "Harpreet Gill", "Jaspreet Kaur", "Manjeet Sandhu", "Lakshmi Nair",
  "Meenakshi Iyer", "Arun Pillai", "Deepa Menon", "Sourav Das",
  "Ritwik Bose", "Anirban Chatterjee", "Priyanka Reddy", "Tenzin Dorjee",
];

const GENERATED_CITIZENS = 70;

// ─────────────────────────────────────────────
// WIPE — children before parents, so it is re-runnable
// ─────────────────────────────────────────────

async function wipe() {
  console.log("Clearing existing data...");

  await prisma.auditEvent.deleteMany();
  await prisma.driveRsvp.deleteMany();
  await prisma.drive.deleteMany();
  await prisma.pollVote.deleteMany();
  await prisma.pollOption.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.watchZone.deleteMany();
  await prisma.bulletin.deleteMany();
  await prisma.workCost.deleteMany();
  await prisma.departmentBudget.deleteMany();
  await prisma.message.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.resolutionVerification.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.sLA.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.upvote.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.ward.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
}

// Insert in slices so no statement exceeds Postgres's
// parameter limit.
async function insertMany<T>(
  rows: T[],
  insert: (data: T[]) => Promise<unknown>
) {
  for (let i = 0; i < rows.length; i += 1000) {
    await insert(rows.slice(i, i + 1000));
  }
}

// Civic points earned by generated activity, settled at the end
// on top of each account's starting balance.
const earnedPoints = new Map<string, number>();

const award = (userId: string | null | undefined, points: number) => {
  if (!userId) return;
  earnedPoints.set(userId, (earnedPoints.get(userId) ?? 0) + points);
};

// ─────────────────────────────────────────────
// ORGANISATION
// ─────────────────────────────────────────────

async function seedOrganisation() {
  console.log("Seeding departments and wards...");

  const departments = {} as Record<DeptKey, { id: string; name: string }>;

  for (const key of DEPT_KEYS) {
    departments[key] = await prisma.department.create({
      data: { name: DEPARTMENTS[key].name, createdAt: daysAgo(800) },
      select: { id: true, name: true },
    });
  }

  const wardIds: Record<string, string> = {};

  for (const spec of WARDS) {
    const ward = await prisma.ward.create({
      data: { name: spec.name, code: spec.code, createdAt: daysAgo(800) },
      select: { id: true },
    });

    wardIds[spec.key] = ward.id;
  }

  // Auto-assignment rules: category -> department
  await prisma.categoryRule.createMany({
    data: [
      { category: "ROAD_DAMAGE", departmentId: departments.roads.id },
      { category: "GARBAGE", departmentId: departments.sanitation.id },
      { category: "WATER_LEAKAGE", departmentId: departments.water.id },
      { category: "DRAINAGE", departmentId: departments.water.id },
      { category: "STREETLIGHT", departmentId: departments.electrical.id },
    ],
  });

  return { departments, wardIds };
}

type Org = Awaited<ReturnType<typeof seedOrganisation>>;

// ─────────────────────────────────────────────
// PEOPLE
// ─────────────────────────────────────────────

interface Officer {
  id: string;
  name: string;
  dept: DeptKey;
  joinedAt: number;
  weight: number;
}

interface Citizen {
  id: string;
  name: string;
  joinedAt: number;
  homeWard: string;
  weight: number;
}

async function seedPeople(org: Org) {
  console.log("Seeding users...");

  const citizenHash = await bcrypt.hash(
    PASSWORDS.citizen,
    12
  );
  const authorityHash = await bcrypt.hash(
    PASSWORDS.authority,
    12
  );
  const adminHash = await bcrypt.hash(
    PASSWORDS.admin,
    12
  );

  const { roads, water } = org.departments;

  const citizen = await prisma.user.create({
    data: {
      name: "Kushagra Srivastava",
      email: "citizen@fixity.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 65,
      avatarUrl: avatar("Kushagra Srivastava"),
      bio: "Resident of Gandhi Nagar. Reporting what I walk past every day.",
      ward: "Gandhi Nagar (W-12)",
      createdAt: hoursAgo(24 * 60),
    },
  });

  const priya = await prisma.user.create({
    data: {
      name: "Priya Menon",
      email: "priya@fixity.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 120,
      avatarUrl: avatar("Priya Menon"),
      bio: "RWA secretary. Chasing civic fixes since 2019.",
      ward: "Nehru Colony (W-07)",
      createdAt: hoursAgo(24 * 90),
    },
  });

  const rahul = await prisma.user.create({
    data: {
      name: "Rahul Verma",
      email: "rahul@fixity.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 45,
      avatarUrl: avatar("Rahul Verma"),
      ward: "Model Town (W-21)",
      createdAt: hoursAgo(24 * 40),
    },
  });

  const aisha = await prisma.user.create({
    data: {
      name: "Aisha Khan",
      email: "aisha@fixity.test",
      passwordHash: citizenHash,
      role: "CITIZEN",
      points: 25,
      avatarUrl: avatar("Aisha Khan"),
      ward: "Rajendra Park (W-03)",
      createdAt: hoursAgo(24 * 20),
    },
  });

  const officer = await prisma.user.create({
    data: {
      name: "Sunil Kumar",
      email: "authority@fixity.test",
      passwordHash: authorityHash,
      role: "AUTHORITY",
      employeeId: "MCD-2024-0147",
      designation: "Junior Engineer",
      phone: "+91 98100 22147",
      departmentId: roads.id,
      avatarUrl: avatar("Sunil Kumar"),
      createdAt: hoursAgo(24 * 200),
    },
  });

  const officer2 = await prisma.user.create({
    data: {
      name: "Meera Joshi",
      email: "engineer@fixity.test",
      passwordHash: authorityHash,
      role: "AUTHORITY",
      employeeId: "MCD-2023-0088",
      designation: "Assistant Engineer",
      phone: "+91 98100 33088",
      departmentId: water.id,
      avatarUrl: avatar("Meera Joshi"),
      createdAt: hoursAgo(24 * 300),
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Fixity Admin",
      email: "admin@fixity.test",
      passwordHash: adminHash,
      role: "ADMIN",
      avatarUrl: avatar("Fixity Admin"),
      createdAt: hoursAgo(24 * 400),
    },
  });

  // ── The rest of the field team ──────────────────
  const officers: Officer[] = [
    { id: officer.id, name: officer.name, dept: "roads", joinedAt: officer.createdAt.getTime(), weight: 1.3 },
    { id: officer2.id, name: officer2.name, dept: "water", joinedAt: officer2.createdAt.getTime(), weight: 1.2 },
  ];

  const officerRow = (spec: OfficerSpec) => ({
    id: makeId(),
    name: spec.name,
    email: spec.email,
    passwordHash: authorityHash,
    role: "AUTHORITY" as const,
    employeeId: spec.employeeId,
    designation: spec.designation,
    phone: spec.phone,
    departmentId: org.departments[spec.dept].id,
    avatarUrl: avatar(spec.name),
    createdAt: daysAgo(spec.joinedDaysAgo),
  });

  const newOfficerRows = NEW_OFFICERS.map(officerRow);
  const imranRow = officerRow(NEWEST_OFFICER);

  await prisma.user.createMany({ data: [...newOfficerRows, imranRow] });

  NEW_OFFICERS.forEach((spec, i) =>
    officers.push({
      id: newOfficerRows[i].id,
      name: spec.name,
      dept: spec.dept,
      joinedAt: newOfficerRows[i].createdAt.getTime(),
      weight: spec.weight,
    })
  );

  // ── Neighbours: the wider citizen base ──────────
  const taken = new Set([
    "Kushagra Srivastava",
    "Priya Menon",
    "Rahul Verma",
    "Aisha Khan",
    ...FIXED_NAMES,
  ]);
  const names = [...FIXED_NAMES];

  while (names.length < GENERATED_CITIZENS) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

    if (!taken.has(name)) {
      taken.add(name);
      names.push(name);
    }
  }

  const neighbourRows = names.map((name) => {
    const home = pickWeighted(WARDS, (ward) => ward.volume);

    return {
      id: makeId(),
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@fixity.test`,
      passwordHash: citizenHash,
      role: "CITIZEN" as const,
      avatarUrl: avatar(name),
      ward: `${home.name} (${home.code})`,
      createdAt: daysAgo(between(375, 430)),
      homeWard: home.key,
    };
  });

  await prisma.user.createMany({
    data: neighbourRows.map(({ homeWard: _home, ...row }) => row),
  });

  const neighbours: Citizen[] = neighbourRows.map((row) => ({
    id: row.id,
    name: row.name,
    joinedAt: row.createdAt.getTime(),
    homeWard: row.homeWard,
    weight: 1,
  }));

  // The curated four report more in their own wards.
  const citizens: Citizen[] = [
    { id: citizen.id, name: citizen.name, joinedAt: citizen.createdAt.getTime(), homeWard: "W12", weight: 4 },
    { id: priya.id, name: priya.name, joinedAt: priya.createdAt.getTime(), homeWard: "W7", weight: 3 },
    { id: rahul.id, name: rahul.name, joinedAt: rahul.createdAt.getTime(), homeWard: "W21", weight: 1.5 },
    { id: aisha.id, name: aisha.name, joinedAt: aisha.createdAt.getTime(), homeWard: "W3", weight: 1 },
    ...neighbours,
  ];

  return {
    citizen,
    priya,
    rahul,
    aisha,
    officer,
    officer2,
    admin,
    imran: { id: imranRow.id, name: imranRow.name },
    officers,
    citizens,
    neighbours,
  };
}

type People = Awaited<ReturnType<typeof seedPeople>>;

// ─────────────────────────────────────────────
// CURATED STORIES — the hand-written recent cases the demo
// walks through (one per status, plus emergencies, chronic
// and duplicate cases).
// ─────────────────────────────────────────────

async function seedCuratedStories(org: Org, people: People) {
  const { roads, sanitation, water, electrical } = org.departments;
  const ward12 = { id: org.wardIds.W12 };
  const ward7 = { id: org.wardIds.W7 };
  const ward3 = { id: org.wardIds.W3 };
  const ward21 = { id: org.wardIds.W21 };
  const { citizen, priya, rahul, aisha, officer, officer2, admin } =
    people;

  console.log("Seeding issues...");

  interface SeedIssue {
    key: string;
    title: string;
    description: string;
    category: any;
    severity: any;
    status: any;
    lat: number;
    lng: number;
    address: string;
    ward: string;
    dept: string;
    createdHoursAgo: number;
    isEmergency?: boolean;
    reopenCount?: number;
    reporter: string;
    extraReporters?: string[];
    upvoters?: string[];
    photos: string[];
    audio?: boolean;
  }

  const wardMap: Record<string, string> = {
    W12: ward12.id,
    W7: ward7.id,
    W3: ward3.id,
    W21: ward21.id,
  };

  const deptMap: Record<string, string> = {
    roads: roads.id,
    sanitation: sanitation.id,
    water: water.id,
    electrical: electrical.id,
  };

  const userMap: Record<string, string> = {
    citizen: citizen.id,
    priya: priya.id,
    rahul: rahul.id,
    aisha: aisha.id,
  };

  const seedIssues: SeedIssue[] = [
    {
      key: "reported-pothole",
      title: "Deep pothole cluster near Gandhi Market crossing",
      description:
        "Three large potholes fill with water after every rain. Two-wheelers swerve into oncoming traffic to avoid them.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "REPORTED",
      lat: 28.6139,
      lng: 77.209,
      address: "Gandhi Market Road, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "roads",
      createdHoursAgo: 6,
      reporter: "citizen",
      extraReporters: ["rahul"],
      upvoters: ["priya", "rahul", "aisha"],
      photos: [
        photo("story-pothole-a"),
        photo("story-pothole-b"),
      ],
      audio: true,
    },
    {
      key: "reported-garbage",
      title: "Garbage bin overflowing outside school gate",
      description:
        "The bin has not been cleared for four days. Stray dogs are scattering waste across the footpath where children walk.",
      category: "GARBAGE",
      severity: "MEDIUM",
      status: "REPORTED",
      lat: 28.6165,
      lng: 77.2115,
      address: "Near DAV School, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "sanitation",
      createdHoursAgo: 20,
      reporter: "priya",
      upvoters: ["citizen", "aisha"],
      photos: [photo("story-garbage-a")],
    },
    {
      key: "ai-verified",
      title: "Streetlight out on the entire 4th Cross stretch",
      description:
        "Six consecutive streetlights are dead. The lane is pitch dark after 7pm and feels unsafe.",
      category: "STREETLIGHT",
      severity: "HIGH",
      status: "AI_VERIFIED",
      lat: 28.6202,
      lng: 77.2043,
      address: "4th Cross, Nehru Colony, New Delhi",
      ward: "W7",
      dept: "electrical",
      createdHoursAgo: 30,
      reporter: "rahul",
      upvoters: ["citizen", "priya"],
      photos: [photo("story-streetlight-a")],
    },
    {
      key: "assigned",
      title: "Water pipeline leaking at Nehru Colony junction",
      description:
        "Clean water has been running down the road for two days. The road surface is starting to sink near the leak.",
      category: "WATER_LEAKAGE",
      severity: "HIGH",
      status: "ASSIGNED",
      lat: 28.6188,
      lng: 77.2071,
      address: "Nehru Colony Junction, New Delhi",
      ward: "W7",
      dept: "water",
      createdHoursAgo: 48,
      reporter: "citizen",
      upvoters: ["priya"],
      photos: [photo("story-water-a")],
    },
    {
      key: "acknowledged",
      title: "Blocked storm drain floods the lane after rain",
      description:
        "The drain cover is choked with silt and plastic. Even ten minutes of rain leaves knee-deep water for hours.",
      category: "DRAINAGE",
      severity: "MEDIUM",
      status: "ACKNOWLEDGED",
      lat: 28.6094,
      lng: 77.2158,
      address: "Rajendra Park Lane 3, New Delhi",
      ward: "W3",
      dept: "water",
      createdHoursAgo: 72,
      reporter: "aisha",
      upvoters: ["citizen", "rahul"],
      photos: [photo("story-drain-a")],
    },
    {
      key: "in-progress",
      title: "Road surface broken outside the community hall",
      description:
        "Tar has peeled away over a ten metre stretch, exposing loose gravel that keeps causing skids.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "IN_PROGRESS",
      lat: 28.6121,
      lng: 77.2201,
      address: "Community Hall Road, Model Town, New Delhi",
      ward: "W21",
      dept: "roads",
      createdHoursAgo: 96,
      reporter: "citizen",
      upvoters: ["priya", "rahul", "aisha"],
      photos: [
        photo("story-road-a"),
        photo("story-road-b"),
        photo("story-road-c"),
      ],
    },
    {
      key: "emergency",
      title: "EMERGENCY: Open manhole with no cover near bus stop",
      description:
        "The manhole cover is completely missing right where people queue for the bus. Someone will fall in after dark.",
      category: "DRAINAGE",
      severity: "CRITICAL",
      status: "IN_PROGRESS",
      lat: 28.6255,
      lng: 77.2189,
      address: "Model Town Bus Stop, New Delhi",
      ward: "W21",
      dept: "water",
      createdHoursAgo: 5,
      isEmergency: true,
      reporter: "priya",
      upvoters: ["citizen", "rahul", "aisha"],
      photos: [photo("story-manhole-a")],
    },
    {
      key: "resolved-awaiting",
      title: "Cracked footpath slabs near the vegetable market",
      description:
        "Loose slabs tilt when stepped on. An elderly neighbour tripped there last week.",
      category: "ROAD_DAMAGE",
      severity: "MEDIUM",
      status: "RESOLVED",
      lat: 28.6148,
      lng: 77.2098,
      address: "Vegetable Market Lane, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "roads",
      createdHoursAgo: 120,
      reporter: "citizen",
      upvoters: ["priya"],
      photos: [photo("story-footpath-a")],
    },
    {
      key: "resolved-awaiting-2",
      title: "Streetlight flickering all night on Park Road",
      description:
        "The lamp switches on and off every few seconds. It is more disorienting than having no light at all.",
      category: "STREETLIGHT",
      severity: "LOW",
      status: "RESOLVED",
      lat: 28.6081,
      lng: 77.2132,
      address: "Park Road, Rajendra Park, New Delhi",
      ward: "W3",
      dept: "electrical",
      createdHoursAgo: 140,
      reporter: "rahul",
      photos: [photo("story-lamp-a")],
    },
    {
      key: "closed-1",
      title: "Uncollected construction debris blocking half the road",
      description:
        "A pile of rubble from a private build has been sitting on the public road for two weeks.",
      category: "GARBAGE",
      severity: "MEDIUM",
      status: "CLOSED",
      lat: 28.6175,
      lng: 77.2035,
      address: "Nehru Colony Main Road, New Delhi",
      ward: "W7",
      dept: "sanitation",
      createdHoursAgo: 300,
      reporter: "priya",
      upvoters: ["citizen", "rahul"],
      photos: [photo("story-debris-a")],
    },
    {
      key: "closed-2",
      title: "Broken drain cover outside the clinic",
      description:
        "The concrete cover had cracked through and shifted whenever a vehicle passed over it.",
      category: "DRAINAGE",
      severity: "HIGH",
      status: "CLOSED",
      lat: 28.6112,
      lng: 77.2167,
      address: "Clinic Road, Rajendra Park, New Delhi",
      ward: "W3",
      dept: "water",
      createdHoursAgo: 420,
      reporter: "citizen",
      upvoters: ["aisha"],
      photos: [photo("story-cover-a")],
    },
    {
      key: "sla-breached",
      title: "Sewage backing up into the street near Block C",
      description:
        "Raw sewage has been surfacing for over a week. The smell reaches the houses on both sides.",
      category: "DRAINAGE",
      severity: "CRITICAL",
      status: "SLA_BREACHED",
      lat: 28.6221,
      lng: 77.2112,
      address: "Block C, Nehru Colony, New Delhi",
      ward: "W7",
      dept: "water",
      createdHoursAgo: 200,
      reporter: "aisha",
      upvoters: ["citizen", "priya", "rahul"],
      photos: [photo("story-sewage-a")],
    },
    {
      key: "escalated",
      title: "Major road cave-in near the flyover ramp",
      description:
        "A section of the carriageway has sunk by nearly a foot. Heavy vehicles are being diverted informally.",
      category: "ROAD_DAMAGE",
      severity: "CRITICAL",
      status: "ESCALATED",
      lat: 28.6268,
      lng: 77.2064,
      address: "Flyover Ramp, Model Town, New Delhi",
      ward: "W21",
      dept: "roads",
      createdHoursAgo: 260,
      reporter: "rahul",
      upvoters: ["citizen", "priya", "aisha"],
      photos: [photo("story-cavein-a")],
    },
    {
      key: "chronic",
      title: "Same pothole keeps reopening on Station Road",
      description:
        "Patched twice in three months and it breaks apart again within weeks. The base needs proper work, not more tar.",
      category: "ROAD_DAMAGE",
      severity: "HIGH",
      status: "REOPENED",
      lat: 28.6198,
      lng: 77.2229,
      address: "Station Road, Model Town, New Delhi",
      ward: "W21",
      dept: "roads",
      createdHoursAgo: 500,
      reopenCount: 3,
      reporter: "citizen",
      extraReporters: ["priya"],
      upvoters: ["rahul", "aisha"],
      photos: [photo("story-chronic-a")],
    },
    {
      key: "duplicate",
      title: "Potholes at Gandhi Market (duplicate report)",
      description:
        "Reported separately before I saw the existing report for the same stretch of road.",
      category: "ROAD_DAMAGE",
      severity: "MEDIUM",
      status: "DUPLICATE",
      lat: 28.6141,
      lng: 77.2092,
      address: "Gandhi Market Road, Gandhi Nagar, New Delhi",
      ward: "W12",
      dept: "roads",
      createdHoursAgo: 10,
      reporter: "aisha",
      photos: [photo("story-dup-a")],
    },
    {
      key: "anon",
      title: "Overflowing bin at the park entrance",
      description:
        "Reported anonymously while walking past. Bin has clearly not been emptied in days.",
      category: "GARBAGE",
      severity: "LOW",
      status: "REPORTED",
      lat: 28.6103,
      lng: 77.2211,
      address: "Central Park Gate, Model Town, New Delhi",
      ward: "W21",
      dept: "sanitation",
      createdHoursAgo: 14,
      reporter: "anonymous",
      upvoters: ["citizen"],
      photos: [photo("story-park-bin")],
    },
  ];

  const created: Record<string, any> = {};

  for (const s of seedIssues) {
    const issue = await prisma.issue.create({
      data: {
        title: s.title,
        description: s.description,
        category: s.category,
        severity: s.severity,
        status: s.status,
        isEmergency: s.isEmergency ?? false,
        reopenCount: s.reopenCount ?? 0,
        latitude: s.lat,
        longitude: s.lng,
        address: s.address,
        aiConfidence: 0.72 + rand() * 0.26,
        wardId: wardMap[s.ward],
        departmentId: deptMap[s.dept],
        createdAt: hoursAgo(s.createdHoursAgo),
      },
    });

    created[s.key] = issue;

    // Primary complaint
    await prisma.complaint.create({
      data: {
        citizenId:
          s.reporter === "anonymous"
            ? null
            : userMap[s.reporter],
        issueId: issue.id,
        imageUrl: s.photos[0],
        photos: s.photos,
        audioUrl: s.audio
          ? "https://cdn.jsdelivr.net/gh/anars/blank-audio/2-seconds-of-silence.mp3"
          : null,
        description: s.description,
        latitude: s.lat,
        longitude: s.lng,
        createdAt: hoursAgo(s.createdHoursAgo),
      },
    });

    // Additional reports of the same issue
    for (const extra of s.extraReporters ?? []) {
      await prisma.complaint.create({
        data: {
          citizenId: userMap[extra],
          issueId: issue.id,
          imageUrl: photo(`${s.key}-extra-${extra}`),
          photos: [photo(`${s.key}-extra-${extra}`)],
          description:
            "Reporting the same problem from the other side of the road.",
          latitude: s.lat + 0.0004,
          longitude: s.lng + 0.0004,
          createdAt: hoursAgo(
            Math.max(1, s.createdHoursAgo - 2)
          ),
        },
      });
    }

    // Upvotes
    for (const up of s.upvoters ?? []) {
      await prisma.upvote.create({
        data: {
          userId: userMap[up],
          issueId: issue.id,
          createdAt: hoursAgo(
            Math.max(1, s.createdHoursAgo - 1)
          ),
        },
      });
    }

    // Opening history entry
    await prisma.statusHistory.create({
      data: {
        issueId: issue.id,
        changedBy:
          s.reporter === "anonymous"
            ? null
            : userMap[s.reporter],
        status: "REPORTED",
        note: "Issue reported by a citizen",
        createdAt: hoursAgo(s.createdHoursAgo),
      },
    });
  }

  console.log("Seeding assignments and workflow history...");

  async function assign(
    issue: any,
    officerUser: any,
    deptId: string,
    wardId: string,
    opts: {
      assignedHoursAgo: number;
      acceptedHoursAgo?: number;
      completedHoursAgo?: number;
    }
  ) {
    return prisma.assignment.create({
      data: {
        issueId: issue.id,
        authorityId: officerUser.id,
        departmentId: deptId,
        wardId,
        assignedAt: hoursAgo(opts.assignedHoursAgo),
        acceptedAt: opts.acceptedHoursAgo
          ? hoursAgo(opts.acceptedHoursAgo)
          : null,
        completedAt: opts.completedHoursAgo
          ? hoursAgo(opts.completedHoursAgo)
          : null,
      },
    });
  }

  async function history(
    issue: any,
    status: any,
    note: string,
    hrs: number,
    by?: string,
    imageUrl?: string
  ) {
    return prisma.statusHistory.create({
      data: {
        issueId: issue.id,
        changedBy: by ?? null,
        status,
        note,
        imageUrl,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  // ASSIGNED (waiting for the officer to accept)
  await assign(
    created["assigned"],
    officer2,
    water.id,
    ward7.id,
    { assignedHoursAgo: 20 }
  );
  await history(
    created["assigned"],
    "ASSIGNED",
    "Assigned to Meera Joshi (Water & Drainage)",
    20,
    admin.id
  );

  // ACKNOWLEDGED
  await assign(
    created["acknowledged"],
    officer,
    water.id,
    ward3.id,
    { assignedHoursAgo: 50, acceptedHoursAgo: 44 }
  );
  await history(
    created["acknowledged"],
    "ASSIGNED",
    "Assigned to Sunil Kumar",
    50,
    admin.id
  );
  await history(
    created["acknowledged"],
    "ACKNOWLEDGED",
    "Authority accepted the assignment",
    44,
    officer.id
  );

  // IN_PROGRESS with progress updates
  const inProg = await assign(
    created["in-progress"],
    officer,
    roads.id,
    ward21.id,
    { assignedHoursAgo: 80, acceptedHoursAgo: 74 }
  );
  await history(
    created["in-progress"],
    "ASSIGNED",
    "Assigned to Sunil Kumar",
    80,
    admin.id
  );
  await history(
    created["in-progress"],
    "ACKNOWLEDGED",
    "Authority accepted the assignment",
    74,
    officer.id
  );
  await history(
    created["in-progress"],
    "IN_PROGRESS",
    "Authority started working on the issue",
    50,
    officer.id
  );
  await history(
    created["in-progress"],
    "IN_PROGRESS",
    "Site inspected and measured. Material ordered, patching begins tomorrow morning.",
    26,
    officer.id,
    photo("story-progress-1")
  );
  await history(
    created["in-progress"],
    "IN_PROGRESS",
    "Base layer laid. Final surfacing scheduled for this evening.",
    4,
    officer.id,
    photo("story-progress-2")
  );

  // EMERGENCY in progress, SLA about to breach (tests the urgent countdown chip)
  await assign(
    created["emergency"],
    officer2,
    water.id,
    ward21.id,
    { assignedHoursAgo: 4, acceptedHoursAgo: 3 }
  );
  await history(
    created["emergency"],
    "ASSIGNED",
    "Emergency assigned to Meera Joshi",
    4,
    admin.id
  );
  await history(
    created["emergency"],
    "ACKNOWLEDGED",
    "Authority accepted the emergency assignment",
    3,
    officer2.id
  );
  await history(
    created["emergency"],
    "IN_PROGRESS",
    "Barricades placed around the open manhole. Replacement cover being sourced.",
    2,
    officer2.id,
    photo("story-progress-3")
  );

  // RESOLVED awaiting citizen verification (with proof photos)
  for (const [key, off, deptId, wardId, hrs] of [
    ["resolved-awaiting", officer, roads.id, ward12.id, 110],
    ["resolved-awaiting-2", officer, electrical.id, ward3.id, 130],
  ] as const) {
    await assign(created[key], off, deptId, wardId, {
      assignedHoursAgo: hrs,
      acceptedHoursAgo: hrs - 6,
      completedHoursAgo: 8,
    });
    await history(
      created[key],
      "ASSIGNED",
      "Assigned to Sunil Kumar",
      hrs,
      admin.id
    );
    await history(
      created[key],
      "ACKNOWLEDGED",
      "Authority accepted the assignment",
      hrs - 6,
      off.id
    );
    await history(
      created[key],
      "IN_PROGRESS",
      "Authority started working on the issue",
      hrs - 20,
      off.id
    );
    await history(
      created[key],
      "RESOLVED",
      "Work completed. Please verify the fix.",
      8,
      off.id
    );

    await prisma.issue.update({
      where: { id: created[key].id },
      data: {
        resolutionImageUrl: photo(`${key}-proof`),
      },
    });
  }

  // CLOSED (verified by citizens with star ratings)
  const closedSpecs = [
    {
      key: "closed-1",
      off: officer,
      dept: sanitation.id,
      ward: ward7.id,
      hrs: 280,
      verifier: priya,
      stars: 5,
      comment: "Cleared the very next morning. Excellent response.",
    },
    {
      key: "closed-2",
      off: officer2,
      dept: water.id,
      ward: ward3.id,
      hrs: 400,
      verifier: citizen,
      stars: 4,
      comment: "New cover fitted properly. Took a few days but solid work.",
    },
  ];

  for (const c of closedSpecs) {
    await assign(
      created[c.key],
      c.off,
      c.dept,
      c.ward,
      {
        assignedHoursAgo: c.hrs,
        acceptedHoursAgo: c.hrs - 5,
        completedHoursAgo: c.hrs - 60,
      }
    );
    await history(
      created[c.key],
      "ASSIGNED",
      "Assigned by admin",
      c.hrs,
      admin.id
    );
    await history(
      created[c.key],
      "ACKNOWLEDGED",
      "Authority accepted the assignment",
      c.hrs - 5,
      c.off.id
    );
    await history(
      created[c.key],
      "IN_PROGRESS",
      "Work started on site",
      c.hrs - 30,
      c.off.id
    );
    await history(
      created[c.key],
      "RESOLVED",
      "Work completed with photo proof",
      c.hrs - 60,
      c.off.id
    );
    await history(
      created[c.key],
      "CLOSED",
      "Citizen verified the resolution",
      c.hrs - 55,
      c.verifier.id
    );

    await prisma.issue.update({
      where: { id: created[c.key].id },
      data: {
        resolutionImageUrl: photo(`${c.key}-proof`),
      },
    });

    await prisma.resolutionVerification.create({
      data: {
        issueId: created[c.key].id,
        citizenId: c.verifier.id,
        verified: true,
        stars: c.stars,
        comment: c.comment,
        createdAt: hoursAgo(c.hrs - 55),
      },
    });
  }

  // SLA_BREACHED
  await assign(
    created["sla-breached"],
    officer2,
    water.id,
    ward7.id,
    { assignedHoursAgo: 180, acceptedHoursAgo: 170 }
  );
  await history(
    created["sla-breached"],
    "ASSIGNED",
    "Assigned to Meera Joshi",
    180,
    admin.id
  );
  await history(
    created["sla-breached"],
    "ACKNOWLEDGED",
    "Authority accepted the assignment",
    170,
    officer2.id
  );
  await history(
    created["sla-breached"],
    "SLA_BREACHED",
    "Issue exceeded its SLA deadline",
    24,
    undefined
  );

  // ESCALATED with escalation records
  await assign(
    created["escalated"],
    officer,
    roads.id,
    ward21.id,
    { assignedHoursAgo: 240, acceptedHoursAgo: 230 }
  );
  await history(
    created["escalated"],
    "ASSIGNED",
    "Assigned to Sunil Kumar",
    240,
    admin.id
  );
  await history(
    created["escalated"],
    "SLA_BREACHED",
    "Issue exceeded its SLA deadline",
    60,
    undefined
  );
  await history(
    created["escalated"],
    "ESCALATED",
    "Issue escalated to level 2 after SLA breach",
    48,
    undefined
  );
  await prisma.escalation.createMany({
    data: [
      {
        issueId: created["escalated"].id,
        level: 1,
        reason:
          "SLA deadline exceeded - automatically escalated to level 1",
        escalatedAt: hoursAgo(58),
      },
      {
        issueId: created["escalated"].id,
        level: 2,
        reason:
          "Still unresolved after level 1 escalation",
        escalatedAt: hoursAgo(48),
      },
    ],
  });

  // CHRONIC (reopened repeatedly)
  await assign(
    created["chronic"],
    officer,
    roads.id,
    ward21.id,
    { assignedHoursAgo: 460, acceptedHoursAgo: 450 }
  );
  await history(
    created["chronic"],
    "RESOLVED",
    "Pothole patched with cold mix",
    380,
    officer.id
  );
  await history(
    created["chronic"],
    "REOPENED",
    "Citizen rejected the resolution: patch broke apart within two weeks",
    300,
    citizen.id
  );
  await history(
    created["chronic"],
    "RESOLVED",
    "Repatched with hot mix",
    200,
    officer.id
  );
  await history(
    created["chronic"],
    "REOPENED",
    "Citizen rejected the resolution: cracked again after the rain",
    120,
    citizen.id
  );
  await history(
    created["chronic"],
    "REOPENED",
    "Third failure - the road base itself needs rebuilding",
    40,
    priya.id
  );
  await prisma.escalation.create({
    data: {
      issueId: created["chronic"].id,
      level: 2,
      reason:
        "Repeated failures - requires base reconstruction, not surface patching",
      escalatedAt: hoursAgo(38),
    },
  });

  // DUPLICATE pointing at the original pothole report
  await history(
    created["duplicate"],
    "DUPLICATE",
    `Marked as duplicate of "${created["reported-pothole"].title}"`,
    4,
    admin.id
  );

  console.log("Seeding SLAs...");

  const slaSpecs: Array<[string, number, number, boolean]> =
    [
      // key, durationMin, deadlineHoursFromNow (negative = past), breached
      ["reported-pothole", 2880, 42, false],
      ["assigned", 1440, 12, false],
      ["acknowledged", 2880, 20, false],
      ["in-progress", 4320, 6, false],
      ["emergency", 240, 2, false],
      ["resolved-awaiting", 4320, 30, false],
      ["sla-breached", 2880, -24, true],
      ["escalated", 2880, -60, true],
      ["chronic", 4320, -30, true],
    ];

  for (const [key, duration, deadlineHrs, breached] of slaSpecs) {
    await prisma.sLA.create({
      data: {
        issueId: created[key].id,
        durationMin: duration,
        deadline:
          deadlineHrs >= 0
            ? hoursAhead(deadlineHrs)
            : hoursAgo(-deadlineHrs),
        breached,
        breachedAt: breached
          ? hoursAgo(-deadlineHrs)
          : null,
      },
    });
  }

  console.log("Seeding comments, messages and notifications...");

  const commentSpecs: Array<[string, string, string, number]> =
    [
      [
        "reported-pothole",
        priya.id,
        "This is exactly where my scooter skidded last Tuesday. Adding my upvote.",
        5,
      ],
      [
        "reported-pothole",
        rahul.id,
        "It gets much worse after rain because the whole stretch holds water.",
        4,
      ],
      [
        "reported-pothole",
        officer.id,
        "Noted. The road team will inspect this stretch within 48 hours.",
        2,
      ],
      [
        "in-progress",
        citizen.id,
        "Thanks for the update. Any idea if the lane will be closed during work?",
        20,
      ],
      [
        "in-progress",
        officer.id,
        "Only half the carriageway will be closed. Access to the hall stays open.",
        18,
      ],
      [
        "emergency",
        aisha.id,
        "Barricades are up as of this evening. Thank you for the fast response.",
        1,
      ],
      [
        "sla-breached",
        priya.id,
        "It has been over a week now. Can someone from the department respond here?",
        30,
      ],
      [
        "chronic",
        rahul.id,
        "Third time this year. Patching clearly is not working on this stretch.",
        35,
      ],
    ];

  for (const [key, userId, text, hrs] of commentSpecs) {
    await prisma.comment.create({
      data: {
        issueId: created[key].id,
        userId,
        text,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  const messageSpecs: Array<[string, string, string, number]> =
    [
      [
        "in-progress",
        officer.id,
        "Hello, I am the engineer assigned to your report. Could you confirm whether the damage extends past the hall gate?",
        30,
      ],
      [
        "in-progress",
        citizen.id,
        "Yes, it continues about five metres past the gate towards the water tank.",
        28,
      ],
      [
        "in-progress",
        officer.id,
        "Understood, I have extended the work order to cover that stretch. Thank you.",
        27,
      ],
      [
        "resolved-awaiting",
        officer.id,
        "The slabs have been relaid. Please have a look and verify when you can.",
        7,
      ],
    ];

  for (const [key, senderId, text, hrs] of messageSpecs) {
    await prisma.message.create({
      data: {
        issueId: created[key].id,
        senderId,
        text,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  const notificationSpecs: Array<
    [string, string, string, boolean, number]
  > = [
    [
      citizen.id,
      "Issue Resolved",
      'Your civic issue "Cracked footpath slabs near the vegetable market" has been marked as resolved. Please verify whether the issue has actually been fixed.',
      false,
      8,
    ],
    [
      citizen.id,
      "New Message",
      'Sunil Kumar sent a message on "Road surface broken outside the community hall".',
      false,
      27,
    ],
    [
      citizen.id,
      "Progress Update",
      'Update on "Road surface broken outside the community hall": Base layer laid. Final surfacing scheduled for this evening.',
      false,
      4,
    ],
    [
      citizen.id,
      "Work Started",
      'Work has started on your civic issue "Road surface broken outside the community hall".',
      true,
      50,
    ],
    [
      officer.id,
      "New Issue Assigned",
      'A new civic issue "Deep pothole cluster near Gandhi Market crossing" needs your attention.',
      false,
      6,
    ],
    [
      officer.id,
      "Assigned Issue Escalated",
      'Your assigned issue "Major road cave-in near the flyover ramp" breached its SLA and has been escalated to level 2.',
      false,
      48,
    ],
    [
      officer2.id,
      "New Issue Assigned",
      'A new civic issue "Water pipeline leaking at Nehru Colony junction" has been assigned to you.',
      false,
      20,
    ],
    [
      admin.id,
      "EMERGENCY REPORT",
      'An emergency civic issue was just reported: "EMERGENCY: Open manhole with no cover near bus stop" near Model Town Bus Stop. It needs immediate attention.',
      false,
      5,
    ],
    [
      admin.id,
      "Chronic Issue Detected",
      '"Same pothole keeps reopening on Station Road" has been reopened 3 times. The fixes are not holding.',
      false,
      40,
    ],
    [
      admin.id,
      "Issue Escalated",
      '"Major road cave-in near the flyover ramp" breached its SLA and was automatically escalated to level 2.',
      true,
      48,
    ],
  ];

  for (const [
    userId,
    title,
    message,
    isRead,
    hrs,
  ] of notificationSpecs) {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead,
        createdAt: hoursAgo(hrs),
      },
    });
  }

  return { created };
}

// What the curated jobs cost so far — the demo officer's
// current job has a fresh entry he can still delete.
async function seedCuratedCosts(
  created: Record<string, any>,
  people: People
) {
  const { officer, officer2 } = people;

  const lines: Array<[string, string, CostKind, string, number, number]> = [
    // story, logged by, kind, description, rupees, hours ago
    ["in-progress", officer.id, "MATERIAL", "Hot-mix asphalt (1.2 t) for base and surfacing", 18_400, 26],
    ["in-progress", officer.id, "LABOUR", "Patching crew, 2 days (5 workers)", 9_600, 4],
    ["emergency", officer2.id, "EQUIPMENT", "Barricades and warning lights (hire)", 1_200, 2],
    ["resolved-awaiting", officer.id, "MATERIAL", "Replacement footpath slabs (40)", 6_800, 30],
    ["resolved-awaiting", officer.id, "LABOUR", "Mason and helper, 1 day", 2_400, 10],
    ["closed-1", officer.id, "EQUIPMENT", "Tipper truck, 2 trips", 3_200, 226],
    ["closed-2", officer2.id, "MATERIAL", "RCC drain cover 600 × 600 mm", 4_500, 350],
    ["closed-2", officer2.id, "LABOUR", "Fitting crew (3 workers)", 1_800, 345],
  ];

  await prisma.workCost.createMany({
    data: lines.map(([key, loggedById, kind, description, amount, hrs]) => ({
      issueId: created[key].id,
      loggedById,
      kind,
      description,
      amount,
      createdAt: hoursAgo(hrs),
    })),
  });
}

// ─────────────────────────────────────────────
// GENERATED HISTORY — a year of cases
// ─────────────────────────────────────────────

interface PlannedEvent {
  status: IssueStatus;
  at: number;
  by: string | null;
  note: string;
  imageUrl?: string;
}

interface HistoricIssue {
  id: string;
  title: string;
  wardKey: string;
  category: IssueCategory;
  status: IssueStatus;
  createdAt: number;
  open: boolean;
  officerId: string | null;
  duplicateOf?: string;
  markedAt?: number;
}

const CLOSING = new Set<IssueStatus>(["RESOLVED", "CLOSED"]);

// Replays the SLA job (runs every minute): an open case is
// flagged once its deadline has passed — at the deadline, or
// the moment it is reopened after it.
function slaBreachMoment(
  events: PlannedEvent[],
  createdAt: number,
  deadline: number
) {
  let open = true;
  let openSince = createdAt;

  for (const event of events) {
    if (CLOSING.has(event.status)) {
      if (open && deadline < event.at) {
        return Math.max(deadline, openSince);
      }
      open = false;
    } else if (!open) {
      open = true;
      openSince = event.at;
    }
  }

  return open && deadline < NOW ? Math.max(deadline, openSince) : null;
}

async function seedHistory(org: Org, people: People) {
  console.log("Generating a year of case history...");

  const rows = {
    issues: [] as Prisma.IssueCreateManyInput[],
    complaints: [] as Prisma.ComplaintCreateManyInput[],
    history: [] as Prisma.StatusHistoryCreateManyInput[],
    assignments: [] as Prisma.AssignmentCreateManyInput[],
    slas: [] as Prisma.SLACreateManyInput[],
    escalations: [] as Prisma.EscalationCreateManyInput[],
    verifications: [] as Prisma.ResolutionVerificationCreateManyInput[],
    costs: [] as Prisma.WorkCostCreateManyInput[],
    upvotes: [] as Prisma.UpvoteCreateManyInput[],
  };

  const generated: HistoricIssue[] = [];
  const latestByWardCategory = new Map<string, HistoricIssue>();
  const adminId = people.admin.id;

  function pickReporter(wardKey: string, t0: number) {
    if (chance(0.08)) return null; // anonymous

    const eligible = people.citizens.filter(
      (person) => person.joinedAt < t0 - DAY
    );
    const locals = eligible.filter(
      (person) => person.homeWard === wardKey
    );
    const pool =
      locals.length > 0 && chance(0.75) ? locals : eligible;

    return pickWeighted(pool, (person) => person.weight);
  }

  function pickOfficer(dept: DeptKey, at: number) {
    const team = people.officers.filter(
      (officer) => officer.dept === dept
    );
    const onDuty = team.filter((officer) => officer.joinedAt < at);

    return pickWeighted(
      onDuty.length > 0 ? onDuty : team,
      (officer) => officer.weight
    );
  }

  function buildIssue(
    category: IssueCategory,
    t0: number,
    month: number
  ) {
    const ward = pickWeighted(
      WARDS,
      (spec) => spec.volume * (spec.affinity?.[category] ?? 1)
    );
    const deptKey = CATEGORY_DEPT[category];
    const dept = DEPARTMENTS[deptKey];
    const severity = pickWeighted(
      SEVERITIES,
      (level) => SEVERITY_MIX[category][SEVERITIES.indexOf(level)]
    );
    const reporter = pickReporter(ward.key, t0);
    const street = pick(ward.streets);
    const id = makeId();
    const title = pick(TITLES[category]).replace("{street}", street);
    const description = pick(DESCRIPTIONS[category]);
    const latitude = round6(ward.lat + gaussian() * 0.0032);
    const longitude = round6(ward.lng + gaussian() * 0.0038);
    const image = pick(IMAGES[category]);

    const plan: PlannedEvent[] = [];

    // Events are strictly ordered, at least a minute apart.
    const push = (
      status: IssueStatus,
      at: number,
      by: string | null,
      note: string,
      imageUrl?: string
    ) => {
      const previous = plan[plan.length - 1]?.at ?? 0;

      plan.push({
        status,
        at: Math.max(at, previous + 60_000),
        by,
        note,
        imageUrl,
      });
    };

    const lastAt = () => plan[plan.length - 1].at;

    push(
      "REPORTED",
      t0,
      reporter?.id ?? null,
      reporter
        ? "Issue reported by a citizen"
        : "Issue reported anonymously"
    );
    award(reporter?.id, 5);

    rows.complaints.push({
      citizenId: reporter?.id ?? null,
      issueId: id,
      imageUrl: image,
      photos: [image],
      description,
      latitude,
      longitude,
      createdAt: new Date(t0),
    });

    const base = {
      id,
      title,
      description,
      category,
      severity,
      latitude,
      longitude,
      address: `${street}, ${ward.name}, New Delhi`,
      aiConfidence: Math.round(between(0.7, 0.98) * 100) / 100,
      departmentId: org.departments[deptKey].id,
      wardId: org.wardIds[ward.key],
      createdAt: new Date(t0),
    };

    const key = `${ward.key}|${category}`;
    const original = latestByWardCategory.get(key);

    // ~3%: the same problem reported again while the first
    // report is still recent; an admin merges it.
    if (
      original &&
      t0 - original.createdAt < 25 * DAY &&
      chance(0.035)
    ) {
      push(
        "DUPLICATE",
        t0 + between(1, 30) * HOUR,
        adminId,
        `Marked as duplicate of "${original.title}" (${original.id})`
      );

      rows.issues.push({
        ...base,
        status: "DUPLICATE",
        updatedAt: new Date(lastAt()),
      });
      plan.forEach((event) =>
        rows.history.push({
          issueId: id,
          changedBy: event.by,
          status: event.status,
          note: event.note,
          createdAt: new Date(event.at),
        })
      );
      generated.push({
        id,
        title,
        wardKey: ward.key,
        category,
        status: "DUPLICATE",
        createdAt: t0,
        open: false,
        officerId: null,
        duplicateOf: original.id,
        markedAt: lastAt(),
      });
      return;
    }

    // ── Plan the lifecycle ────────────────────────
    const officer = pickOfficer(deptKey, t0);
    const quality = ward.quality;
    const monsoon = month >= 6 && month <= 8;
    const slaH = SLA_HOURS[severity];

    let fixH =
      dept.fixMedianH *
      SEVERITY_FIX[severity] *
      (0.75 + (1 - quality) * 0.7) *
      (deptKey === "water" && monsoon ? 1.5 : 1) *
      Math.exp(0.55 * gaussian());

    const pBreach = clamp(
      (1 - quality) ** 2 * 0.26 +
        dept.breachPenalty +
        (deptKey === "water" && monsoon ? 0.06 : 0),
      0.02,
      0.5
    );

    // Decide the SLA outcome first, then keep the fix time on
    // the right side of the deadline.
    if (chance(pBreach)) {
      fixH = Math.max(fixH, slaH * between(1.08, 2.4));
    } else if (fixH > slaH * 0.97) {
      fixH = slaH * between(0.55, 0.97);
    }
    fixH = Math.max(fixH, 1.5);

    const ageDays = (NOW - t0) / DAY;
    const stalled = chance(
      ageDays < 45
        ? 0.07 + (1 - quality) * 0.12
        : 0.002 + (1 - quality) * 0.035
    );
    const stallStage = pickWeighted(
      ["ASSIGNED", "ACKNOWLEDGED", "IN_PROGRESS"] as const,
      (stage) =>
        stage === "ASSIGNED" ? 1 : stage === "ACKNOWLEDGED" ? 2 : 3
    );

    const assignH = Math.min(
      fixH * 0.3,
      severity === "CRITICAL" ? between(0.2, 1) : between(0.5, 8)
    );
    const ackH = assignH + Math.min((fixH - assignH) * 0.25, between(0.3, 6));
    const startH = ackH + (fixH - ackH) * between(0.15, 0.6);

    push(
      "ASSIGNED",
      t0 + assignH * HOUR,
      adminId,
      `Assigned to ${officer.name} (${dept.name})`
    );

    if (!stalled || stallStage !== "ASSIGNED") {
      push(
        "ACKNOWLEDGED",
        t0 + ackH * HOUR,
        officer.id,
        "Authority accepted the assignment"
      );
    }

    if (!stalled || stallStage === "IN_PROGRESS") {
      push(
        "IN_PROGRESS",
        t0 + startH * HOUR,
        officer.id,
        "Authority started working on the issue"
      );
    }

    if (!stalled) {
      if (fixH - startH > 24 && chance(0.35)) {
        push(
          "IN_PROGRESS",
          t0 + (startH + (fixH - startH) * 0.5) * HOUR,
          officer.id,
          pick(PROGRESS_NOTES),
          PROGRESS_IMAGE
        );
      }

      push(
        "RESOLVED",
        t0 + fixH * HOUR,
        officer.id,
        pick(RESOLUTION_NOTES[category]),
        RESOLVED_IMAGE[category]
      );

      if (
        reporter &&
        chance(dept.reopen * (1.3 - quality * 0.6))
      ) {
        push(
          "REOPENED",
          lastAt() + between(10, 96) * HOUR,
          reporter.id,
          `Citizen rejected the resolution: ${pick(REOPEN_REASONS)}`
        );
        push(
          "ACKNOWLEDGED",
          lastAt() + between(3, 60) * HOUR,
          officer.id,
          "Authority accepted the reopened case"
        );
        push(
          "IN_PROGRESS",
          lastAt() + between(2, 24) * HOUR,
          officer.id,
          "Rework started on site"
        );
        push(
          "RESOLVED",
          lastAt() + fixH * between(0.3, 0.9) * HOUR,
          officer.id,
          "Reworked properly this time. Please verify.",
          RESOLVED_IMAGE[category]
        );
      }

      if (reporter) {
        push(
          "CLOSED",
          lastAt() + between(2, 72) * HOUR,
          reporter.id,
          "Citizen verified the resolution"
        );
      } else {
        push(
          "CLOSED",
          lastAt() + between(168, 180) * HOUR,
          adminId,
          "Closed by admin: anonymous report, nobody to verify after 7 days"
        );
      }
    }

    // ── What has happened by now ──────────────────
    let events = plan.filter((event) => event.at <= NOW);

    const deadline = t0 + slaH * HOUR;
    const breachAt = slaBreachMoment(events, t0, deadline);
    const breached = breachAt !== null && breachAt + 90_000 <= NOW;

    if (breached) {
      events = [
        ...events,
        {
          status: "SLA_BREACHED" as const,
          at: breachAt + 30_000,
          by: null,
          note: "Issue exceeded its SLA deadline",
        },
        {
          status: "ESCALATED" as const,
          at: breachAt + 90_000,
          by: null,
          note: "SLA deadline exceeded — automatically escalated to level 1",
        },
      ].sort((a, b) => a.at - b.at);

      // Escalated work has to be resumed before it can be
      // resolved.
      const escalated = events.findIndex(
        (event) => event.status === "ESCALATED"
      );
      const next = events[escalated + 1];

      if (next?.status === "RESOLVED") {
        const from = events[escalated].at;

        events.splice(escalated + 1, 0, {
          status: "IN_PROGRESS",
          at: Math.max(
            from + 1_000,
            Math.min(from + between(1, 12) * HOUR, next.at - 60_000)
          ),
          by: officer.id,
          note: "Work resumed after escalation",
        });
      }
    }

    const last = events[events.length - 1];
    const status = last.status;
    const open = !CLOSING.has(status);
    const resolvedEvents = events.filter(
      (event) => event.status === "RESOLVED"
    );
    const reopenCount = events.filter(
      (event) => event.status === "REOPENED"
    ).length;

    award(reporter?.id, 5 * reopenCount);

    rows.issues.push({
      ...base,
      status,
      isEmergency: severity === "CRITICAL" && chance(0.35),
      reopenCount,
      resolutionImageUrl:
        resolvedEvents.length > 0 ? RESOLVED_IMAGE[category] : null,
      updatedAt: new Date(last.at),
    });

    events.forEach((event) =>
      rows.history.push({
        issueId: id,
        changedBy: event.by,
        status: event.status,
        note: event.note,
        imageUrl: event.imageUrl ?? null,
        createdAt: new Date(event.at),
      })
    );

    // ── Assignment (reactivated on reopen) ────────
    const assigned = [...events]
      .reverse()
      .find(
        (event) =>
          event.status === "ASSIGNED" || event.status === "REOPENED"
      )!;
    const accepted = events.find(
      (event) =>
        event.status === "ACKNOWLEDGED" && event.at > assigned.at
    );
    const completed = open
      ? undefined
      : resolvedEvents[resolvedEvents.length - 1];

    rows.assignments.push({
      issueId: id,
      authorityId: officer.id,
      departmentId: org.departments[deptKey].id,
      wardId: org.wardIds[ward.key],
      assignedAt: new Date(assigned.at),
      acceptedAt: accepted ? new Date(accepted.at) : null,
      completedAt: completed ? new Date(completed.at) : null,
    });

    // ── SLA & escalation ──────────────────────────
    rows.slas.push({
      issueId: id,
      durationMin: slaH * 60,
      deadline: new Date(deadline),
      breached,
      breachedAt: breached ? new Date(breachAt + 30_000) : null,
      createdAt: new Date(t0),
      updatedAt: new Date(breached ? breachAt + 30_000 : t0),
    });

    if (breached) {
      const escalatedAt = breachAt + 90_000;
      const fixedAfter = resolvedEvents.find(
        (event) => event.at > escalatedAt
      );

      rows.escalations.push({
        issueId: id,
        level: 1,
        reason: "SLA deadline exceeded — automatically escalated to level 1",
        escalatedAt: new Date(escalatedAt),
        resolvedAt: fixedAfter ? new Date(fixedAfter.at) : null,
      });
    }

    // ── Citizen verdict & rating ──────────────────
    const closedByReporter = events.find(
      (event) =>
        event.status === "CLOSED" && reporter && event.by === reporter.id
    );

    if (reporter && closedByReporter) {
      const expected =
        dept.rating +
        (quality - 0.5) * 1.1 -
        (breached ? 0.7 : 0) -
        (reopenCount > 0 ? 0.6 : 0) +
        (fixH < slaH * 0.4 ? 0.25 : 0);
      const stars = chance(0.88)
        ? clamp(Math.round(expected + gaussian() * 0.9), 1, 5)
        : null;

      rows.verifications.push({
        issueId: id,
        citizenId: reporter.id,
        verified: true,
        stars,
        comment:
          stars !== null && chance(0.4)
            ? pick(RATING_COMMENTS[stars])
            : null,
        createdAt: new Date(closedByReporter.at),
      });
      award(reporter.id, 15);
    }

    // ── Costs on fixed cases ──────────────────────
    if (resolvedEvents.length > 0) {
      const firstFix = resolvedEvents[0].at;
      const workStart =
        events.find((event) => event.status === "IN_PROGRESS")?.at ?? t0;
      const windowEnd = Math.min(firstFix + 8 * HOUR, NOW);
      const [low, high] = COST_RANGE[category];
      const [from, to] = {
        LOW: [0, 0.5],
        MEDIUM: [0.15, 0.7],
        HIGH: [0.35, 0.9],
        CRITICAL: [0.55, 1],
      }[severity];
      const total = low * Math.pow(high / low, between(from, to));
      const lineCount = pickWeighted([1, 2, 3], (n) => [0.35, 0.45, 0.2][n - 1]);
      const lines = shuffled(COST_LINES[category]).slice(0, lineCount);
      const shares = lines.map(() => between(0.5, 1.5));
      const shareTotal = shares.reduce((sum, share) => sum + share, 0);

      lines.forEach(([kind, label], i) =>
        rows.costs.push({
          issueId: id,
          loggedById: officer.id,
          kind,
          description: label,
          amount: roundTo((total * shares[i]) / shareTotal, 50),
          createdAt: new Date(between(workStart, windowEnd)),
        })
      );

      if (reopenCount > 0 && resolvedEvents.length > 1) {
        rows.costs.push({
          issueId: id,
          loggedById: officer.id,
          kind: "LABOUR",
          description: "Rework after the case was reopened",
          amount: roundTo(total * between(0.15, 0.4), 50),
          createdAt: new Date(
            between(
              firstFix + HOUR,
              resolvedEvents[resolvedEvents.length - 1].at
            )
          ),
        });
      }
    }

    // ── Neighbours backing the case ───────────────
    const backers = poisson(
      { LOW: 0.5, MEDIUM: 1, HIGH: 1.8, CRITICAL: 2.8 }[severity] +
        (open ? 0.8 : 0)
    );
    const pool = people.citizens.filter(
      (person) => person.joinedAt < t0 && person.id !== reporter?.id
    );

    for (const backer of shuffled(pool).slice(0, backers)) {
      rows.upvotes.push({
        userId: backer.id,
        issueId: id,
        createdAt: new Date(
          Math.min(t0 + between(0.5, 96) * HOUR, NOW)
        ),
      });
    }

    const record: HistoricIssue = {
      id,
      title,
      wardKey: ward.key,
      category,
      status,
      createdAt: t0,
      open,
      officerId: officer.id,
    };

    generated.push(record);
    latestByWardCategory.set(key, record);
  }

  // ── Walk the calendar, one local day at a time ──
  for (let dayOffset = -365; dayOffset <= 0; dayOffset++) {
    const dayStart = TODAY_IST + dayOffset * DAY;
    const local = new Date(dayStart + IST_OFFSET);
    const month = local.getUTCMonth();
    const weekday = (local.getUTCDay() + 6) % 7;
    const special = SPECIAL_DAYS[local.toISOString().slice(0, 10)] ?? {};
    // Adoption grows through the year.
    const growth = 0.85 + 0.3 * ((dayOffset + 365) / 365);

    for (const category of CATEGORIES) {
      const lambda =
        BASE_PER_DAY[category] *
        SEASON[category][month] *
        WEEKDAY_FACTOR[weekday] *
        growth *
        (special[category] ?? 1);

      for (let n = poisson(lambda); n > 0; n--) {
        const hour = pickWeighted(HOURS, (h) => hourWeight(category, h));
        const t0 = dayStart + hour * HOUR + randInt(0, 3599) * 1000;

        if (t0 <= HISTORY_ENDS) buildIssue(category, t0, month);
      }
    }
  }

  console.log(`  ${rows.issues.length} cases, writing in batches...`);

  await insertMany(rows.issues, (data) => prisma.issue.createMany({ data }));
  await insertMany(rows.complaints, (data) => prisma.complaint.createMany({ data }));
  await insertMany(rows.history, (data) => prisma.statusHistory.createMany({ data }));
  await insertMany(rows.assignments, (data) => prisma.assignment.createMany({ data }));
  await insertMany(rows.slas, (data) => prisma.sLA.createMany({ data }));
  await insertMany(rows.escalations, (data) => prisma.escalation.createMany({ data }));
  await insertMany(rows.verifications, (data) => prisma.resolutionVerification.createMany({ data }));
  await insertMany(rows.costs, (data) => prisma.workCost.createMany({ data }));
  await insertMany(rows.upvotes, (data) => prisma.upvote.createMany({ data }));

  return generated;
}

// ─────────────────────────────────────────────
// BUDGETS — planners partly anticipate the season: each
// month blends that month's spend with the department's
// median month, plus some slack, so peaks (monsoon drains,
// winter lights, festival garbage) still overrun and quiet
// months come in under.
// ─────────────────────────────────────────────

async function seedBudgets(org: Org) {
  console.log("Seeding department budgets...");

  const months = lastMonthKeys(12, new Date(NOW));

  const spendRows = await prisma.$queryRaw<
    { departmentId: string; month: string; spent: number }[]
  >`
    SELECT i."departmentId" AS "departmentId",
           to_char(date_trunc('month', (c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
           sum(c.amount)::float8 AS spent
    FROM "WorkCost" c
    JOIN "Issue" i ON i.id = c."issueId"
    WHERE i."departmentId" IS NOT NULL
    GROUP BY 1, 2`;

  const spent = new Map(
    spendRows.map((row) => [`${row.departmentId}|${row.month}`, row.spent])
  );

  const rows: Prisma.DepartmentBudgetCreateManyInput[] = [];
  const budgets = new Map<string, number>();

  for (const key of DEPT_KEYS) {
    const department = org.departments[key];
    // The median month, so seasonal peaks stand out as overruns.
    const fullMonths = months
      .slice(0, -1)
      .map((month) => spent.get(`${department.id}|${month}`) ?? 0)
      .filter((amount) => amount > 0)
      .sort((a, b) => a - b);
    const typical =
      fullMonths.length > 0
        ? fullMonths[Math.floor(fullMonths.length / 2)]
        : 200_000;
    const current = months.length - 1;

    months.forEach((month, i) => {
      const actual = spent.get(`${department.id}|${month}`) ?? typical;
      const planned =
        i === current ? typical : 0.6 * actual + 0.4 * typical;
      const amount = roundTo(planned * between(0.92, 1.18), 10_000);

      rows.push({
        departmentId: department.id,
        month,
        amount,
        createdAt: new Date(
          new Date(`${month}-01T10:00:00+05:30`).getTime() - 3 * DAY
        ),
      });
      budgets.set(`${key}|${month}`, amount);
    });
  }

  await prisma.departmentBudget.createMany({ data: rows });

  return { months, budgets };
}

// ─────────────────────────────────────────────
// COMMUNITY — bulletins, polls, drives, watch zones, and the
// audit trail of the admin actions behind them
// ─────────────────────────────────────────────

async function seedCommunity(
  org: Org,
  people: People,
  created: Record<string, any>,
  history: HistoricIssue[],
  budgetPlan: Awaited<ReturnType<typeof seedBudgets>>
) {
  console.log("Seeding bulletins, polls, drives, watch zones and audit trail...");

  const { citizen, rahul, admin, officer, officer2, imran } = people;
  const officerNamed = (name: string) =>
    people.officers.find((member) => member.name === name)!;
  const wardSpec = (key: string) =>
    WARDS.find((spec) => spec.key === key)!;
  const neighboursIn = (wardKey: string) =>
    people.neighbours.filter((person) => person.homeWard === wardKey);
  const near = (wardKey: string, dLat: number, dLng: number) => ({
    latitude: round6(wardSpec(wardKey).lat + dLat),
    longitude: round6(wardSpec(wardKey).lng + dLng),
  });
  const timeBetween = (from: number, to: number) =>
    new Date(between(from, Math.min(to, NOW)));

  const ADMIN_IP = "49.36.112.27";
  const audits: Prisma.AuditEventCreateManyInput[] = [];

  const audit = (
    createdAt: Date,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string | null,
    meta: Prisma.InputJsonValue,
    ip = ADMIN_IP
  ) =>
    audits.push({ createdAt, actorId, action, entityType, entityId, meta, ip });

  // ── Ward Bulletins ──────────────────────────────
  const daysToSaturday = (5 - TODAY_WEEKDAY + 7) % 7 || 7;

  const bulletinSpecs: Array<{
    title: string;
    body: string;
    kind: BulletinKind;
    wardKey: string | null;
    dept: DeptKey | null;
    authorId: string;
    pinned?: boolean;
    startsAt: Date;
    endsAt: Date | null;
    createdAt: Date;
    ip: string;
    audited: boolean;
  }> = [
    {
      title: "Dengue season: report stagnant water and blocked drains",
      body: "Aedes mosquitoes breed in clean standing water. Report blocked drains, leaking pipes and water collecting on construction sites — Water & Drainage crews are prioritising these cases until the end of October.",
      kind: "ADVISORY",
      wardKey: null,
      dept: null,
      authorId: admin.id,
      pinned: true,
      startsAt: istAt(-10, 9),
      endsAt: istAt(27, 23, 59),
      createdAt: istAt(-10, 8, 40),
      ip: ADMIN_IP,
      audited: true,
    },
    {
      title: "Pusa Road resurfacing: one lane closed at night",
      body: "Resurfacing between Karol Bagh Metro and the Arya Samaj Road turn runs nightly from 10 pm to 6 am. One lane stays open; expect slow traffic and use Bank Street as a diversion.",
      kind: "ROADWORKS",
      wardKey: "W15",
      dept: "roads",
      authorId: officerNamed("Ravi Shankar Yadav").id,
      startsAt: istAt(-2, 22),
      endsAt: istAt(5, 6),
      createdAt: istAt(-3, 16, 20),
      ip: "103.211.18.40",
      audited: true,
    },
    {
      title: "Festive season: extra evening garbage rounds",
      body: "From Navratri to Diwali, sanitation crews add an evening round (7–9 pm) in market areas. Please keep wet and dry waste separate; overflowing bins can be reported with a photo.",
      kind: "ADVISORY",
      wardKey: null,
      dept: "sanitation",
      authorId: officerNamed("Kavita Rawat").id,
      startsAt: istAt(-1, 7),
      endsAt: istAt(36, 23),
      createdAt: istAt(-2, 18, 5),
      ip: "103.211.22.17",
      audited: true,
    },
    {
      title: "Water supply off on Saturday, 10 am – 4 pm",
      body: "The water team is replacing the main valve at Nehru Colony Junction. Please store water on Friday night. Supply resumes by 4 pm; the first few minutes may run cloudy.",
      kind: "OUTAGE",
      wardKey: "W7",
      dept: "water",
      authorId: officer2.id,
      startsAt: istAt(daysToSaturday, 10),
      endsAt: istAt(daysToSaturday, 16),
      createdAt: hoursAgo(36),
      ip: "103.211.20.9",
      audited: false,
    },
    {
      title: "Dry waste collection day at Gandhi Market",
      body: "Bring dry waste — paper, plastic, e-waste and old clothes — to the Gandhi Market parking lot between 9 am and 1 pm. Sanitation staff will weigh and receipt every drop-off.",
      kind: "EVENT",
      wardKey: "W12",
      dept: "sanitation",
      authorId: officerNamed("Farhan Qureshi").id,
      startsAt: istAt(6, 9),
      endsAt: istAt(6, 13),
      createdAt: hoursAgo(30),
      ip: "103.211.22.31",
      audited: false,
    },
    {
      title: "Station Road base reconstruction starts next week",
      body: "After three failed patch repairs, the Station Road stretch will be dug out and rebuilt down to the sub-base. Work runs in two halves so one side of the road stays open throughout.",
      kind: "ROADWORKS",
      wardKey: "W21",
      dept: "roads",
      authorId: officer.id,
      startsAt: istAt(4, 8),
      endsAt: istAt(18, 18),
      createdAt: hoursAgo(20),
      ip: "103.211.18.52",
      audited: true,
    },
    {
      title: "Streetlight feeder maintenance on Vikas Marg",
      body: "Streetlights on Vikas Marg between Laxmi Nagar Metro and Shakarpur Chowk will be off from 11 pm to 2 am for feeder maintenance. Police patrols have been informed.",
      kind: "OUTAGE",
      wardKey: "W27",
      dept: "electrical",
      authorId: officerNamed("Deepak Chauhan").id,
      startsAt: istAt(-6, 23),
      endsAt: istAt(-5, 2),
      createdAt: istAt(-8, 12, 10),
      ip: "103.211.24.66",
      audited: false,
    },
    {
      title: "Low water pressure in Daryaganj after main repair",
      body: "Pressure on Ansari Road and Netaji Subhash Marg will be low for three days while the repaired main is flushed and recharged. Upper floors may need to use storage tanks.",
      kind: "OUTAGE",
      wardKey: "W09",
      dept: "water",
      authorId: officerNamed("Arjun Malhotra").id,
      startsAt: istAt(-14, 6),
      endsAt: istAt(-11, 20),
      createdAt: istAt(-15, 17, 45),
      ip: "103.211.20.14",
      audited: false,
    },
  ];

  const bulletinIds: string[] = [];

  for (const spec of bulletinSpecs) {
    const bulletin = await prisma.bulletin.create({
      data: {
        title: spec.title,
        body: spec.body,
        kind: spec.kind,
        pinned: spec.pinned ?? false,
        wardId: spec.wardKey ? org.wardIds[spec.wardKey] : null,
        departmentId: spec.dept ? org.departments[spec.dept].id : null,
        authorId: spec.authorId,
        startsAt: spec.startsAt,
        endsAt: spec.endsAt,
        createdAt: spec.createdAt,
      },
      select: { id: true },
    });

    bulletinIds.push(bulletin.id);

    if (spec.audited) {
      audit(spec.createdAt, spec.authorId, "bulletin.publish", "Bulletin", bulletin.id, {
        title: spec.title,
        kind: spec.kind,
        wardId: spec.wardKey ? org.wardIds[spec.wardKey] : null,
        pinned: spec.pinned ?? false,
      }, spec.ip);
    }
  }

  // ── Ward Votes ──────────────────────────────────
  async function seedPoll(spec: {
    question: string;
    description: string;
    wardKey: string | null;
    createdAt: Date;
    closesAt: Date;
    closedAt: Date | null;
    options: Array<{ label: string; issueId?: string | null; votes: number }>;
    demoVoteFor?: number;
  }) {
    const poll = await prisma.poll.create({
      data: {
        question: spec.question,
        description: spec.description,
        wardId: spec.wardKey ? org.wardIds[spec.wardKey] : null,
        createdById: admin.id,
        createdAt: spec.createdAt,
        closesAt: spec.closesAt,
        closedAt: spec.closedAt,
        options: {
          create: spec.options.map((option, position) => ({
            label: option.label,
            issueId: option.issueId ?? null,
            position,
          })),
        },
      },
      include: { options: { orderBy: { position: "asc" } } },
    });

    // Locals vote first in a ward poll.
    const locals = spec.wardKey ? shuffled(neighboursIn(spec.wardKey)) : [];
    const voters = [
      ...locals,
      ...shuffled(people.neighbours.filter((person) => !locals.includes(person))),
    ].filter((person) => person.joinedAt < spec.createdAt.getTime());

    const votes: Prisma.PollVoteCreateManyInput[] = [];
    let next = 0;
    const votingEnds = (spec.closedAt ?? spec.closesAt).getTime();

    spec.options.forEach((option, i) => {
      for (let k = 0; k < option.votes && next < voters.length; k++) {
        votes.push({
          pollId: poll.id,
          optionId: poll.options[i].id,
          userId: voters[next++].id,
          createdAt: timeBetween(spec.createdAt.getTime(), votingEnds),
        });
      }
    });

    if (spec.demoVoteFor !== undefined) {
      votes.push({
        pollId: poll.id,
        optionId: poll.options[spec.demoVoteFor].id,
        userId: citizen.id,
        createdAt: hoursAgo(30),
      });
    }

    votes.forEach((vote) => award(vote.userId, 2));
    await prisma.pollVote.createMany({ data: votes });

    audit(spec.createdAt, admin.id, "poll.create", "Poll", poll.id, {
      question: spec.question,
      wardId: spec.wardKey ? org.wardIds[spec.wardKey] : null,
      options: spec.options.length,
    });

    if (spec.closedAt) {
      audit(spec.closedAt, admin.id, "poll.close", "Poll", poll.id, {
        question: spec.question,
        totalVotes: votes.length,
      });
    }

    return poll;
  }

  await seedPoll({
    question: "Which repair should get this month's priority fund?",
    description: "The works fund can fast-track one major repair this month. Pick the one that matters most to you — the top choice is scheduled first.",
    wardKey: null,
    createdAt: daysAgo(5),
    closesAt: istAt(9, 20),
    closedAt: null,
    options: [
      { label: "Rebuild the sunken carriageway at the Model Town flyover ramp", issueId: created["escalated"].id, votes: 19 },
      { label: "Reconstruct the base under the Station Road pothole", issueId: created["chronic"].id, votes: 15 },
      { label: "Clear the sewage backing up near Block C, Nehru Colony", issueId: created["sla-breached"].id, votes: 11 },
      { label: "Fix the pothole cluster at Gandhi Market crossing", issueId: created["reported-pothole"].id, votes: 6 },
    ],
  });

  const darkLane = history.find(
    (issue) =>
      issue.wardKey === "W12" && issue.category === "STREETLIGHT" && issue.open
  );

  await seedPoll({
    question: "Where should Gandhi Nagar's next five LED streetlights go?",
    description: "Electrical & Lighting has five new LED fittings for the ward this month.",
    wardKey: "W12",
    createdAt: daysAgo(3),
    closesAt: istAt(11, 20),
    closedAt: null,
    options: [
      { label: "Gandhi Market back lane", issueId: darkLane?.id ?? null, votes: 9 },
      { label: "DAV School approach road", votes: 7 },
      { label: "Shiv Mandir Marg", votes: 4 },
      { label: "Gali No. 4 by the park", votes: 2 },
    ],
    demoVoteFor: 1,
  });

  await seedPoll({
    question: "Should weekend garbage pickup move to 6–8 am?",
    description: "Residents asked for earlier weekend pickups so bins are empty before markets open.",
    wardKey: null,
    createdAt: daysAgo(30),
    closesAt: daysAgo(16),
    closedAt: daysAgo(16),
    options: [
      { label: "Yes, move it to 6–8 am", votes: 27 },
      { label: "Keep the current 9–11 am slot", votes: 12 },
      { label: "Add an evening round instead", votes: 19 },
    ],
  });

  // ── Cleanup Drives ──────────────────────────────
  async function seedDrive(spec: {
    title: string;
    description: string;
    wardKey: string;
    issueId?: string | null;
    organizerId: string;
    status: "PROPOSED" | "APPROVED" | "REJECTED" | "COMPLETED";
    startsAt: Date;
    capacity: number;
    address: string;
    offset: [number, number];
    createdAt: Date;
    moderatedAt?: Date;
    moderationNote?: string;
    rsvps?: string[];
    attended?: number;
  }) {
    const drive = await prisma.drive.create({
      data: {
        title: spec.title,
        description: spec.description,
        organizerId: spec.organizerId,
        wardId: org.wardIds[spec.wardKey],
        issueId: spec.issueId ?? null,
        ...near(spec.wardKey, spec.offset[0], spec.offset[1]),
        address: spec.address,
        startsAt: spec.startsAt,
        capacity: spec.capacity,
        status: spec.status,
        moderationNote: spec.moderationNote ?? null,
        createdAt: spec.createdAt,
      },
      select: { id: true },
    });

    const rsvpOpens = (spec.moderatedAt ?? spec.createdAt).getTime();
    const rsvpCloses = Math.min(spec.startsAt.getTime(), NOW);
    const attendedCount = spec.attended ?? 0;

    await prisma.driveRsvp.createMany({
      data: (spec.rsvps ?? []).map((userId, i) => ({
        driveId: drive.id,
        userId,
        attended: i < attendedCount,
        createdAt: timeBetween(rsvpOpens, rsvpCloses),
      })),
    });

    if (spec.status === "COMPLETED") {
      (spec.rsvps ?? []).slice(0, attendedCount).forEach((userId) => award(userId, 15));
      award(spec.organizerId, 25);
    }

    if (spec.moderatedAt) {
      const decision = spec.status === "REJECTED" ? "REJECT" : "APPROVE";

      audit(spec.moderatedAt, admin.id, "drive.moderate", "Drive", drive.id, {
        decision,
        note: spec.moderationNote ?? null,
        title: spec.title,
      });
    }

    return drive.id;
  }

  const othersThan = (excluded: string[], wardKey: string, count: number) => {
    const locals = shuffled(neighboursIn(wardKey));
    const rest = shuffled(people.neighbours.filter((person) => !locals.includes(person)));

    return [...locals, ...rest]
      .map((person) => person.id)
      .filter((id) => !excluded.includes(id))
      .slice(0, count);
  };

  const gandhiOrganizer = neighboursIn("W12")[0];
  const laxmiOrganizer = neighboursIn("W27")[0];
  const karolOrganizer = neighboursIn("W15")[0];

  await seedDrive({
    title: "Clean-up at the DAV School gate",
    description: "The bin outside the school gate keeps overflowing. Let's clear the footpath, bag the litter for the sanitation truck and paint the wall next to it. Gloves and bags provided.",
    wardKey: "W12",
    issueId: created["reported-garbage"].id,
    organizerId: gandhiOrganizer.id,
    status: "APPROVED",
    startsAt: istAt(4, 7, 30),
    capacity: 25,
    address: "DAV School gate, Gandhi Nagar",
    offset: [0.0015, 0.001],
    createdAt: daysAgo(7),
    moderatedAt: daysAgo(6),
    rsvps: [citizen.id, ...othersThan([gandhiOrganizer.id], "W12", 13)],
  });

  await seedDrive({
    title: "Vikas Marg plastic sweep before Diwali",
    description: "Two hours along Vikas Marg's service lane picking up plastic before the festival rush. We'll split into four teams from the metro gate. Wear closed shoes.",
    wardKey: "W27",
    organizerId: laxmiOrganizer.id,
    status: "APPROVED",
    startsAt: istAt(11, 8),
    capacity: 40,
    address: "Laxmi Nagar Metro, Gate 2",
    offset: [0.001, -0.002],
    createdAt: daysAgo(4),
    moderatedAt: daysAgo(3),
    rsvps: othersThan([laxmiOrganizer.id], "W27", 22),
  });

  const marketCase = history.find(
    (issue) =>
      issue.wardKey === "W15" &&
      issue.category === "GARBAGE" &&
      issue.createdAt > NOW - 40 * DAY &&
      issue.createdAt < NOW - 20 * DAY
  );

  await seedDrive({
    title: "Karol Bagh market Sunday sweep",
    description: "Early-morning sweep of Ajmal Khan Road and Gaffar Market before the shops open, with traders' associations and the sanitation team.",
    wardKey: "W15",
    issueId: marketCase?.id ?? null,
    organizerId: karolOrganizer.id,
    status: "COMPLETED",
    startsAt: istAt(-19, 7),
    capacity: 50,
    address: "Ajmal Khan Road, near Gaffar Market",
    offset: [-0.001, 0.0015],
    createdAt: daysAgo(30),
    moderatedAt: daysAgo(25),
    rsvps: othersThan([karolOrganizer.id], "W15", 31),
    attended: 24,
  });

  await seedDrive({
    title: "Gandhi Market back-lane litter pick",
    description: "The back lane behind Gandhi Market collects plastic and food waste from the evening stalls. A one-hour litter pick, then we hand the bags to the morning sanitation round.",
    wardKey: "W12",
    organizerId: citizen.id,
    status: "PROPOSED",
    startsAt: istAt(9, 8),
    capacity: 20,
    address: "Back lane behind Gandhi Market",
    offset: [-0.0008, -0.0012],
    createdAt: hoursAgo(20),
  });

  await seedDrive({
    title: "Night repainting of road dividers on Station Road",
    description: "Volunteers repaint the faded dividers on Station Road at night when traffic is light.",
    wardKey: "W21",
    organizerId: rahul.id,
    status: "REJECTED",
    startsAt: istAt(6, 22),
    capacity: 15,
    address: "Station Road, Model Town",
    offset: [-0.0025, 0.004],
    createdAt: daysAgo(3),
    moderatedAt: daysAgo(2),
    moderationNote: "Road marking needs a licensed contractor and a traffic police NOC. Happy to approve a daytime litter drive on the same stretch instead.",
  });

  // ── Watch Zones for the demo citizen ────────────
  await prisma.watchZone.createMany({
    data: [
      {
        userId: citizen.id,
        name: "Home",
        latitude: wardSpec("W12").lat,
        longitude: wardSpec("W12").lng,
        radiusM: 800,
        categories: [],
        createdAt: daysAgo(50),
      },
      {
        userId: citizen.id,
        name: "Office",
        latitude: 28.6328,
        longitude: 77.2197,
        radiusM: 1500,
        categories: ["ROAD_DAMAGE", "STREETLIGHT", "WATER_LEAKAGE"],
        createdAt: daysAgo(35),
      },
    ],
  });

  // ── A few notifications from the new features ──
  await prisma.notification.createMany({
    data: [
      {
        userId: citizen.id,
        title: "New case in Home",
        message: '"Garbage bin overflowing outside school gate" was reported inside your watch zone "Home".',
        createdAt: hoursAgo(20),
      },
      {
        userId: citizen.id,
        title: "New bulletin in Gandhi Nagar",
        message: `${bulletinSpecs[4].title}: ${bulletinSpecs[4].body}`,
        createdAt: hoursAgo(30),
      },
      {
        userId: admin.id,
        title: "Cleanup Drive proposed",
        message: `${citizen.name} proposed "Gandhi Market back-lane litter pick". Review it in Drives.`,
        createdAt: hoursAgo(20),
      },
      {
        userId: rahul.id,
        title: "Your Cleanup Drive was not approved",
        message: '"Night repainting of road dividers on Station Road" was not approved. Reason: Road marking needs a licensed contractor and a traffic police NOC.',
        isRead: true,
        createdAt: daysAgo(2),
      },
    ],
  });

  // ── Audit trail for the remaining admin actions ─
  const { months, budgets } = budgetPlan;
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const dayOfMonth = new Date(TODAY_IST + IST_OFFSET).getUTCDate();

  DEPT_KEYS.forEach((key, i) => {
    const at = Math.min(
      istAt(1 - dayOfMonth, 10, 15 + i * 3).getTime(),
      NOW - HOUR
    );

    audit(new Date(at), admin.id, "budget.set", "DepartmentBudget", null, {
      departmentId: org.departments[key].id,
      department: DEPARTMENTS[key].name,
      month: thisMonth,
      amount: budgets.get(`${key}|${thisMonth}`) ?? 0,
      previous: null,
    });
  });

  const monsoonBudget = budgets.get(`water|${lastMonth}`) ?? 0;

  audit(
    new Date(new Date(`${lastMonth}-10T11:30:00+05:30`).getTime()),
    admin.id,
    "budget.set",
    "DepartmentBudget",
    null,
    {
      departmentId: org.departments.water.id,
      department: DEPARTMENTS.water.name,
      month: lastMonth,
      amount: monsoonBudget,
      previous: roundTo(monsoonBudget * 0.82, 10_000),
    }
  );

  audit(hoursAgo(4), admin.id, "issue.duplicate", "Issue", created["duplicate"].id, {
    originalId: created["reported-pothole"].id,
  });

  const recentDuplicate = [...history]
    .reverse()
    .find((issue) => issue.status === "DUPLICATE");

  if (recentDuplicate) {
    audit(new Date(recentDuplicate.markedAt ?? recentDuplicate.createdAt), admin.id, "issue.duplicate", "Issue", recentDuplicate.id, {
      originalId: recentDuplicate.duplicateOf ?? null,
    });
  }

  audit(hoursAgo(4.5), admin.id, "sla.set", "Issue", created["emergency"].id, {
    durationMin: 240,
    reason: "Emergency: open manhole at a bus stop",
  });

  const reworkedRoad = history.find(
    (issue) =>
      issue.officerId === officer.id &&
      issue.status === "CLOSED" &&
      issue.createdAt > NOW - 30 * DAY
  );

  if (reworkedRoad) {
    audit(daysAgo(9), admin.id, "cost.delete", "WorkCost", null, {
      issueId: reworkedRoad.id,
      kind: "MATERIAL",
      description: "Hot-mix asphalt (logged twice)",
      amount: 12_400,
      loggedById: officer.id,
    });
  }

  audit(daysAgo(21), admin.id, "user.role.change", "User", imran.id, {
    from: "CITIZEN",
    to: "AUTHORITY",
    name: imran.name,
  });
  audit(new Date(daysAgo(21).getTime() + 20 * 60_000), admin.id, "user.verify", "User", imran.id, {
    name: imran.name,
    department: DEPARTMENTS.electrical.name,
  });

  await prisma.auditEvent.createMany({ data: audits });

  return { bulletins: bulletinIds.length, audits: audits.length };
}

// ─────────────────────────────────────────────
// POINTS — settle what generated activity earned
// ─────────────────────────────────────────────

async function settlePoints() {
  await prisma.$transaction(
    [...earnedPoints].map(([id, points]) =>
      prisma.user.update({
        where: { id },
        data: { points: { increment: points } },
      })
    )
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  await wipe();

  const org = await seedOrganisation();
  const people = await seedPeople(org);
  const { created } = await seedCuratedStories(org, people);

  await seedCuratedCosts(created, people);

  const history = await seedHistory(org, people);
  const budgets = await seedBudgets(org);

  await seedCommunity(org, people, created, history, budgets);
  await settlePoints();

  const counts = {
    users: await prisma.user.count(),
    wards: await prisma.ward.count(),
    issues: await prisma.issue.count(),
    complaints: await prisma.complaint.count(),
    history: await prisma.statusHistory.count(),
    assignments: await prisma.assignment.count(),
    slas: await prisma.sLA.count(),
    escalations: await prisma.escalation.count(),
    verifications: await prisma.resolutionVerification.count(),
    upvotes: await prisma.upvote.count(),
    comments: await prisma.comment.count(),
    messages: await prisma.message.count(),
    notifications: await prisma.notification.count(),
    workCosts: await prisma.workCost.count(),
    budgets: await prisma.departmentBudget.count(),
    bulletins: await prisma.bulletin.count(),
    polls: await prisma.poll.count(),
    pollVotes: await prisma.pollVote.count(),
    drives: await prisma.drive.count(),
    driveRsvps: await prisma.driveRsvp.count(),
    watchZones: await prisma.watchZone.count(),
    auditEvents: await prisma.auditEvent.count(),
  };

  console.log("\nSeed complete:", counts);
  console.log(`Took ${((Date.now() - NOW) / 1000).toFixed(1)} s`);
  console.log(`
=========================================================
  MOCK LOGIN CREDENTIALS
=========================================================
  CITIZEN    citizen@fixity.test      ${PASSWORDS.citizen}
             priya@fixity.test        ${PASSWORDS.citizen}
             rahul@fixity.test        ${PASSWORDS.citizen}
             aisha@fixity.test        ${PASSWORDS.citizen}
             (+${GENERATED_CITIZENS} neighbours, e.g. ${neighbourEmailHint()})

  AUTHORITY  authority@fixity.test    ${PASSWORDS.authority}  (Roads)
             engineer@fixity.test     ${PASSWORDS.authority}  (Water)
             ${NEW_OFFICERS.map((spec) => spec.email).slice(0, 3).join(", ")}, …

  ADMIN      admin@fixity.test        ${PASSWORDS.admin}
=========================================================
`);
}

function neighbourEmailHint() {
  return `${FIXED_NAMES[0].toLowerCase().replace(/[^a-z]+/g, ".")}@fixity.test`;
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
