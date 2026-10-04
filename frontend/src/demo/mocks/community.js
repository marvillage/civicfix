// Demo-mode responses for the community features: Ward Bulletins,
// Watch Zones, Ward Vote and Cleanup Drives (docs/CONTRACT-v2.md).
// Return [status, data] to answer, or null to fall through.
//
// State lives in this module so a session feels live (votes count,
// RSVPs fill a drive) and resets on reload. Every timestamp is
// relative to the first request, so "Ends in 3 h" stays true.

import fixtures from "../fixtures.json";
import { OPEN_STATUSES } from "../../lib/labels";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const CATEGORIES = [
  "ROAD_DAMAGE",
  "STREETLIGHT",
  "GARBAGE",
  "WATER_LEAKAGE",
  "DRAINAGE",
  "OTHER",
];

// ── Reference data (ids match the recorded fixtures) ────────

const WARDS = {
  GN: { id: "cmuu0m07800049kkrd2jzysdi", name: "Gandhi Nagar", code: "W-12" },
  NC: { id: "cmuu0m07900059kkrp1kusw5u", name: "Nehru Colony", code: "W-07" },
  RP: { id: "cmuu0m07a00069kkr1scymdir", name: "Rajendra Park", code: "W-03" },
  MT: { id: "cmuu0m07a00079kkryi5sh5vk", name: "Model Town", code: "W-21" },
};

const WARD_LIST = Object.values(WARDS);

const DEPTS = {
  ROADS: { id: "cmuu0m07300009kkrzjusk92k", name: "Roads & Infrastructure" },
  SANITATION: { id: "cmuu0m07600019kkrcxgh5sc6", name: "Sanitation & Waste" },
  WATER: { id: "cmuu0m07700029kkrnvha5dny", name: "Water & Drainage" },
  LIGHTING: { id: "cmuu0m07800039kkrs2moluz7", name: "Electrical & Lighting" },
};

const { accounts } = fixtures;

function userRef(account) {
  return {
    id: account.id,
    name: account.name,
    avatarUrl: account.avatarUrl ?? null,
    role: account.role,
    designation: account.designation ?? null,
  };
}

const PEOPLE = {
  me: userRef(accounts.CITIZEN),
  sunil: userRef(accounts.AUTHORITY),
  admin: userRef(accounts.ADMIN),
  meera: {
    id: "cmuu0m0pa000m9kkrq6ve0wf8",
    name: "Meera Joshi",
    avatarUrl: null,
    role: "AUTHORITY",
    designation: "Assistant Engineer",
  },
  arvind: {
    id: "demo-officer-arvind",
    name: "Arvind Rao",
    avatarUrl: null,
    role: "AUTHORITY",
    designation: "Junior Engineer",
  },
  farida: {
    id: "demo-officer-farida",
    name: "Farida Sheikh",
    avatarUrl: null,
    role: "AUTHORITY",
    designation: "Sanitary Inspector",
  },
  aisha: {
    id: "cmuu0m0p8000k9kkrq87lyg07",
    name: "Aisha Khan",
    avatarUrl: null,
    role: "CITIZEN",
    designation: null,
  },
  rahul: {
    id: "cmuu0m0p7000j9kkrkvhwlcnt",
    name: "Rahul Verma",
    avatarUrl: null,
    role: "CITIZEN",
    designation: null,
  },
  priya: {
    id: "cmuu0m0p6000i9kkrytyx2i9s",
    name: "Priya Menon",
    avatarUrl: null,
    role: "CITIZEN",
    designation: null,
  },
};

const VOLUNTEER_NAMES = [
  "Rohan Das", "Kavya Nair", "Imran Ali", "Pooja Bansal", "Deepak Yadav",
  "Ritu Malhotra", "Harpreet Kaur", "Manish Tiwari", "Sneha Iyer",
  "Aditya Joshi", "Farah Siddiqui", "Gaurav Chauhan", "Nisha Pillai",
  "Arjun Mehta", "Sana Qureshi", "Vikram Singh", "Neha Gupta",
  "Karan Kapoor", "Lakshmi Reddy", "Mohit Saxena", "Tanvi Desai",
  "Yusuf Ansari", "Divya Bhatt", "Siddharth Jain", "Meenakshi Pandey",
  "Ravi Shankar", "Zoya Mirza", "Abhishek Rawat", "Shalini Verma",
  "Naveen Kumar", "Ishita Sen", "Pranav Kulkarni", "Gurleen Sodhi",
  "Faisal Rahman", "Anjali Thakur", "Varun Bhatia", "Rekha Mishra",
  "Tarun Arora", "Bhavna Chopra", "Sameer Khan", "Ayesha Patel",
  "Hemant Rana", "Nandini Ghosh", "Kunal Sethi", "Jasmine Gill",
];

const VOLUNTEERS = VOLUNTEER_NAMES.map((name, index) => ({
  id: `demo-volunteer-${index + 1}`,
  name,
  avatarUrl: null,
  role: "CITIZEN",
  designation: null,
}));

// ── Recorded issues (time-shifted like the demo adapter) ────

const recordedAt = Date.parse(fixtures.recordedAt);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function shiftDates(value, shiftMs) {
  if (Array.isArray(value)) {
    return value.map((item) => shiftDates(item, shiftMs));
  }

  if (value && typeof value === "object") {
    const copy = {};

    for (const key of Object.keys(value)) {
      copy[key] = shiftDates(value[key], shiftMs);
    }

    return copy;
  }

  if (typeof value === "string" && ISO_RE.test(value)) {
    return new Date(Date.parse(value) + shiftMs).toISOString();
  }

  return value;
}

function recordedIssues() {
  return (
    [
      ...new Map(
        Object.entries(fixtures.responses.public)
          .filter(([key]) => key.startsWith("GET /issues?"))
          .flatMap(([, value]) => value.data?.issues || [])
          .map((issue) => [issue.id, issue])
      ).values(),
    ]
  );
}

let state = null;
let counter = 0;

function issueRef(issueId) {
  if (!issueId) return null;

  const issue = state.issues.find((item) => item.id === issueId);

  return issue
    ? {
        id: issue.id,
        title: issue.title,
        status: issue.status,
        category: issue.category,
      }
    : null;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

// ── Seed data ───────────────────────────────────────────────

function newId(prefix) {
  counter += 1;
  return `demo-${prefix}-${Date.now().toString(36)}${counter}`;
}

// A local wall-clock time `days` from `t` (07:30 etc.), so seeded
// events start at believable hours.
function atLocal(t, days, hour, minute = 0) {
  const date = new Date(t + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function seedBulletins(t) {
  const rows = [
    // Active
    {
      key: "water-cut-nc",
      title: "Water supply off in Nehru Colony, Blocks A–D",
      body: "Crews are replacing the leaking main at Nehru Colony junction, so supply stays off until the new section is in. Water tankers are parked at the Block B park; bring your own containers.",
      kind: "OUTAGE",
      pinned: true,
      startsAt: t - 2 * HOUR,
      endsAt: t + 3 * HOUR,
      ward: WARDS.NC,
      department: DEPTS.WATER,
      author: PEOPLE.meera,
    },
    {
      key: "drains-advisory",
      title: "Report blocked drains before the weekend rain",
      body: "Heavy rain is forecast for the weekend. Drain crews are desilting storm drains ward by ward this week. If a drain near you is choked, file it with Snap & Send so it makes the crew list.",
      kind: "ADVISORY",
      pinned: true,
      startsAt: t - DAY,
      endsAt: t + 3 * DAY,
      ward: null,
      department: null,
      author: PEOPLE.admin,
    },
    {
      key: "station-road",
      title: "Station Road resurfacing: one lane closed",
      body: "We're milling and relaying the stretch between the station and the post office, the patch that keeps reopening. Traffic police will run one lane each way. Buses keep their stops.",
      kind: "ROADWORKS",
      pinned: false,
      startsAt: t - 5 * HOUR,
      endsAt: t + 2 * DAY,
      ward: WARDS.MT,
      department: DEPTS.ROADS,
      author: PEOPLE.sunil,
    },
    {
      key: "lights-4th-cross",
      title: "Streetlights off on 4th Cross while cables are replaced",
      body: "Faulty underground cables are being dug out and replaced. Lights on 4th Cross stay off until the new cables are live; temporary floodlights are up at both ends of the street.",
      kind: "OUTAGE",
      pinned: false,
      startsAt: t - HOUR,
      endsAt: t + 11 * HOUR,
      ward: WARDS.NC,
      department: DEPTS.LIGHTING,
      author: PEOPLE.arvind,
    },
    {
      key: "e-waste",
      title: "E-waste collection at every ward office",
      body: "Bring old phones, chargers, batteries and small appliances to your ward office while the collection runs. Everything goes to an authorised recycler.",
      kind: "EVENT",
      pinned: false,
      startsAt: t - 3 * HOUR,
      endsAt: t + 5 * HOUR,
      ward: null,
      department: DEPTS.SANITATION,
      author: PEOPLE.farida,
    },
    {
      key: "fogging-rp",
      title: "Mosquito fogging in Rajendra Park this week",
      body: "Fogging runs every evening in Lanes 1–5 this week. Keep windows shut during the run and empty standing water from coolers and flower pots.",
      kind: "ADVISORY",
      pinned: false,
      startsAt: t - DAY - 4 * HOUR,
      endsAt: t + 3 * DAY,
      ward: WARDS.RP,
      department: DEPTS.SANITATION,
      author: PEOPLE.farida,
    },
    {
      key: "pickup-time-gn",
      title: "Door-to-door pickup moves to 7 am in Gandhi Nagar",
      body: "From this week the collection van reaches Gandhi Nagar lanes at 7 am instead of 9 am. Please keep segregated bins out by 6:45.",
      kind: "ADVISORY",
      pinned: false,
      startsAt: t - 2 * DAY,
      endsAt: null,
      ward: WARDS.GN,
      department: DEPTS.SANITATION,
      author: PEOPLE.farida,
    },

    // Upcoming
    {
      key: "gandhi-market",
      title: "Pothole repair at Gandhi Market crossing, Sunday night",
      body: "The crossing closes to traffic overnight while the pothole cluster is cut out and refilled. Use Market Road East; the market itself stays open.",
      kind: "ROADWORKS",
      pinned: false,
      startsAt: atLocal(t, 2, 23),
      endsAt: atLocal(t, 3, 5),
      ward: WARDS.GN,
      department: DEPTS.ROADS,
      author: PEOPLE.sunil,
    },
    {
      key: "transformer-rp",
      title: "Planned power cut for a transformer upgrade",
      body: "Rajendra Park Lanes 2–4 will be without power for about four hours while the local transformer is swapped for a higher-capacity unit.",
      kind: "OUTAGE",
      pinned: false,
      startsAt: atLocal(t, 1, 10),
      endsAt: atLocal(t, 1, 14),
      ward: WARDS.RP,
      department: DEPTS.LIGHTING,
      author: PEOPLE.arvind,
    },
    {
      key: "ward-meeting-mt",
      title: "Ward meeting on the flyover ramp cave-in",
      body: "Engineers from Roads & Infrastructure explain the repair plan and timeline, then take questions. Community hall, Model Town.",
      kind: "EVENT",
      pinned: false,
      startsAt: atLocal(t, 3, 18),
      endsAt: atLocal(t, 3, 20),
      ward: WARDS.MT,
      department: null,
      author: PEOPLE.admin,
    },

    // Past
    {
      key: "pressure-gn",
      title: "Low water pressure in Gandhi Nagar",
      body: "A valve fault at the zonal reservoir lowered pressure across the ward. The valve has been replaced and pressure is back to normal.",
      kind: "OUTAGE",
      pinned: false,
      startsAt: atLocal(t, -4, 6),
      endsAt: atLocal(t, -3, 14),
      ward: WARDS.GN,
      department: DEPTS.WATER,
      author: PEOPLE.meera,
    },
    {
      key: "desilting-rp",
      title: "Storm-drain desilting on Lane 3",
      body: "Crews cleared 40 metres of silted drain on Rajendra Park Lane 3. Report any flooding after the next rain.",
      kind: "ROADWORKS",
      pinned: false,
      startsAt: atLocal(t, -6, 9),
      endsAt: atLocal(t, -6, 17),
      ward: WARDS.RP,
      department: DEPTS.WATER,
      author: PEOPLE.meera,
    },
    {
      key: "plantation-nc",
      title: "Tree plantation at Nehru Colony park",
      body: "Sixty saplings went in along the park's walking track. Thank you to everyone who turned up with a spade.",
      kind: "EVENT",
      pinned: false,
      startsAt: atLocal(t, -9, 8),
      endsAt: atLocal(t, -9, 11),
      ward: WARDS.NC,
      department: DEPTS.SANITATION,
      author: PEOPLE.farida,
    },
    {
      key: "heat",
      title: "Heat advisory: drinking-water kiosks open till 8 pm",
      body: "With temperatures above 42 °C, every ward's drinking-water kiosk stayed open until 8 pm for the week.",
      kind: "ADVISORY",
      pinned: false,
      startsAt: atLocal(t, -12, 10),
      endsAt: atLocal(t, -8, 20),
      ward: null,
      department: null,
      author: PEOPLE.admin,
    },
  ];

  // Relative times land on the half hour so windows read cleanly.
  const half = (ms) => (ms == null ? null : Math.round(ms / (30 * MINUTE)) * 30 * MINUTE);

  return rows.map(({ key, ...row }) => ({
    id: `demo-bulletin-${key}`,
    createdAt: half(Math.min(row.startsAt, t) - 6 * HOUR),
    ...row,
    startsAt: half(row.startsAt),
    endsAt: half(row.endsAt),
  }));
}

function seedZones(t) {
  return {
    [PEOPLE.me.id]: [
      {
        id: "demo-zone-home",
        name: "Home",
        latitude: 28.6142,
        longitude: 77.2101,
        radiusM: 800,
        categories: [],
        createdAt: t - 20 * DAY,
      },
      {
        id: "demo-zone-school",
        name: "School run",
        latitude: 28.6165,
        longitude: 77.2115,
        radiusM: 400,
        categories: ["GARBAGE", "ROAD_DAMAGE", "STREETLIGHT"],
        createdAt: t - 12 * DAY,
      },
      {
        id: "demo-zone-office",
        name: "Office, Model Town",
        latitude: 28.6232,
        longitude: 77.2152,
        radiusM: 1500,
        categories: ["ROAD_DAMAGE", "DRAINAGE"],
        createdAt: t - 5 * DAY,
      },
    ],
    [PEOPLE.sunil.id]: [
      {
        id: "demo-zone-beat",
        name: "Roads beat: Model Town",
        latitude: 28.6225,
        longitude: 77.2158,
        radiusM: 1200,
        categories: ["ROAD_DAMAGE"],
        createdAt: t - 30 * DAY,
      },
    ],
  };
}

function seedPolls(t) {
  const poll = (key, fields, options) => ({
    id: `demo-poll-${key}`,
    closedAt: null,
    description: null,
    ...fields,
    options: options.map(([label, issueId, votes], index) => ({
      id: `demo-poll-${key}-opt-${index + 1}`,
      label,
      position: index,
      issueId,
      votes,
    })),
    voters: {},
  });

  const fund = poll(
    "ward-fund-gn",
    {
      question: "What should Gandhi Nagar fix first with this quarter's ward fund?",
      description:
        "₹18 lakh is left in the ward works fund. The ward office starts with the option that has the most votes when this closes.",
      ward: WARDS.GN,
      closesAt: atLocal(t, 3, 18),
      createdAt: t - 4 * DAY,
    },
    [
      ["Pothole cluster at the Gandhi Market crossing", "cmuu0m0py000o9kkr0su78sem", 128],
      ["Bins and litter outside DAV School", "cmuu0m0q8000v9kkry1bexznr", 96],
      ["Relay the footpath by the vegetable market", "cmuu0m0qt001q9kkroqa539po", 41],
      ["Brighter streetlights on Market Lane", null, 57],
    ]
  );

  const pickup = poll(
    "bulk-pickup",
    {
      question: "Which slot works best for monthly bulk-waste pickup?",
      description:
        "Sanitation & Waste will run one bulk pickup a month in every ward for furniture, mattresses and garden waste.",
      ward: null,
      closesAt: t + 26 * HOUR,
      createdAt: t - 6 * DAY,
    },
    [
      ["Saturday morning", null, 210],
      ["Sunday morning", null, 340],
      ["A weekday evening", null, 88],
    ]
  );

  // The demo citizen has already voted here, so its results show.
  pickup.voters[PEOPLE.me.id] = pickup.options[1].id;

  const station = poll(
    "station-road-mt",
    {
      question: "Station Road keeps breaking. What should the ward do?",
      description:
        "The same stretch has been patched and reopened twice this year. The Roads department will cost whichever plan wins.",
      ward: WARDS.MT,
      closesAt: atLocal(t, 6, 20),
      createdAt: t - DAY,
    },
    [
      ["Full resurfacing with a three-year warranty", "cmuu0m0rc002i9kkr3i2b167t", 64],
      ["Fix the drain and manhole by the bus stop first", "cmuu0m0qp001k9kkrdpxotkaj", 49],
      ["Patch now, resurface after the monsoon", null, 22],
    ]
  );

  const lights = poll(
    "streetlights-nc",
    {
      question: "Where should the four new streetlights on 4th Cross go?",
      description: "Electrical & Lighting had budget for four poles this year.",
      ward: WARDS.NC,
      closesAt: t - 5 * DAY,
      closedAt: t - 5 * DAY,
      createdAt: t - 19 * DAY,
    },
    [
      ["Near the Block C park gate", null, 73],
      ["Along the dark stretch by the temple", "cmuu0m0qc00109kkrgnorw8xf", 118],
      ["At the bus-stop end", null, 51],
    ]
  );

  const speed = poll(
    "speed-tables-rp",
    {
      question: "Should Park Road get speed tables near the school?",
      ward: WARDS.RP,
      closesAt: t - 14 * DAY,
      closedAt: t - 14 * DAY,
      createdAt: t - 28 * DAY,
    },
    [
      ["Yes, at both ends of the school stretch", null, 156],
      ["Only right outside the school gate", null, 92],
      ["No, leave the road as it is", null, 31],
    ]
  );

  return [fund, pickup, station, lights, speed];
}

function rsvpsFrom(start, count, t, attended = 0) {
  return VOLUNTEERS.slice(start, start + count).map((user, index) => ({
    user,
    attended: index < attended,
    createdAt: t - (count - index) * 3 * HOUR,
  }));
}

function seedDrives(t) {
  const startedAt = Math.floor((t - 2 * HOUR) / (30 * MINUTE)) * 30 * MINUTE;

  const drives = [
    {
      key: "park-gate-mt",
      title: "Central Park gate clean-up",
      description:
        "The bins at the park entrance overflow every weekend and the litter blows onto the jogging track. We'll clear the gate area and the first 200 m of the track, sort what we collect and hand it to the Sanitation van at 10. Gloves and bags provided; bring water and a cap.",
      startsAt: atLocal(t, 2, 7, 30),
      capacity: 30,
      status: "APPROVED",
      address: "Central Park Gate, Model Town",
      latitude: 28.6103,
      longitude: 77.2211,
      ward: WARDS.MT,
      issueId: "cmuu0m0rk002r9kkrld5a41b6",
      organizer: PEOPLE.aisha,
      rsvps: rsvpsFrom(0, 18, t),
    },
    {
      key: "lane3-drains-rp",
      title: "Clear the drain mouths on Lane 3 before the rain",
      description:
        "Plastic and leaves choke the drain grates on Lane 3, so the lane floods with every shower. We'll clear the grates and the gutter line, with the ward's sanitation crew on hand to haul the silt away.",
      startsAt: atLocal(t, 4, 8),
      capacity: 20,
      status: "APPROVED",
      address: "Rajendra Park Lane 3",
      latitude: 28.6094,
      longitude: 77.2158,
      ward: WARDS.RP,
      issueId: "cmuu0m0qi00199kkr6wv3b0qm",
      organizer: PEOPLE.rahul,
      rsvps: rsvpsFrom(18, 20, t),
    },
    {
      key: "school-gate-gn",
      title: "School-gate litter sweep",
      description:
        "A quick sweep before the school bell: clear the litter around the gate and the bus bay, then stencil 'Use the bin' signs on the wall with the school's art club.",
      startsAt: atLocal(t, 1, 7),
      capacity: 25,
      status: "APPROVED",
      address: "Near DAV School, Gandhi Nagar",
      latitude: 28.6165,
      longitude: 77.2115,
      ward: WARDS.GN,
      issueId: "cmuu0m0q8000v9kkry1bexznr",
      organizer: PEOPLE.me,
      rsvps: rsvpsFrom(5, 9, t),
    },
    {
      key: "park-plastic-nc",
      title: "Nehru Colony park plastic pick-up",
      description:
        "Two hours of picking up wrappers and bottles from the park lawns and the walking path. Meet at the Block C gate; bags and grabbers provided.",
      startsAt: startedAt,
      capacity: 15,
      status: "APPROVED",
      address: "Block C Park, Nehru Colony",
      latitude: 28.6214,
      longitude: 77.2104,
      ward: WARDS.NC,
      issueId: null,
      organizer: PEOPLE.me,
      rsvps: rsvpsFrom(30, 11, t),
    },
    {
      key: "saplings-mt",
      title: "Plant 50 saplings along the Station Road divider",
      description:
        "The horticulture wing has 50 neem and jamun saplings ready. We'll plant them along the divider and fit tree guards. Spades and a water tanker provided.",
      startsAt: atLocal(t, 9, 8),
      capacity: 50,
      status: "APPROVED",
      address: "Station Road, Model Town",
      latitude: 28.6198,
      longitude: 77.2229,
      ward: WARDS.MT,
      issueId: null,
      organizer: PEOPLE.priya,
      rsvps: [
        ...rsvpsFrom(12, 12, t),
        { user: PEOPLE.me, attended: false, createdAt: t - DAY },
      ],
    },
    {
      key: "market-lane-gn",
      title: "Vegetable market lane sweep",
      description:
        "Traders and residents swept the lane after the Sunday market and cleared the dumped crates from the corner by the footpath.",
      startsAt: atLocal(t, -9, 7),
      capacity: 40,
      status: "COMPLETED",
      address: "Vegetable Market Lane, Gandhi Nagar",
      latitude: 28.6148,
      longitude: 77.2098,
      ward: WARDS.GN,
      issueId: "cmuu0m0qt001q9kkroqa539po",
      organizer: PEOPLE.priya,
      rsvps: [
        { user: PEOPLE.me, attended: true, createdAt: t - 11 * DAY },
        ...rsvpsFrom(0, 31, t - 10 * DAY, 26),
      ],
    },
    {
      key: "park-weekend-rp",
      title: "Rajendra Park weekend clean-up",
      description:
        "Clearing the litter around the park benches and the children's play area, and repainting the bins.",
      startsAt: atLocal(t, -3, 8),
      capacity: 30,
      status: "APPROVED",
      address: "Rajendra Park, Park Road",
      latitude: 28.6081,
      longitude: 77.2132,
      ward: WARDS.RP,
      issueId: null,
      organizer: PEOPLE.aisha,
      rsvps: rsvpsFrom(20, 21, t - 4 * DAY),
    },
    {
      key: "junction-nc",
      title: "Junction clean-up after the pipeline work",
      description:
        "Cleared the broken paving and loose soil the pipeline crew left at Nehru Colony junction.",
      startsAt: atLocal(t, -20, 8),
      capacity: 25,
      status: "COMPLETED",
      address: "Nehru Colony Junction",
      latitude: 28.6188,
      longitude: 77.2071,
      ward: WARDS.NC,
      issueId: null,
      organizer: PEOPLE.rahul,
      rsvps: rsvpsFrom(25, 19, t - 21 * DAY, 16),
    },
    {
      key: "flyover-mt",
      title: "Flyover service-lane debris clearing",
      description:
        "Loose rubble from the cave-in has spread onto the service lane. Proposing to clear the service lane only, well outside the cordoned repair site.",
      startsAt: atLocal(t, 4, 9),
      capacity: 20,
      status: "PROPOSED",
      address: "Flyover Ramp service lane, Model Town",
      latitude: 28.6268,
      longitude: 77.2064,
      ward: WARDS.MT,
      issueId: "cmuu0m0r8002c9kkrwdy01x68",
      organizer: PEOPLE.rahul,
      rsvps: [],
    },
    {
      key: "block-c-nc",
      title: "Block C lane wash-down after the sewage fix",
      description:
        "Once the sewage line is repaired, the lane needs a proper wash-down and the dried sludge cleared from the gutters.",
      startsAt: atLocal(t, 6, 8),
      capacity: 25,
      status: "PROPOSED",
      address: "Block C, Nehru Colony",
      latitude: 28.6221,
      longitude: 77.2112,
      ward: WARDS.NC,
      issueId: "cmuu0m0r400269kkr3dq0qk6j",
      organizer: PEOPLE.me,
      rsvps: [],
    },
    {
      key: "pillars-mt",
      title: "Paint the flyover pillars",
      description:
        "Brighten up the pillars under the flyover with a community mural, two coats of weatherproof paint.",
      startsAt: atLocal(t, 5, 8),
      capacity: 30,
      status: "REJECTED",
      moderationNote:
        "Pillar work needs a structural sign-off first. Please propose again once the ramp repair is complete.",
      address: "Under the flyover, Model Town",
      latitude: 28.6262,
      longitude: 77.2072,
      ward: WARDS.MT,
      issueId: null,
      organizer: PEOPLE.me,
      rsvps: [],
    },
  ];

  return drives.map(({ key, ...drive }) => ({
    id: `demo-drive-${key}`,
    moderationNote: null,
    createdAt: Math.min(drive.startsAt, t) - 5 * DAY,
    ...drive,
  }));
}

function db(now) {
  if (!state) {
    const t = now.getTime();

    state = {
      issues: shiftDates(recordedIssues(), t - recordedAt),
      bulletins: seedBulletins(t),
      zones: seedZones(t),
      polls: seedPolls(t),
      drives: seedDrives(t),
    };
  }

  return state;
}

// ── Helpers ─────────────────────────────────────────────────

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

function fail(status, message, code) {
  return [status, code ? { message, code } : { message }];
}

function can(ctx, permission) {
  return !!ctx.account?.permissions?.includes(permission);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function between(value, min, max) {
  return value.length >= min && value.length <= max;
}

function parseTime(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function findWard(wardId) {
  return WARD_LIST.find((ward) => ward.id === wardId) || null;
}

function paginate(rows, params, defaultLimit) {
  const limit = Math.min(Math.max(Number(params.limit) || defaultLimit, 1), 100);
  let start = 0;

  if (params.cursor) {
    const index = rows.findIndex((row) => row.id === params.cursor);
    start = index >= 0 ? index + 1 : rows.length;
  }

  const page = rows.slice(start, start + limit);
  const more = start + limit < rows.length;

  return { page, nextCursor: more ? page[page.length - 1].id : null };
}

// ── Ward Bulletins ──────────────────────────────────────────

function bulletinOut(row, t) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    pinned: row.pinned,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    createdAt: iso(row.createdAt),
    ward: row.ward,
    department: row.department,
    author: row.author,
    isActive: row.startsAt <= t && (row.endsAt == null || row.endsAt > t),
  };
}

function bulletins(ctx, data) {
  const t = ctx.now.getTime();
  const [, id] = ctx.segments;

  if (ctx.method === "GET" && !id) {
    const { status = "active", wardId, kind } = ctx.params;

    const rows = data.bulletins
      .filter((row) => {
        if (status === "active") {
          return row.startsAt <= t && (row.endsAt == null || row.endsAt > t);
        }
        if (status === "upcoming") return row.startsAt > t;
        if (status === "past") return row.endsAt != null && row.endsAt <= t;
        return true;
      })
      .filter((row) => !wardId || row.ward?.id === wardId)
      .filter((row) => !kind || row.kind === kind)
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.startsAt - a.startsAt ||
          a.id.localeCompare(b.id)
      );

    const { page, nextCursor } = paginate(rows, ctx.params, 20);

    return [200, { bulletins: page.map((row) => bulletinOut(row, t)), nextCursor }];
  }

  if (ctx.method === "POST" && !id) {
    if (!can(ctx, "bulletin:publish")) {
      return fail(403, "You don't have permission to publish bulletins");
    }

    const body = ctx.body || {};
    const title = text(body.title);
    const message = text(body.body);
    const startsAt = parseTime(body.startsAt);
    const endsAt = body.endsAt ? parseTime(body.endsAt) : null;

    if (!between(title, 4, 120)) {
      return fail(400, "Title must be 4–120 characters", "VALIDATION");
    }
    if (!between(message, 10, 2000)) {
      return fail(400, "Message must be 10–2000 characters", "VALIDATION");
    }
    if (!["OUTAGE", "ROADWORKS", "ADVISORY", "EVENT"].includes(body.kind)) {
      return fail(400, "Pick a bulletin type", "VALIDATION");
    }
    if (startsAt == null) {
      return fail(400, "Give a start time", "VALIDATION");
    }
    if (body.endsAt && (endsAt == null || endsAt <= startsAt)) {
      return fail(400, "The end time must be after the start time", "VALIDATION");
    }
    if (body.pinned && !can(ctx, "bulletin:manage")) {
      return fail(403, "Only admins can pin bulletins");
    }

    const ward = body.wardId ? findWard(body.wardId) : null;

    if (body.wardId && !ward) return fail(404, "Ward not found");

    const row = {
      id: newId("bulletin"),
      title,
      body: message,
      kind: body.kind,
      pinned: !!body.pinned,
      startsAt,
      endsAt,
      createdAt: t,
      ward,
      department: ctx.account.department
        ? { id: ctx.account.department.id, name: ctx.account.department.name }
        : null,
      author: userRef(ctx.account),
    };

    data.bulletins.unshift(row);

    return [201, { bulletin: bulletinOut(row, t) }];
  }

  if (ctx.method === "DELETE" && id) {
    const row = data.bulletins.find((item) => item.id === id);

    if (!row) return fail(404, "Bulletin not found");

    if (row.author.id !== ctx.account?.id && !can(ctx, "bulletin:manage")) {
      return fail(403, "Only the author or an admin can remove this bulletin");
    }

    data.bulletins = data.bulletins.filter((item) => item.id !== id);

    return [200, { message: "Bulletin removed" }];
  }

  return null;
}

// ── Watch Zones ─────────────────────────────────────────────

function issuesInZone(zone, data) {
  return data.issues
    .filter((issue) => OPEN_STATUSES.includes(issue.status))
    .filter(
      (issue) =>
        zone.categories.length === 0 || zone.categories.includes(issue.category)
    )
    .map((issue) => ({
      ...issue,
      distanceMeters: Math.round(
        distanceMeters(zone.latitude, zone.longitude, issue.latitude, issue.longitude)
      ),
    }))
    .filter((issue) => issue.distanceMeters <= zone.radiusM)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 50);
}

function zoneOut(zone, data) {
  return {
    id: zone.id,
    name: zone.name,
    latitude: zone.latitude,
    longitude: zone.longitude,
    radiusM: zone.radiusM,
    categories: zone.categories,
    createdAt: iso(zone.createdAt),
    openIssues: issuesInZone(zone, data).length,
  };
}

// Validates a POST body (all fields) or a PATCH body (any subset).
function zoneFields(body, partial) {
  const fields = {};

  if (!partial || body.name !== undefined) {
    const name = text(body.name);
    if (!between(name, 2, 40)) return { error: "Name must be 2–40 characters" };
    fields.name = name;
  }

  for (const key of ["latitude", "longitude"]) {
    if (!partial || body[key] !== undefined) {
      const value = Number(body[key]);
      const limit = key === "latitude" ? 90 : 180;
      if (!Number.isFinite(value) || Math.abs(value) > limit) {
        return { error: `Give a valid ${key}` };
      }
      fields[key] = value;
    }
  }

  if (!partial || body.radiusM !== undefined) {
    const radius = Number(body.radiusM);
    if (!Number.isInteger(radius) || radius < 100 || radius > 5000) {
      return { error: "Radius must be between 100 and 5000 metres" };
    }
    fields.radiusM = radius;
  }

  if (body.categories !== undefined) {
    const list = Array.isArray(body.categories) ? body.categories : [];
    if (list.some((category) => !CATEGORIES.includes(category))) {
      return { error: "Unknown category" };
    }
    fields.categories = [...new Set(list)];
  } else if (!partial) {
    fields.categories = [];
  }

  return { fields };
}

function watchZones(ctx, data) {
  if (!ctx.role) return fail(401, "Please log in to continue.", "UNAUTHENTICATED");
  if (!can(ctx, "watchzone:manage")) {
    return fail(403, "You don't have permission to manage Watch Zones");
  }

  const userId = ctx.account.id;
  const zones = (data.zones[userId] ||= []);
  const [, id, sub] = ctx.segments;

  if (!id) {
    if (ctx.method === "GET") {
      return [200, { zones: zones.map((zone) => zoneOut(zone, data)) }];
    }

    if (ctx.method === "POST") {
      const { fields, error } = zoneFields(ctx.body || {}, false);

      if (error) return fail(400, error, "VALIDATION");
      if (zones.length >= 5) {
        return fail(409, "You already have 5 Watch Zones. Delete one to add another.", "LIMIT");
      }

      const zone = { id: newId("zone"), ...fields, createdAt: ctx.now.getTime() };
      zones.push(zone);

      return [201, { zone: zoneOut(zone, data) }];
    }

    return null;
  }

  const zone = zones.find((item) => item.id === id);

  if (!zone) return fail(404, "Watch zone not found");

  if (sub === "issues" && ctx.method === "GET") {
    return [200, { issues: issuesInZone(zone, data) }];
  }

  if (sub) return null;

  if (ctx.method === "GET") return [200, { zone: zoneOut(zone, data) }];

  if (ctx.method === "PATCH") {
    const { fields, error } = zoneFields(ctx.body || {}, true);

    if (error) return fail(400, error, "VALIDATION");

    Object.assign(zone, fields);

    return [200, { zone: zoneOut(zone, data) }];
  }

  if (ctx.method === "DELETE") {
    data.zones[userId] = zones.filter((item) => item.id !== id);
    return [200, { message: "Watch zone deleted" }];
  }

  return null;
}

// ── Ward Vote ───────────────────────────────────────────────

function pollIsOpen(poll, t) {
  return poll.closedAt == null && poll.closesAt > t;
}

function pollOut(poll, ctx) {
  const t = ctx.now.getTime();
  const isOpen = pollIsOpen(poll, t);
  const myVoteOptionId = ctx.account ? poll.voters[ctx.account.id] ?? null : null;
  const resultsVisible =
    !isOpen || myVoteOptionId !== null || can(ctx, "poll:results");

  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    ward: poll.ward,
    closesAt: iso(poll.closesAt),
    closedAt: iso(poll.closedAt),
    createdAt: iso(poll.createdAt),
    isOpen,
    totalVotes: poll.options.reduce((sum, option) => sum + option.votes, 0),
    myVoteOptionId,
    resultsVisible,
    options: poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
      issue: issueRef(option.issueId),
      votes: resultsVisible ? option.votes : null,
    })),
  };
}

function polls(ctx, data) {
  const t = ctx.now.getTime();
  const [, id, action] = ctx.segments;

  if (ctx.method === "GET" && !id) {
    const { status = "all", wardId } = ctx.params;

    const list = data.polls
      .filter((poll) => {
        if (status === "open") return pollIsOpen(poll, t);
        if (status === "closed") return !pollIsOpen(poll, t);
        return true;
      })
      .filter((poll) => !wardId || poll.ward?.id === wardId)
      .sort(
        (a, b) =>
          Number(pollIsOpen(b, t)) - Number(pollIsOpen(a, t)) ||
          b.createdAt - a.createdAt
      );

    return [200, { polls: list.map((poll) => pollOut(poll, ctx)) }];
  }

  if (ctx.method === "POST" && !id) {
    if (!can(ctx, "poll:manage")) {
      return fail(403, "Only admins can open a Ward Vote");
    }

    const body = ctx.body || {};
    const question = text(body.question);
    const description = text(body.description);
    const closesAt = parseTime(body.closesAt);
    const options = Array.isArray(body.options) ? body.options : [];

    if (!between(question, 8, 160)) {
      return fail(400, "Question must be 8–160 characters", "VALIDATION");
    }
    if (description.length > 600) {
      return fail(400, "Description can be at most 600 characters", "VALIDATION");
    }
    if (closesAt == null || closesAt <= t) {
      return fail(400, "The closing time must be in the future", "VALIDATION");
    }
    if (options.length < 2 || options.length > 6) {
      return fail(400, "A Ward Vote needs 2 to 6 options", "VALIDATION");
    }
    if (options.some((option) => !between(text(option?.label), 1, 80))) {
      return fail(400, "Each option needs a label of up to 80 characters", "VALIDATION");
    }

    const ward = body.wardId ? findWard(body.wardId) : null;

    if (body.wardId && !ward) return fail(404, "Ward not found");

    const pollId = newId("poll");
    const poll = {
      id: pollId,
      question,
      description: description || null,
      ward,
      closesAt,
      closedAt: null,
      createdAt: t,
      options: options.map((option, index) => ({
        id: `${pollId}-opt-${index + 1}`,
        label: text(option.label),
        position: index,
        issueId: issueRef(option.issueId) ? option.issueId : null,
        votes: 0,
      })),
      voters: {},
    };

    data.polls.unshift(poll);

    return [201, { poll: pollOut(poll, ctx) }];
  }

  const poll = id ? data.polls.find((item) => item.id === id) : null;

  if (!poll) return id ? fail(404, "Ward Vote not found") : null;

  if (ctx.method === "GET" && !action) {
    return [200, { poll: pollOut(poll, ctx) }];
  }

  if (ctx.method === "POST" && action === "vote") {
    if (!can(ctx, "poll:vote")) {
      return fail(403, "Only resident accounts can vote");
    }
    if (!pollIsOpen(poll, t)) {
      return fail(400, "This Ward Vote has closed", "POLL_CLOSED");
    }

    const option = poll.options.find((item) => item.id === ctx.body?.optionId);

    if (!option) {
      return fail(400, "That option isn't part of this Ward Vote", "VALIDATION");
    }
    if (poll.voters[ctx.account.id]) {
      return fail(409, "You have already voted in this Ward Vote", "ALREADY_VOTED");
    }

    poll.voters[ctx.account.id] = option.id;
    option.votes += 1;

    return [200, { poll: pollOut(poll, ctx) }];
  }

  if (ctx.method === "POST" && action === "close") {
    if (!can(ctx, "poll:manage")) {
      return fail(403, "Only admins can close a Ward Vote");
    }

    if (pollIsOpen(poll, t)) poll.closedAt = t;

    return [200, { poll: pollOut(poll, ctx) }];
  }

  return null;
}

// ── Cleanup Drives ──────────────────────────────────────────

const UPCOMING_GRACE = 6 * HOUR;

function driveOut(drive, ctx) {
  const viewerId = ctx.account?.id;
  const mine = viewerId
    ? drive.rsvps.find((rsvp) => rsvp.user.id === viewerId)
    : null;

  return {
    id: drive.id,
    title: drive.title,
    description: drive.description,
    startsAt: iso(drive.startsAt),
    capacity: drive.capacity,
    status: drive.status,
    moderationNote: drive.moderationNote,
    address: drive.address,
    latitude: drive.latitude,
    longitude: drive.longitude,
    ward: drive.ward,
    issue: issueRef(drive.issueId),
    organizer: drive.organizer,
    rsvpCount: drive.rsvps.length,
    attendedCount: drive.rsvps.filter((rsvp) => rsvp.attended).length,
    myRsvp: mine ? { attended: mine.attended } : null,
    isOrganizer: !!viewerId && drive.organizer.id === viewerId,
    createdAt: iso(drive.createdAt),
  };
}

function canManageDrive(drive, ctx) {
  return (
    (!!ctx.account && drive.organizer.id === ctx.account.id) ||
    can(ctx, "drive:moderate")
  );
}

function listDrives(ctx, data, t) {
  const { status = "upcoming" } = ctx.params;
  const graceStart = t - UPCOMING_GRACE;
  let list;

  if (status === "upcoming") {
    list = data.drives
      .filter((drive) => drive.status === "APPROVED" && drive.startsAt >= graceStart)
      .sort((a, b) => a.startsAt - b.startsAt);
  } else if (status === "past") {
    list = data.drives
      .filter(
        (drive) =>
          drive.status === "COMPLETED" ||
          (drive.status === "APPROVED" && drive.startsAt < graceStart)
      )
      .sort((a, b) => b.startsAt - a.startsAt);
  } else if (status === "pending") {
    if (!ctx.role) return fail(401, "Sign in to see your drives", "UNAUTHENTICATED");
    if (!can(ctx, "drive:moderate")) {
      return fail(403, "Only moderators can review proposed drives");
    }
    list = data.drives
      .filter((drive) => drive.status === "PROPOSED")
      .sort((a, b) => a.startsAt - b.startsAt);
  } else if (status === "mine") {
    if (!ctx.role) return fail(401, "Sign in to see your drives", "UNAUTHENTICATED");
    list = data.drives
      .filter(
        (drive) =>
          drive.organizer.id === ctx.account.id ||
          drive.rsvps.some((rsvp) => rsvp.user.id === ctx.account.id)
      )
      .sort((a, b) => b.startsAt - a.startsAt);
  } else {
    return fail(400, "Unknown drive filter", "VALIDATION");
  }

  return [200, { drives: list.map((drive) => driveOut(drive, ctx)) }];
}

function proposeDrive(ctx, data, t) {
  if (!can(ctx, "drive:propose")) {
    return fail(403, "Only resident accounts can propose a drive");
  }

  const body = ctx.body || {};
  const title = text(body.title);
  const description = text(body.description);
  const startsAt = parseTime(body.startsAt);
  const capacity = Number(body.capacity);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (!between(title, 4, 100)) {
    return fail(400, "Title must be 4–100 characters", "VALIDATION");
  }
  if (!between(description, 10, 1000)) {
    return fail(400, "Description must be 10–1000 characters", "VALIDATION");
  }
  if (startsAt == null || startsAt < t + 2 * HOUR) {
    return fail(400, "A drive must start at least 2 hours from now", "VALIDATION");
  }
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500) {
    return fail(400, "Capacity must be between 2 and 500", "VALIDATION");
  }
  if (
    body.latitude == null ||
    body.longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return fail(400, "Pick the meeting point on the map", "VALIDATION");
  }

  const ward = body.wardId ? findWard(body.wardId) : null;

  if (body.wardId && !ward) return fail(404, "Ward not found");
  if (body.issueId && !issueRef(body.issueId)) return fail(404, "Issue not found");

  const drive = {
    id: newId("drive"),
    title,
    description,
    startsAt,
    capacity,
    status: "PROPOSED",
    moderationNote: null,
    address: text(body.address) || null,
    latitude,
    longitude,
    ward,
    issueId: body.issueId || null,
    organizer: userRef(ctx.account),
    rsvps: [],
    createdAt: t,
  };

  data.drives.unshift(drive);

  return [201, { drive: driveOut(drive, ctx) }];
}

function rsvp(ctx, drive, t) {
  if (!can(ctx, "drive:join")) {
    return fail(403, "Only resident accounts can join drives");
  }

  const started = drive.startsAt <= t;
  const joined = drive.rsvps.some((item) => item.user.id === ctx.account.id);

  if (ctx.method === "POST") {
    if (drive.status !== "APPROVED" || started) {
      return fail(400, "You can only join an approved drive before it starts");
    }
    if (drive.organizer.id === ctx.account.id) {
      return fail(409, "You are organising this drive");
    }
    if (joined) return fail(409, "You have already joined this drive");
    if (drive.rsvps.length >= drive.capacity) {
      return fail(409, "This drive is full");
    }

    drive.rsvps.push({ user: userRef(ctx.account), attended: false, createdAt: t });

    return [200, { drive: driveOut(drive, ctx) }];
  }

  if (drive.status !== "APPROVED" || started) {
    return fail(400, "You can only leave a drive before it starts");
  }
  if (!joined) return fail(404, "You haven't joined this drive");

  drive.rsvps = drive.rsvps.filter((item) => item.user.id !== ctx.account.id);

  return [200, { drive: driveOut(drive, ctx) }];
}

function drives(ctx, data) {
  const t = ctx.now.getTime();
  const [, id, action] = ctx.segments;

  if (!id) {
    if (ctx.method === "GET") return listDrives(ctx, data, t);
    if (ctx.method === "POST") return proposeDrive(ctx, data, t);
    return null;
  }

  const drive = data.drives.find((item) => item.id === id);
  const hidden =
    drive &&
    (drive.status === "PROPOSED" || drive.status === "REJECTED") &&
    !canManageDrive(drive, ctx);

  if (!drive || hidden) return fail(404, "Drive not found");

  if (ctx.method === "GET" && !action) {
    const payload = { drive: driveOut(drive, ctx) };

    if (canManageDrive(drive, ctx)) {
      payload.rsvps = drive.rsvps.map((item) => ({
        user: item.user,
        attended: item.attended,
      }));
    }

    return [200, payload];
  }

  if (action === "rsvp" && (ctx.method === "POST" || ctx.method === "DELETE")) {
    return rsvp(ctx, drive, t);
  }

  if (ctx.method === "POST" && action === "moderate") {
    if (!can(ctx, "drive:moderate")) {
      return fail(403, "Only moderators can review proposed drives");
    }
    if (drive.status !== "PROPOSED") {
      return fail(409, "This drive has already been moderated");
    }

    const decision = ctx.body?.decision;

    if (decision !== "APPROVE" && decision !== "REJECT") {
      return fail(400, "Decision must be APPROVE or REJECT", "VALIDATION");
    }

    if (decision === "APPROVE" && drive.startsAt <= t) {
      return fail(400, "This drive's start time has passed, so it can only be rejected");
    }
    if (text(ctx.body?.note).length > 500) {
      return fail(400, "Keep the note under 500 characters", "VALIDATION");
    }

    drive.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    drive.moderationNote = text(ctx.body?.note) || null;

    return [200, { drive: driveOut(drive, ctx) }];
  }

  if (ctx.method === "POST" && action === "attendance") {
    if (!canManageDrive(drive, ctx)) {
      return fail(403, "Only the organiser or a moderator can record attendance");
    }
    if (drive.status !== "APPROVED" && drive.status !== "COMPLETED") {
      return fail(400, "Attendance can only be recorded for an approved drive");
    }
    if (drive.startsAt > t) {
      return fail(400, "Attendance opens once the drive has started");
    }

    const userIds = Array.isArray(ctx.body?.userIds) ? ctx.body.userIds : [];
    const rsvped = new Set(drive.rsvps.map((item) => item.user.id));

    if (userIds.some((userId) => !rsvped.has(userId))) {
      return fail(400, "Only people who RSVP'd can be marked as attending");
    }

    drive.rsvps.forEach((item) => {
      if (userIds.includes(item.user.id)) item.attended = true;
    });
    drive.status = "COMPLETED";

    return [200, { drive: driveOut(drive, ctx) }];
  }

  return null;
}

// ── Entry point ─────────────────────────────────────────────

const ROOTS = ["bulletins", "watch-zones", "polls", "drives"];

export function handleCommunity(ctx) {
  const [root] = ctx.segments;

  if (!ROOTS.includes(root)) return null;

  const data = db(ctx.now);

  if (root === "bulletins") return bulletins(ctx, data);
  if (root === "watch-zones") return watchZones(ctx, data);
  if (root === "polls") return polls(ctx, data);

  return drives(ctx, data);
}
