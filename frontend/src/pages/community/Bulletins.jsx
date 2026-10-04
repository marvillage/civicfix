import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { BellRing, Megaphone, Plus, RotateCcw } from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import {
  EmptyState,
  Loading,
  PageHeader,
} from "../../components/ui";
import BulletinCard, { KindChip } from "../../components/community/BulletinCard";
import BulletinForm from "../../components/community/BulletinForm";
import Modal from "../../components/ui/Modal";
import {
  BULLETIN_KINDS,
  BULLETIN_KIND_KEYS,
  apiMessage,
  bulletinTiming,
  mergeWards,
  useNow,
  useWards,
} from "../../components/community/helpers";

const TABS = [
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

const PAGE_SIZE = 6;

const KIND_HELP = {
  OUTAGE: "Water, power or streetlights off for a while.",
  ROADWORKS: "Closures, diversions and digging.",
  ADVISORY: "Things to know, or to do before a deadline.",
  EVENT: "Collection drives, ward meetings and camps.",
};

const EMPTY_COPY = {
  active: {
    title: "All quiet right now",
    text: "No outages, roadworks or advisories are running. Check Upcoming for what's planned.",
  },
  upcoming: {
    title: "Nothing scheduled yet",
    text: "Planned work and events show up here as soon as a department announces them.",
  },
  past: {
    title: "No past bulletins",
    text: "Bulletins move here once their end time passes.",
  },
};

export default function Bulletins() {
  const { user, can, isAuthenticated } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useNow();
  const baseWards = useWards(can);

  const statusParam = searchParams.get("status");
  const status = TABS.some((tab) => tab.value === statusParam)
    ? statusParam
    : "active";
  const wardId = searchParams.get("ward") || "";
  const kindParam = searchParams.get("kind");
  const kind = BULLETIN_KIND_KEYS.includes(kindParam) ? kindParam : "";

  // The loaded page remembers which request it answers, so
  // "loading" is derived instead of toggled inside the effect.
  const [page, setPage] = useState({ key: "", list: [], cursor: null });
  const [seenWards, setSeenWards] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composing, setComposing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const wards = useMemo(
    () => mergeWards(baseWards, seenWards),
    [baseWards, seenWards]
  );

  const fetchPage = useCallback(
    async (cursor) => {
      const params = { status, limit: PAGE_SIZE };

      if (wardId) params.wardId = wardId;
      if (kind) params.kind = kind;
      if (cursor) params.cursor = cursor;

      const response = await api.get("/bulletins", { params });

      return {
        list: response.data.bulletins || [],
        cursor: response.data.nextCursor ?? null,
      };
    },
    [status, wardId, kind]
  );

  const requestKey = `${status}|${wardId}|${kind}|${reloadKey}`;

  useEffect(() => {
    let active = true;

    fetchPage()
      .then(({ list, cursor }) => {
        if (!active) return;

        setPage({ key: requestKey, list, cursor });
        setError("");
        setSeenWards((current) =>
          mergeWards(current, list.map((item) => item.ward))
        );
      })
      .catch((fetchError) => {
        if (!active) return;

        setPage({ key: requestKey, list: [], cursor: null });
        setError(apiMessage(fetchError, "Couldn't load bulletins."));
      });

    return () => {
      active = false;
    };
  }, [fetchPage, requestKey]);

  const loading = page.key !== requestKey;
  const bulletins = page.list;
  const nextCursor = page.cursor;

  async function loadMore() {
    setLoadingMore(true);

    try {
      const { list, cursor } = await fetchPage(nextCursor);

      setPage((current) => ({
        ...current,
        list: [
          ...current.list,
          ...list.filter((item) => !current.list.some((b) => b.id === item.id)),
        ],
        cursor,
      }));
      setSeenWards((current) =>
        mergeWards(current, list.map((item) => item.ward))
      );
    } catch (moreError) {
      setError(apiMessage(moreError, "Couldn't load more bulletins."));
    } finally {
      setLoadingMore(false);
    }
  }

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);

    if (value) next.set(key, value);
    else next.delete(key);

    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    next.delete("ward");
    next.delete("kind");
    setSearchParams(next, { replace: true });
  }

  async function handleDelete(bulletin) {
    setNotice("");

    try {
      await api.delete(`/bulletins/${bulletin.id}`);
      setPage((current) => ({
        ...current,
        list: current.list.filter((b) => b.id !== bulletin.id),
      }));
      setNotice(`Removed “${bulletin.title}”.`);
      return true;
    } catch (deleteError) {
      setError(apiMessage(deleteError, "Couldn't remove the bulletin."));
      return false;
    }
  }

  function handlePublished(bulletin) {
    setComposing(false);

    const phase = bulletinTiming(bulletin, Date.now()).phase;
    const tabLabel = TABS.find((tab) => tab.value === phase)?.label;

    setNotice(
      phase === status
        ? `Published “${bulletin.title}”.`
        : `Published “${bulletin.title}”. It's listed under ${tabLabel}.`
    );
    setReloadKey((key) => key + 1);
  }

  const canDelete = (bulletin) =>
    can("bulletin:manage") ||
    (!!user && bulletin.author?.id === user.id);

  const filtered = !!(wardId || kind);
  const empty = EMPTY_COPY[status];
  const tabHref = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set("status", value);
    return `?${next.toString()}`;
  };

  return (
    <div className="page bulletins-page">
      <PageHeader
        eyebrow={FEATURES.bulletins}
        title="What's happening on your streets"
        description="Water cuts, roadworks, advisories and events from city departments, by ward. Pinned notices stay on top."
        actions={
          can("bulletin:publish") ? (
            <button
              type="button"
              className="btn-accent"
              onClick={() => setComposing(true)}
            >
              <Plus aria-hidden="true" />
              Publish a bulletin
            </button>
          ) : !isAuthenticated ? (
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="btn btn-ghost"
            >
              Staff? Log in to publish
            </Link>
          ) : null
        }
      />

      <nav className="tabs feature-tabs" aria-label="Bulletin timing">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            to={tabHref(tab.value)}
            replace
            className={`tab ${status === tab.value ? "is-active" : ""}`}
            aria-current={status === tab.value ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="filters-bar feature-filters">
        <div className="filter-select">
          <label htmlFor="bulletin-ward-filter" className="sr-only">
            Ward
          </label>
          <select
            id="bulletin-ward-filter"
            value={wardId}
            onChange={(event) => setParam("ward", event.target.value)}
          >
            <option value="">All wards</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>
                {ward.name} ({ward.code})
              </option>
            ))}
          </select>
        </div>

        <div className="chip-filter" role="group" aria-label="Filter by type">
          <button
            type="button"
            className={`filter-chip ${kind === "" ? "is-active" : ""}`}
            aria-pressed={kind === ""}
            onClick={() => setParam("kind", "")}
          >
            All types
          </button>
          {BULLETIN_KIND_KEYS.map((key) => {
            const meta = BULLETIN_KINDS[key];
            const Icon = meta.icon;

            return (
              <button
                key={key}
                type="button"
                className={`filter-chip kind-${meta.tone} ${kind === key ? "is-active" : ""}`}
                aria-pressed={kind === key}
                onClick={() => setParam("kind", kind === key ? "" : key)}
              >
                <Icon aria-hidden="true" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div className="form-success" role="status">
          {notice}
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="grid-main-side">
        <section
          className="bulletin-list"
          aria-label={`${TABS.find((tab) => tab.value === status).label} bulletins`}
        >
          {loading ? (
            <Loading label="Loading bulletins…" />
          ) : bulletins.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={Megaphone}
                title="Nothing matches these filters"
                action={
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={clearFilters}
                  >
                    <RotateCcw aria-hidden="true" />
                    Clear filters
                  </button>
                }
              >
                Try another ward or type, or look at every ward at once.
              </EmptyState>
            ) : (
              <EmptyState icon={Megaphone} title={empty.title}>
                {empty.text}
              </EmptyState>
            )
          ) : (
            <>
              {bulletins.map((bulletin) => (
                <BulletinCard
                  key={bulletin.id}
                  bulletin={bulletin}
                  now={now}
                  canDelete={canDelete(bulletin)}
                  onDelete={handleDelete}
                />
              ))}

              {nextCursor && (
                <div className="feature-load-more">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more bulletins"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="stack feature-rail" aria-label="About bulletins">
          <section className="card card-navy rail-callout">
            <span className="rail-callout-icon" aria-hidden="true">
              <BellRing />
            </span>
            <h2>Alerts for your ward</h2>
            {can("bulletin:publish") ? (
              <p>
                Residents whose profile ward matches get an alert the moment
                you publish. Citywide bulletins reach everyone on this board.
              </p>
            ) : isAuthenticated ? (
              <>
                <p>
                  {user?.ward
                    ? `New bulletins for ${user.ward} land in your alerts as soon as they're published.`
                    : "Set your ward on your profile and new bulletins for it land in your alerts."}
                </p>
                <Link to="/profile" className="btn btn-accent btn-sm">
                  {user?.ward ? "Change your ward" : "Set your ward"}
                </Link>
              </>
            ) : (
              <>
                <p>
                  Create a free account, set your ward, and get water cuts
                  and roadworks as alerts instead of surprises.
                </p>
                <Link to="/register" className="btn btn-accent btn-sm">
                  Create an account
                </Link>
              </>
            )}
          </section>

          <section className="card">
            <h2 className="rail-title">What the tags mean</h2>
            <ul className="kind-legend">
              {BULLETIN_KIND_KEYS.map((key) => (
                <li key={key}>
                  <KindChip kind={key} />
                  <span>{KIND_HELP[key]}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {composing && (
        <Modal
          className="community-modal"
          eyebrow={FEATURES.bulletins}
          title="Publish a bulletin"
          onClose={() => setComposing(false)}
        >
          <BulletinForm
            wards={wards}
            onPublished={handlePublished}
            onCancel={() => setComposing(false)}
          />
        </Modal>
      )}
    </div>
  );
}
