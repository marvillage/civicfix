import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const FEATURES = [
  {
    icon: "📸",
    title: "Snap it, send it",
    text: "Photograph the problem, add a voice note if you're in a hurry, and your GPS pins the exact spot. Thirty seconds, done.",
  },
  {
    icon: "🤖",
    title: "AI sorts it out",
    text: "The photo is classified automatically — pothole, streetlight, garbage — and routed to the right municipal department.",
  },
  {
    icon: "🗺️",
    title: "Everything on the map",
    text: "Every open issue in the city, live on a map with hotspot view. See what's broken around you and upvote what matters.",
  },
  {
    icon: "⏱️",
    title: "Deadlines that bite",
    text: "Every issue gets an SLA clock. Miss it and the issue auto-escalates up the chain — no report quietly dies in a drawer.",
  },
  {
    icon: "✅",
    title: "You verify the fix",
    text: "Authorities upload proof-of-work photos, and nothing closes until the citizen who reported it confirms it's actually fixed.",
  },
  {
    icon: "🏆",
    title: "Civic points & badges",
    text: "Earn points for every report and verified fix. Climb the ward leaderboard and unlock achievement badges.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Report",
    text: "Photo + location. With or without an account.",
  },
  {
    step: "2",
    title: "Assigned",
    text: "Routed to the right department and officer, on a deadline.",
  },
  {
    step: "3",
    title: "Fixed",
    text: "Track progress updates and proof photos live.",
  },
  {
    step: "4",
    title: "Verified",
    text: "You confirm the fix — or reopen it with one tap.",
  },
];

function CountUp({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      setDisplay(value);
      return;
    }

    const start = performance.now();

    function step(now) {
      const t = Math.min(1, (now - start) / 1500);
      const eased = 1 - Math.pow(1 - t, 3);

      setDisplay(Math.round(value * eased));

      if (t < 1) {
        frame.current = requestAnimationFrame(step);
      }
    }

    frame.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame.current);
  }, [value]);

  return (
    <strong>
      {display.toLocaleString("en-IN")}
      {suffix}
    </strong>
  );
}

export default function Landing() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api
      .get("/dashboard/public-stats")
      .then((response) =>
        setStats(response.data.stats)
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(
      ".landing-page .reveal"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    elements.forEach((element) =>
      observer.observe(element)
    );

    return () => observer.disconnect();
  }, [stats]);

  return (
    <div className="landing-page">
      <section className="landing-cinema">
        <div className="landing-cinema-bg" />

        <header className="landing-nav landing-nav-cinema">
          <div className="landing-nav-inner">
            <div className="landing-brand">
              <img
                className="brand-icon"
                src="/images/logo-icon.png"
                alt=""
              />
              CivicFix
            </div>

            <nav className="landing-links">
              <Link to="/issues">Browse issues</Link>
              <Link to="/stats">Transparency</Link>
              <Link to="/report">
                Report anonymously
              </Link>
            </nav>

            <div className="landing-nav-actions">
              <Link to="/login">
                <button
                  type="button"
                  className="secondary-button cinema-ghost"
                >
                  Log in
                </button>
              </Link>

              <Link to="/register">
                <button type="button">Sign up</button>
              </Link>
            </div>
          </div>
        </header>

        <div className="landing-cinema-content">
          <div className="cinema-copy-card">
          <p className="eyebrow">
            CIVIC ISSUE REPORTING FOR YOUR CITY
          </p>

          <h1>
            The pothole outside your house?
            It's the city's problem now.
          </h1>

          <p className="cinema-sub">
            CivicFix turns a photo into a tracked,
            deadlined work order for your municipal
            authority — and doesn't let it close
            until you confirm the fix.
          </p>

          <div className="landing-actions">
            <Link to="/register">
              <button type="button">
                Report your first issue
              </button>
            </Link>

            <Link to="/issues">
              <button
                type="button"
                className="secondary-button cinema-ghost"
              >
                See what's broken nearby
              </button>
            </Link>
          </div>

          <p className="landing-anon cinema-anon">
            No account?{" "}
            <Link to="/report" className="text-link">
              Report anonymously
            </Link>{" "}
            in under a minute.
          </p>
          </div>
        </div>

        {stats && stats.total > 0 && (
          <div className="landing-glass-stats">
            <div>
              <CountUp value={stats.total} />
              <span>issues reported</span>
            </div>

            <div>
              <CountUp value={stats.resolved} />
              <span>fixed &amp; verified</span>
            </div>

            <div>
              <CountUp value={stats.open} />
              <span>currently in progress</span>
            </div>

            {stats.avgResolutionHours != null && (
              <div>
                <CountUp
                  value={stats.avgResolutionHours}
                  suffix="h"
                />
                <span>average time to fix</span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="landing-section reveal">
        <div className="landing-section-inner">
          <p className="eyebrow">WHY CIVICFIX</p>

          <h2>
            Complaints disappear. Work orders don't.
          </h2>

          <div className="landing-features">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="landing-feature"
              >
                <span className="landing-feature-icon">
                  {feature.icon}
                </span>

                <h3>{feature.title}</h3>

                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-split landing-split-reverse reveal">
        <div className="landing-section-inner landing-split-inner">
          <div>
            <p className="eyebrow">THE APP</p>

            <h2>Thirty seconds from photo to filed</h2>

            <p>
              Point, shoot, submit. GPS pins the spot,
              the address fills itself in, and a voice
              note replaces typing when you're standing
              on a busy road. In a real hurry? Skip the
              account entirely.
            </p>

            <Link to="/report" className="text-link">
              Try it without signing up →
            </Link>
          </div>

          <img
            src="/images/app-shot.png"
            alt="A hand holding a phone with a submitted civic report"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        </div>
      </section>

      <section className="landing-section landing-split reveal">
        <div className="landing-section-inner landing-split-inner">
          <img
            src="/images/ward-map.png"
            alt="Illustrated city ward with issue markers"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />

          <div>
            <p className="eyebrow">TRANSPARENCY</p>

            <h2>
              Every ward gets a public report card
            </h2>

            <p>
              Resolution rates, SLA compliance, and
              average fix times — visible to everyone,
              no login needed. Accountability works
              best in daylight.
            </p>

            <Link to="/stats" className="text-link">
              See your city's numbers →
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section reveal">
        <div className="landing-section-inner">
          <p className="eyebrow">HOW IT WORKS</p>

          <h2>From photo to fixed, in four steps</h2>

          <div className="landing-steps">
            {STEPS.map((item) => (
              <div
                key={item.step}
                className="landing-step"
              >
                <span className="landing-step-number">
                  {item.step}
                </span>

                <h3>{item.title}</h3>

                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-split landing-split-reverse reveal">
        <div className="landing-section-inner landing-split-inner">
          <div>
            <p className="eyebrow">PROOF OF WORK</p>

            <h2>Before and after, or it didn't happen</h2>

            <p>
              Authorities attach a photo of the
              completed work, shown next to your
              original report. If the fix doesn't
              hold, reopen it — issues reopened
              repeatedly get flagged as chronic and
              pushed up the chain.
            </p>

            <Link
              to="/register"
              className="text-link"
            >
              Join your neighbours on CivicFix →
            </Link>
          </div>

          <img
            src="/images/resolved-road.png"
            alt="A broken road before and after repair"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        </div>
      </section>

      <section className="landing-section landing-split reveal">
        <div className="landing-section-inner landing-split-inner">
          <img
            src="/images/community.png"
            alt="Neighbours celebrating a repaired street"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />

          <div>
            <p className="eyebrow">COMMUNITY</p>

            <h2>
              Fixing a city is a team sport
            </h2>

            <p>
              Upvote what matters and get notified as
              it moves. Earn civic points and badges
              for every report and verified fix, and
              climb your ward's leaderboard. One
              pothole report is a complaint — fifty
              upvotes is a mandate.
            </p>

            <Link to="/register" className="text-link">
              Start earning civic points →
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section landing-split-reverse landing-split reveal">
        <div className="landing-section-inner landing-split-inner">
          <div>
            <p className="eyebrow">FOR THE FIXERS</p>

            <h2>
              A control room for the people who do
              the work
            </h2>

            <p>
              Authorities get an urgency-sorted work
              queue with live SLA countdowns, field
              survey mode, and progress updates.
              Admins get analytics, ward report
              cards, chronic-issue detection, and a
              full audit trail. Everyone is
              accountable — including the platform.
            </p>

            <Link to="/login" className="text-link">
              Authority or admin? Log in →
            </Link>
          </div>

          <img
            src="/images/control-room.png"
            alt="A municipal control room with a live issue map"
            onError={(event) => {
              event.currentTarget.style.display =
                "none";
            }}
          />
        </div>
      </section>

      <section className="landing-cta reveal">
        <div className="landing-cta-inner">
          <h2>
            Your street won't fix itself.
          </h2>

          <p>
            Join CivicFix and turn frustration into a
            tracked, deadlined, verifiable fix.
          </p>

          <div className="landing-actions">
            <Link to="/register">
              <button type="button">
                Create a free account
              </button>
            </Link>

            <Link to="/report">
              <button
                type="button"
                className="secondary-button"
              >
                Report without one
              </button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span>
            CivicFix — civic issues, tracked to the
            finish.
          </span>

          <nav>
            <Link to="/issues">Public issues</Link>
            <Link to="/stats">Transparency</Link>
            <Link to="/login">Log in</Link>
            <Link to="/register">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
