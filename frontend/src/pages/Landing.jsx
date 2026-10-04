import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  Copy,
  ClipboardList,
  Gauge,
  HandHeart,
  HardHat,
  LayoutDashboard,
  LocateFixed,
  Megaphone,
  MessagesSquare,
  Radar,
  ReceiptIndianRupee,
  Route,
  ScrollText,
  Siren,
  Sparkles,
  ThumbsUp,
  Timer,
  Vote,
  Waypoints,
  Workflow,
} from "lucide-react";
import api from "../api/axios";
import { BRAND, FEATURES } from "../brand";
import { useAuth } from "../context/auth";
import { PublicHeader, SiteFooter } from "../components/layout/PublicShell";
import { BarList, ChartFrame } from "../components/charts";
import { CATEGORY_META } from "../lib/labels";
import { formatHours, formatNumber } from "../lib/format";

const STEPS = [
  {
    icon: Camera,
    name: FEATURES.snapSend,
    text: `Photo, pin and an optional voice note. No account? ${FEATURES.quickDrop} takes thirty seconds.`,
  },
  {
    icon: Sparkles,
    name: FEATURES.autoSort,
    text: `Reads the photo, sets category and severity, and routes it to the right department. ${FEATURES.echoCheck} folds in repeat reports.`,
  },
  {
    icon: Timer,
    name: FEATURES.fixClock,
    text: "Every case gets a deadline set by severity. Miss it and the case escalates up the chain on its own.",
  },
  {
    icon: BadgeCheck,
    name: FEATURES.signOff,
    text: "The crew posts proof photos. The case closes only when you sign it off, or you reopen it in one tap.",
  },
];

const NEW_FEATURES = [
  {
    icon: Activity,
    name: FEATURES.pulse,
    text: "Live graphs of what's reported, fixed and late, with Ward Scorecards grading every ward from A to F.",
    to: "/pulse",
    cta: "See the numbers",
  },
  {
    icon: Megaphone,
    name: FEATURES.bulletins,
    text: "Water cuts, roadworks and advisories, posted by the people running them and pinned to your ward.",
    to: "/bulletins",
    cta: "Read bulletins",
  },
  {
    icon: LocateFixed,
    name: FEATURES.watchZones,
    text: "Draw a circle around home, school or the office. Get a ping the moment a new case lands inside it.",
    to: "/watch-zones",
    guestTo: "/register",
    cta: "Set a zone",
  },
  {
    icon: Vote,
    name: FEATURES.wardVote,
    text: "Help decide which repair your ward tackles first. Results open up once you've cast your vote.",
    to: "/polls",
    cta: "Vote now",
  },
  {
    icon: HandHeart,
    name: FEATURES.drives,
    text: "Propose a Saturday cleanup, gather neighbours, and log who turned up. Everyone who shows earns Civic Cred.",
    to: "/drives",
    cta: "Find a drive",
  },
  {
    icon: ReceiptIndianRupee,
    name: FEATURES.costLedger,
    text: "Every rupee spent on a fix (materials, labour, contractors) logged against the case and totalled in public.",
    to: "/pulse",
    cta: "Follow the money",
  },
];

const CREW_TOOLS = [
  { icon: ClipboardList, name: FEATURES.crewQueue },
  { icon: Waypoints, name: FEATURES.routeMap },
  { icon: Workflow, name: FEATURES.jobFlow },
  { icon: Camera, name: FEATURES.siteUpdates },
  { icon: HardHat, name: FEATURES.patrolLog },
  { icon: Gauge, name: FEATURES.scorecard },
  { icon: LayoutDashboard, name: FEATURES.commandDeck },
  { icon: Route, name: FEATURES.dispatch },
  { icon: ScrollText, name: FEATURES.paperTrail },
];

function gradeTone(grade = "") {
  if (["A", "B"].includes(grade)) return "good";
  if (grade === "C") return "warn";
  return "bad";
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Counts up to `value` once, eased; jumps straight there when the
// visitor prefers reduced motion.
function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;

    if (prefersReducedMotion()) {
      frame.current = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(frame.current);
    }

    const start = performance.now();

    function step(now) {
      const t = Math.min(1, (now - start) / 1400);
      const eased = 1 - Math.pow(1 - t, 3);

      setDisplay(Math.round(target * eased));

      if (t < 1) frame.current = requestAnimationFrame(step);
    }

    frame.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame.current);
  }, [value]);

  return (
    <>
      <span aria-hidden="true">{formatNumber(display)}</span>
      <span className="sr-only">{formatNumber(value)}</span>
    </>
  );
}

function LpHead({ id, eyebrow, title, lede, center = false }) {
  return (
    <div className={`lp-head ${center ? "is-center" : ""}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {lede && <p className="lp-lede">{lede}</p>}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, homePath, can } = useAuth();
  const [stats, setStats] = useState(null);
  const [scrolled, setScrolled] = useState(
    () => typeof window !== "undefined" && window.scrollY > 24
  );

  useEffect(() => {
    api
      .get("/dashboard/public-stats")
      .then((response) => setStats(response.data.stats ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const reportPath = can("issue:report") ? "/citizen/report" : "/report";

  const categoryRows = (stats?.byCategory ?? [])
    .map((row) => {
      const meta = CATEGORY_META[row.category] ?? CATEGORY_META.OTHER;
      const Icon = meta.icon;

      return {
        key: row.category,
        label: meta.label,
        value: row.count,
        color: meta.series,
        icon: <Icon aria-hidden="true" />,
      };
    })
    .sort((a, b) => b.value - a.value);

  const wards = [...(stats?.wards ?? [])]
    .sort((a, b) => (b.totalIssues ?? 0) - (a.totalIssues ?? 0))
    .slice(0, 4);

  return (
    <div className={`landing ${scrolled ? "is-scrolled" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <PublicHeader variant="overlay" />

      <main id="main" tabIndex={-1}>
        {/* ── Hero ─────────────────────────────────── */}
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker">
                <span className="lp-kicker-dot" aria-hidden="true" />
                Public works, tracked in public
              </p>

              <h1 id="lp-title">
                Fixes that <span className="lp-mark">stay fixed.</span>
              </h1>

              <p className="lp-hero-lede">{BRAND.pitch}</p>

              <div className="lp-hero-actions">
                <Link to={reportPath} className="btn btn-accent btn-lg">
                  <Camera aria-hidden="true" />
                  Report an issue
                </Link>

                {isAuthenticated ? (
                  <Link to={homePath} className="btn btn-lg lp-btn-line">
                    Go to your workspace
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ) : (
                  <Link to="/issues" className="btn btn-lg lp-btn-line">
                    <Radar aria-hidden="true" />
                    Open {FEATURES.radar}
                  </Link>
                )}
              </div>

              <ul className="lp-hero-proof">
                <li>
                  <Check aria-hidden="true" />
                  No account needed
                </li>
                <li>
                  <Check aria-hidden="true" />
                  A deadline on every case
                </li>
                <li>
                  <Check aria-hidden="true" />
                  Closed only on your {FEATURES.signOff}
                </li>
              </ul>
            </div>

            <div className="lp-hero-art">
              <div className="lp-hero-frame">
                <img
                  src="/images/hero-street.png"
                  alt="A resident photographs a pothole on a busy street while a municipal officer takes notes nearby"
                  fetchPriority="high"
                />
                <span className="lp-hero-tape" aria-hidden="true" />
              </div>

              <div className="lp-float lp-float-case" aria-hidden="true">
                <div className="lp-float-row">
                  <span className="category-chip">
                    <span className="cat-dot cat-ROAD_DAMAGE" />
                    Roads
                  </span>
                  <span className="status-badge status-in-progress">
                    In progress
                  </span>
                </div>
                <strong>Pothole outside Gandhi Market</strong>
                <div className="lp-float-clock">
                  <span>
                    <Timer />
                    {FEATURES.fixClock}
                  </span>
                  <span>18 h left</span>
                </div>
                <div className="meter">
                  <span style={{ width: "62%" }} />
                </div>
                <div className="lp-float-foot">
                  <ThumbsUp />
                  24 backers
                </div>
              </div>

              <div className="lp-float lp-float-signed" aria-hidden="true">
                <span className="lp-float-check">
                  <BadgeCheck />
                </span>
                <span>
                  <strong>Signed off</strong>
                  <small>Fixed in 2.5 days</small>
                </span>
              </div>
            </div>
          </div>

          <div className="lp-wrap">
            <dl className={`lp-stats ${stats ? "" : "is-loading"}`} aria-live="polite">
              <div>
                <dt>Cases reported</dt>
                <dd>{stats ? <CountUp value={stats.total} /> : "—"}</dd>
              </div>
              <div>
                <dt>Fixed and signed off</dt>
                <dd>{stats ? <CountUp value={stats.resolved} /> : "—"}</dd>
              </div>
              <div>
                <dt>Open right now</dt>
                <dd>{stats ? <CountUp value={stats.open} /> : "—"}</dd>
              </div>
              <div>
                <dt>Average time to fix</dt>
                <dd>{stats ? formatHours(stats.avgResolutionHours) : "—"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="lp-stripe" aria-hidden="true" />

        {/* ── How it works ─────────────────────────── */}
        <section className="lp-section" aria-labelledby="lp-how">
          <div className="lp-wrap">
            <div className="lp-head is-center">
              <p className="eyebrow">How it works</p>
              <h2 id="lp-how">From pothole to signed off, in four moves</h2>
              <p className="lp-lede">
                A complaint can sit in a drawer. A {BRAND.name} case can't: it
                has an owner, a deadline and an audience from the first photo.
              </p>
            </div>

            <ol className="lp-road">
              {STEPS.map(({ icon: Icon, name, text }, index) => (
                <li key={name} className="lp-road-step">
                  <span className="lp-sign" aria-hidden="true">
                    <span>{index + 1}</span>
                  </span>
                  <div className="lp-road-card">
                    <span className="lp-road-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <h3>{name}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Feature bento ────────────────────────── */}
        <section className="lp-section lp-section-alt" aria-labelledby="lp-tools">
          <div className="lp-wrap">
            <div className="lp-head">
              <p className="eyebrow">Built for the street</p>
              <h2 id="lp-tools">Everything a fix needs, nothing a fix doesn't</h2>
            </div>

            <div className="lp-bento">
              <Link to="/issues" className="lp-tile lp-tile-radar">
                <img
                  src="/images/ward-map.png"
                  alt="Illustrated ward with pins for a pothole, a dead streetlight, garbage, a leak and a blocked drain"
                  loading="lazy"
                />
                <div className="lp-tile-body">
                  <span className="lp-tile-tag">
                    <Radar aria-hidden="true" />
                    {FEATURES.radar}
                  </span>
                  <h3>See every open case on one live map</h3>
                  <p>
                    Switch between list, map and hotspots, filter by category,
                    or tap Near me for what's broken on your street.
                  </p>
                  <span className="lp-tile-link">
                    Open {FEATURES.radar}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </div>
              </Link>

              <Link to="/report" className="lp-tile lp-tile-snap">
                <img
                  src="/images/report-dusk.png"
                  alt="Hands framing a broken streetlight in a phone camera at dusk, with a location pin on screen"
                  loading="lazy"
                />
                <div className="lp-tile-body">
                  <span className="lp-tile-tag">
                    <Camera aria-hidden="true" />
                    {FEATURES.snapSend} · {FEATURES.quickDrop}
                  </span>
                  <h3>Thirty seconds from photo to filed</h3>
                  <p>
                    GPS pins the spot, the address fills itself in, and a voice
                    note beats typing on a busy road.
                  </p>
                  <span className="lp-tile-link">
                    Try {FEATURES.quickDrop}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </div>
              </Link>

              <div className="lp-tile lp-tile-mini">
                <span className="lp-mini-icon" aria-hidden="true">
                  <Copy />
                </span>
                <h3>{FEATURES.echoCheck}</h3>
                <p>
                  Same pothole, five reports? They merge into one case with
                  five voices, so crews fix it once.
                </p>
              </div>

              <div className="lp-tile lp-tile-mini">
                <span className="lp-mini-icon" aria-hidden="true">
                  <ThumbsUp />
                </span>
                <h3>{FEATURES.backIt}</h3>
                <p>
                  One report is a complaint; fifty backers is a mandate. Back a
                  case to push it up the queue and follow every update.
                </p>
              </div>

              <div className="lp-tile lp-tile-mini lp-tile-alert">
                <span className="lp-mini-icon" aria-hidden="true">
                  <Siren />
                </span>
                <h3>{FEATURES.redAlert}</h3>
                <p>
                  Open manhole or live wire? Flag it. It skips the queue, alerts
                  every admin and runs on a short clock.
                </p>
              </div>

              <div className="lp-tile lp-tile-proof">
                <img
                  src="/images/resolved-road.png"
                  alt="The same road before repair, cracked and flooded, and after, freshly surfaced with a crew member giving a thumbs up"
                  loading="lazy"
                />
                <div className="lp-tile-body">
                  <span className="lp-tile-tag">
                    <BadgeCheck aria-hidden="true" />
                    {FEATURES.signOff}
                  </span>
                  <h3>Before and after, or it didn't happen</h3>
                  <p>
                    Crews attach proof-of-work photos next to your original
                    report. If the fix doesn't hold, reopen it; cases that keep
                    failing are flagged as {FEATURES.repeatOffenders}.
                  </p>
                </div>
              </div>

              <div className="lp-tile lp-tile-talk">
                <span className="lp-mini-icon" aria-hidden="true">
                  <MessagesSquare />
                </span>
                <h3>
                  {FEATURES.streetTalk} &amp; {FEATURES.directLine}
                </h3>
                <p>
                  Talk it out in public under the case, or message the assigned
                  officer privately about gate codes and directions.
                </p>
                <div className="lp-chat" aria-hidden="true">
                  <span className="lp-bubble">
                    Is the lane closed during work?
                  </span>
                  <span className="lp-bubble is-crew">
                    Only the left lane, 10 am to 4 pm.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── New in Fixity ────────────────────────── */}
        <section className="lp-new" aria-labelledby="lp-new">
          <div className="lp-wrap">
            <div className="lp-head lp-head-dark">
              <p className="lp-new-chip">New in {BRAND.name}</p>
              <h2 id="lp-new">More than a complaint box</h2>
              <p className="lp-lede">
                Six new ways to see your city clearly, plan around it and pitch
                in.
              </p>
            </div>

            <ul className="lp-new-grid">
              {NEW_FEATURES.map(({ icon: Icon, name, text, to, guestTo, cta }) => (
                <li key={name}>
                  <Link
                    to={!isAuthenticated && guestTo ? guestTo : to}
                    className="lp-new-card"
                  >
                    <span className="lp-new-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <h3>{name}</h3>
                    <p>{text}</p>
                    <span className="lp-new-link">
                      {cta}
                      <ArrowRight aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Live scorecards ──────────────────────── */}
        <section className="lp-section" aria-labelledby="lp-pulse">
          <div className="lp-wrap">
            <div className="lp-pulse-top">
              <LpHead
                id="lp-pulse"
                eyebrow={`${FEATURES.pulse} · live`}
                title="Every ward gets a grade"
                lede={`Resolution rates and ${FEATURES.fixClock} records, published for everyone. No login, no RTI request, no spin.`}
              />

              <Link to="/pulse" className="btn btn-lg">
                <Activity aria-hidden="true" />
                Open {FEATURES.pulse}
              </Link>
            </div>

            <div
              className={`lp-pulse-grid ${categoryRows.length ? "" : "is-single"}`}
            >
              {categoryRows.length > 0 && (
                <ChartFrame
                  title="What gets reported"
                  subtitle="All cases, by category"
                  className="lp-pulse-chart"
                  table={{
                    columns: [
                      { key: "label", label: "Category" },
                      { key: "value", label: "Cases", numeric: true },
                    ],
                    rows: categoryRows,
                  }}
                >
                  <BarList data={categoryRows} />
                </ChartFrame>
              )}

            <div className="lp-grades">
              {wards.length === 0 ? (
                <div className="lp-grades-empty">
                  <Activity aria-hidden="true" />
                  <p>
                    Ward Scorecards appear here as soon as the first cases are
                    filed.
                  </p>
                </div>
              ) : (
                wards.map((ward) => (
                  <Link
                    key={ward.id ?? ward.name}
                    to="/pulse"
                    className="lp-grade-card"
                  >
                    <span
                      className={`lp-grade lp-grade-${gradeTone(ward.grade)}`}
                      aria-label={`Grade ${ward.grade ?? "not rated"}`}
                    >
                      {ward.grade ?? "–"}
                    </span>

                    <span className="lp-grade-body">
                      <strong>{ward.name}</strong>
                      <span className="lp-grade-sub">
                        {ward.code ? `${ward.code} · ` : ""}
                        {formatNumber(ward.totalIssues ?? 0)} cases
                      </span>

                      <span className="lp-grade-meter">
                        <span>Resolved</span>
                        <span className="meter">
                          <span style={{ width: `${ward.resolutionRate ?? 0}%` }} />
                        </span>
                        <b>{Math.round(ward.resolutionRate ?? 0)}%</b>
                      </span>

                      <span className="lp-grade-meter">
                        <span>On time</span>
                        <span className="meter">
                          <span style={{ width: `${ward.slaCompliance ?? 0}%` }} />
                        </span>
                        <b>{Math.round(ward.slaCompliance ?? 0)}%</b>
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
            </div>
          </div>
        </section>

        {/* ── For crews ────────────────────────────── */}
        <section className="lp-section lp-section-alt" aria-labelledby="lp-crews">
          <div className="lp-wrap lp-split">
            <div className="lp-split-art">
              <img
                src="/images/control-room.png"
                alt="An officer in a hi-vis vest studies a wall-sized city map with live case pins in a municipal control room"
                loading="lazy"
              />
            </div>

            <div className="lp-split-copy">
              <LpHead
                id="lp-crews"
                eyebrow="For officers and admins"
                title="A control room for the people who do the work"
                lede="Officers get an urgency-sorted queue with live deadlines and a map of the day's jobs. Admins get dispatch, deadlines, routing rules and a full audit trail. Everyone is accountable, including the platform."
              />

              <ul className="lp-tools">
                {CREW_TOOLS.map(({ icon: Icon, name }) => (
                  <li key={name}>
                    <Icon aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>

              <div className="lp-split-actions">
                <Link to="/register/authority" className="btn btn-secondary">
                  <HardHat aria-hidden="true" />
                  Officer sign-up
                </Link>
                <Link to="/login" className="btn btn-ghost">
                  Staff log in
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final call ───────────────────────────── */}
        <section className="lp-section lp-final-wrap" aria-labelledby="lp-final">
          <div className="lp-wrap">
            <div className="lp-final">
              <div className="lp-final-art">
                <img
                  src="/images/community.png"
                  alt="Neighbours of all ages smiling on a newly repaired, well-lit street, one holding up a phone"
                  loading="lazy"
                />
              </div>

              <div className="lp-final-copy">
                <span className="lp-final-stripe" aria-hidden="true" />
                <h2 id="lp-final">Your street won't fix itself.</h2>
                <p>
                  Report, back, vote and show up. Every verified fix earns{" "}
                  {FEATURES.civicCred}, and every case stays public until it's
                  done.
                </p>

                <div className="lp-final-actions">
                  {isAuthenticated ? (
                    <Link to={homePath} className="btn btn-lg lp-btn-navy">
                      Go to your workspace
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : (
                    <Link to="/register" className="btn btn-lg lp-btn-navy">
                      Create a free account
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  )}
                  <Link to="/report" className="btn btn-lg lp-btn-navy-line">
                    Report without one
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
