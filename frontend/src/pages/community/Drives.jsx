import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Award, HandHeart, Plus, ShieldCheck, Users } from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { EmptyState, Loading, PageHeader } from "../../components/ui";
import DriveCard from "../../components/community/DriveCard";
import { apiMessage, useNow } from "../../components/community/helpers";

const EMPTY = {
  upcoming: {
    title: "No drives on the calendar",
    text: "Pick a street that needs a hand and propose one. Approved drives show up here.",
  },
  past: {
    title: "No past drives yet",
    text: "Finished drives and their turnout land here.",
  },
  mine: {
    title: "You haven't joined a drive yet",
    text: "Join one from Upcoming, or propose your own.",
  },
  pending: {
    title: "Nothing waiting for review",
    text: "New proposals from residents appear here for approval.",
  },
};

export default function Drives() {
  const { can, isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const now = useNow();

  const tabs = [
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past" },
    ...(isAuthenticated ? [{ value: "mine", label: "Mine" }] : []),
    ...(can("drive:moderate")
      ? [{ value: "pending", label: "Pending review", icon: ShieldCheck }]
      : []),
  ];

  const tabParam = searchParams.get("tab");
  const tab = tabs.some((item) => item.value === tabParam) ? tabParam : "upcoming";

  // The list remembers which tab it answers; loading is derived.
  const [result, setResult] = useState({ tab: null, list: [], error: "" });
  const [pendingCount, setPendingCount] = useState(null);
  const canModerate = can("drive:moderate");

  useEffect(() => {
    let active = true;

    api
      .get("/drives", { params: { status: tab } })
      .then((response) => {
        if (!active) return;

        const list = response.data.drives || [];
        setResult({ tab, list, error: "" });
        if (tab === "pending") setPendingCount(list.length);
      })
      .catch((fetchError) => {
        if (active) {
          setResult({
            tab,
            list: [],
            error: apiMessage(fetchError, "Couldn't load drives."),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [tab]);

  const loading = result.tab !== tab;
  const drives = result.list;
  const error = loading ? "" : result.error;

  // Moderators see how many proposals are waiting on the tab.
  useEffect(() => {
    if (!canModerate) return undefined;

    let active = true;

    api
      .get("/drives", { params: { status: "pending" } })
      .then((response) => {
        if (active) setPendingCount((response.data.drives || []).length);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [canModerate]);

  const empty = EMPTY[tab];

  return (
    <div className="page drives-page">
      <PageHeader
        eyebrow={FEATURES.drives}
        title="Pick a street. Bring gloves."
        description="Volunteer clean-ups organised by residents and checked by the city. Turn up, get marked present, earn +15 Civic Cred."
        actions={
          can("drive:propose") ? (
            <Link to="/drives/new" className="btn btn-accent">
              <Plus aria-hidden="true" />
              Propose a drive
            </Link>
          ) : !isAuthenticated ? (
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="btn btn-ghost"
            >
              <HandHeart aria-hidden="true" />
              Log in to join or propose
            </Link>
          ) : null
        }
      />

      <nav className="tabs feature-tabs" aria-label="Drive lists">
        {tabs.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.value}
              to={`?tab=${item.value}`}
              replace
              className={`tab ${tab === item.value ? "is-active" : ""}`}
              aria-current={tab === item.value ? "page" : undefined}
            >
              {Icon && <Icon aria-hidden="true" />}
              {item.label}
              {item.value === "pending" && pendingCount > 0 && (
                <span className="tab-count">{pendingCount}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {tab === "pending" && !loading && drives.length > 0 && (
        <p className="form-info">
          Open a proposal to approve it or send it back with a note. The
          organiser is notified either way.
        </p>
      )}

      {loading ? (
        <Loading label="Loading drives…" />
      ) : drives.length === 0 ? (
        <EmptyState
          icon={HandHeart}
          title={empty.title}
          action={
            can("drive:propose") && tab !== "pending" ? (
              <Link to="/drives/new" className="btn btn-accent">
                <Plus aria-hidden="true" />
                Propose a drive
              </Link>
            ) : null
          }
        >
          {empty.text}
        </EmptyState>
      ) : (
        <section className="drive-grid" aria-label={`${tabs.find((t) => t.value === tab)?.label} drives`}>
          {drives.map((drive) => (
            <DriveCard key={drive.id} drive={drive} now={now} />
          ))}
        </section>
      )}

      <section className="drive-how" aria-labelledby="drive-how-title">
        <h2 id="drive-how-title" className="sr-only">
          How Cleanup Drives work
        </h2>
        <ol className="drive-steps">
          <li>
            <span className="drive-step-icon" aria-hidden="true">
              <Plus />
            </span>
            <strong>Propose</strong>
            <span>Pick a spot, a time at least two hours out, and how many hands you need.</span>
          </li>
          <li>
            <span className="drive-step-icon" aria-hidden="true">
              <ShieldCheck />
            </span>
            <strong>City checks it</strong>
            <span>A moderator approves it, so nobody turns up to a live work site.</span>
          </li>
          <li>
            <span className="drive-step-icon" aria-hidden="true">
              <Users />
            </span>
            <strong>Neighbours join</strong>
            <span>Residents RSVP until it's full or the drive starts.</span>
          </li>
          <li>
            <span className="drive-step-icon" aria-hidden="true">
              <Award />
            </span>
            <strong>Earn {FEATURES.civicCred}</strong>
            <span>+15 for every attendee the organiser marks present, +25 for organising.</span>
          </li>
        </ol>
      </section>
    </div>
  );
}
