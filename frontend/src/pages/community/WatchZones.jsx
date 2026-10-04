import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  LocateFixed,
  MapPinned,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import {
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import MiniMap from "../../components/community/MiniMap";
import ZoneEditor from "../../components/community/ZoneEditor";
import {
  CITY_CENTER,
  apiMessage,
  formatMeters,
} from "../../components/community/helpers";
import { CATEGORY_META } from "../../lib/labels";
import { timeAgo } from "../../lib/format";

const MAX_ZONES = 5;
const NO_ISSUES = [];
const DRAFT_ID = "__draft";

function newDraft(center) {
  return {
    id: null,
    originalName: "",
    name: "",
    latitude: center[0],
    longitude: center[1],
    radiusM: 600,
    categories: [],
  };
}

function categorySummary(categories) {
  if (!categories.length) return "All categories";

  return categories
    .map((category) => CATEGORY_META[category]?.short ?? category)
    .join(", ");
}

export default function WatchZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [issuesResult, setIssuesResult] = useState({ key: "", list: [], error: "" });
  const [issuesTick, setIssuesTick] = useState(0);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fitTick, setFitTick] = useState(0);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get("/watch-zones")
      .then((response) => {
        if (!active) return;

        const list = response.data.zones || [];
        setZones(list);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch((fetchError) => {
        if (active) setError(apiMessage(fetchError, "Couldn't load your zones."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Cases inside the selected zone. Loading is derived: the stored
  // result belongs to a different zone (or refresh) than requested.
  const issuesKey = selectedId ? `${selectedId}:${issuesTick}` : "";

  useEffect(() => {
    if (!issuesKey) return undefined;

    let active = true;
    const zoneId = issuesKey.split(":")[0];

    api
      .get(`/watch-zones/${zoneId}/issues`)
      .then((response) => {
        if (active) {
          setIssuesResult({ key: issuesKey, list: response.data.issues || [], error: "" });
        }
      })
      .catch((fetchError) => {
        if (active) {
          setIssuesResult({
            key: issuesKey,
            list: [],
            error: apiMessage(fetchError, "Couldn't load cases in this zone."),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [issuesKey]);

  const issuesLoading = !!issuesKey && issuesResult.key !== issuesKey;
  const issues = issuesLoading ? NO_ISSUES : issuesResult.list;

  const selected = zones.find((zone) => zone.id === selectedId) ?? null;
  const editing = !!draft;
  const full = zones.length >= MAX_ZONES;

  const circles = useMemo(() => {
    const shapes = zones
      .filter((zone) => !draft || zone.id !== draft.id)
      .map((zone) => ({
        id: zone.id,
        lat: zone.latitude,
        lng: zone.longitude,
        radius: zone.radiusM,
        label: `${zone.name} · ${formatMeters(zone.radiusM)}`,
        active: !draft && zone.id === selectedId,
        muted: !!draft,
      }));

    if (draft) {
      shapes.push({
        id: DRAFT_ID,
        lat: draft.latitude,
        lng: draft.longitude,
        radius: draft.radiusM,
        label: draft.name || "New zone",
        draft: true,
      });
    }

    return shapes;
  }, [zones, draft, selectedId]);

  const issueDots = useMemo(
    () =>
      draft || !selectedId
        ? []
        : issues
            .filter(
              (issue) =>
                Number.isFinite(issue.latitude) && Number.isFinite(issue.longitude)
            )
            .map((issue) => ({
              id: issue.id,
              lat: issue.latitude,
              lng: issue.longitude,
              tone: "dot",
              color: (CATEGORY_META[issue.category] ?? CATEGORY_META.OTHER).series,
              label: issue.title,
            })),
    [issues, draft, selectedId]
  );

  function startCreate() {
    const center = selected
      ? [selected.latitude, selected.longitude]
      : CITY_CENTER;

    setDraft(newDraft(center));
    setFormError("");
    setNotice("");
    setConfirmId(null);
    setFitTick((tick) => tick + 1);
  }

  function startEdit(zone) {
    setDraft({
      id: zone.id,
      originalName: zone.name,
      name: zone.name,
      latitude: zone.latitude,
      longitude: zone.longitude,
      radiusM: zone.radiusM,
      categories: [...zone.categories],
    });
    setFormError("");
    setNotice("");
    setConfirmId(null);
    setFitTick((tick) => tick + 1);
  }

  function cancelEdit() {
    setDraft(null);
    setFormError("");
    setFitTick((tick) => tick + 1);
  }

  function moveDraft(latitude, longitude, { recenter = false } = {}) {
    setDraft((current) => (current ? { ...current, latitude, longitude } : current));

    if (recenter) setFitTick((tick) => tick + 1);
  }

  async function saveDraft() {
    const name = draft.name.trim();

    if (name.length < 2 || name.length > 40) {
      setFormError("Give the zone a name of 2–40 characters.");
      return;
    }

    if (!Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude)) {
      setFormError("Place the centre on the map or enter coordinates.");
      return;
    }

    const payload = {
      name,
      latitude: Number(draft.latitude.toFixed(6)),
      longitude: Number(draft.longitude.toFixed(6)),
      radiusM: draft.radiusM,
      categories: draft.categories,
    };

    setSaving(true);
    setFormError("");

    try {
      const response = draft.id
        ? await api.patch(`/watch-zones/${draft.id}`, payload)
        : await api.post("/watch-zones", payload);
      const zone = response.data.zone;

      setZones((current) =>
        draft.id
          ? current.map((item) => (item.id === zone.id ? zone : item))
          : [...current, zone]
      );
      setSelectedId(zone.id);
      setIssuesTick((tick) => tick + 1);
      setDraft(null);
      setFitTick((tick) => tick + 1);
      setNotice(
        draft.id
          ? `Saved “${zone.name}”.`
          : `“${zone.name}” is live. We'll alert you when a new case is reported inside it.`
      );
    } catch (saveError) {
      setFormError(apiMessage(saveError, "Couldn't save the zone."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteZone(zone) {
    try {
      await api.delete(`/watch-zones/${zone.id}`);

      const rest = zones.filter((item) => item.id !== zone.id);

      setZones(rest);
      setConfirmId(null);
      setNotice(`Deleted “${zone.name}”. You'll stop getting alerts for it.`);

      if (selectedId === zone.id) {
        setSelectedId(rest[0]?.id ?? null);
      }

      setFitTick((tick) => tick + 1);
    } catch (deleteError) {
      setError(apiMessage(deleteError, "Couldn't delete the zone."));
    }
  }

  function selectZone(id) {
    if (editing) return;

    setSelectedId(id);
    setFitTick((tick) => tick + 1);
  }

  if (loading) {
    return <Loading label="Loading your Watch Zones…" />;
  }

  const fitKey = editing
    ? `edit:${draft.id ?? "new"}:${fitTick}`
    : `view:${selectedId ?? "all"}:${fitTick}`;

  return (
    <div className="page zones-page">
      <PageHeader
        eyebrow={FEATURES.watchZones}
        title="Your Watch Zones"
        description="Circle up to five places you care about: home, the school run, your shop. We'll alert you when a new case is reported inside a zone."
        actions={
          !editing && (
            <button
              type="button"
              className="btn-accent"
              onClick={startCreate}
              disabled={full}
              title={full ? "You're using all five zones" : undefined}
            >
              <Plus aria-hidden="true" />
              New zone
            </button>
          )
        }
      />

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

      <div className="zones-layout">
        <div className="card card-flush zones-map">
          <MiniMap
            circles={circles}
            markers={issueDots}
            onPick={editing ? (lat, lng) => moveDraft(lat, lng) : undefined}
            onSelect={selectZone}
            fitKey={fitKey}
            focusId={editing ? DRAFT_ID : selectedId ?? undefined}
            height="clamp(320px, 58vh, 540px)"
            label={
              editing
                ? "Map. Click to place the zone centre."
                : "Map of your Watch Zones"
            }
            pickHint={editing ? "Click the map to move the centre" : undefined}
          />

          {!editing && zones.length > 1 && (
            <div className="map-caption">
              <span>
                <MapPinned aria-hidden="true" />
                Showing {selected ? `“${selected.name}”` : "all zones"}.
              </span>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setSelectedId(null);
                  setFitTick((tick) => tick + 1);
                }}
                disabled={!selected}
              >
                Show all zones
              </button>
            </div>
          )}
        </div>

        <div className="zones-rail">
          {editing ? (
            <ZoneEditor
              draft={draft}
              isEdit={!!draft.id}
              saving={saving}
              error={formError}
              onChange={(patch) =>
                setDraft((current) => ({ ...current, ...patch }))
              }
              onMove={moveDraft}
              onSubmit={saveDraft}
              onCancel={cancelEdit}
            />
          ) : (
            <section className="card zone-list-card" aria-labelledby="zone-list-title">
              <div className="zone-list-head">
                <h2 id="zone-list-title">Zones</h2>
                <div className="zone-usage">
                  <span className="zone-pips" aria-hidden="true">
                    {Array.from({ length: MAX_ZONES }, (_, index) => (
                      <span key={index} className={index < zones.length ? "is-used" : ""} />
                    ))}
                  </span>
                  <span>
                    {zones.length} of {MAX_ZONES} used
                  </span>
                </div>
              </div>

              {zones.length === 0 ? (
                <EmptyState
                  icon={LocateFixed}
                  title="No zones yet"
                  action={
                    <button type="button" className="btn-accent" onClick={startCreate}>
                      <Plus aria-hidden="true" />
                      Draw your first zone
                    </button>
                  }
                >
                  Put a circle around home or work and hear about new
                  cases there before you walk into them.
                </EmptyState>
              ) : (
                <ul className="zone-list">
                  {zones.map((zone) => {
                    const isSelected = zone.id === selectedId;

                    return (
                      <li
                        key={zone.id}
                        className={`zone-item ${isSelected ? "is-selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="zone-select"
                          aria-pressed={isSelected}
                          onClick={() => selectZone(zone.id)}
                        >
                          <span className="zone-text">
                            <strong>{zone.name}</strong>
                            <span>
                              {formatMeters(zone.radiusM)} radius ·{" "}
                              {categorySummary(zone.categories)}
                            </span>
                          </span>
                          <span
                            className={`zone-count ${zone.openIssues > 0 ? "has-open" : ""}`}
                          >
                            <strong>{zone.openIssues}</strong>
                            open
                          </span>
                        </button>

                        {confirmId === zone.id ? (
                          <div className="inline-confirm zone-confirm" role="group" aria-label={`Delete ${zone.name}?`}>
                            <span>Delete “{zone.name}”?</span>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              onClick={() => deleteZone(zone)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => setConfirmId(null)}
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <div className="zone-actions">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Edit ${zone.name}`}
                              title="Edit"
                              onClick={() => startEdit(zone)}
                            >
                              <Pencil aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="icon-button zone-delete"
                              aria-label={`Delete ${zone.name}`}
                              title="Delete"
                              onClick={() => setConfirmId(zone.id)}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="zone-note">
                <BellRing aria-hidden="true" />
                Alerts go to the bell in the top bar. You won't be alerted
                about cases you report yourself.
              </p>
            </section>
          )}
        </div>
      </div>

      {!editing && selected && (
        <section className="card" aria-labelledby="zone-issues-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Inside {selected.name}</p>
              <h2 id="zone-issues-title">Open cases, nearest first</h2>
              <p className="section-lede">
                Within {formatMeters(selected.radiusM)} of the centre ·{" "}
                {categorySummary(selected.categories)}.
              </p>
            </div>
          </div>

          {issuesLoading ? (
            <Loading label="Finding open cases…" />
          ) : issuesResult.error ? (
            <div className="form-error" role="alert">
              {issuesResult.error}
            </div>
          ) : issues.length === 0 ? (
            <EmptyState icon={MapPinned} title="Nothing open in this zone">
              No open cases inside this circle right now. We'll alert you
              when one is reported.
            </EmptyState>
          ) : (
            <ul className="list-divided zone-issues">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <Link to={`/issues/${issue.id}`} className="zone-issue">
                    <span className="zone-distance">
                      <strong>{formatMeters(issue.distanceMeters)}</strong>
                      <span>away</span>
                    </span>
                    <span className="zone-issue-main">
                      <strong>{issue.title}</strong>
                      <span className="meta-row">
                        <CategoryChip category={issue.category} short />
                        <StatusBadge status={issue.status} />
                        {issue.ward?.name && <span>{issue.ward.name}</span>}
                        {issue.createdAt && (
                          <span>Reported {timeAgo(issue.createdAt)}</span>
                        )}
                      </span>
                    </span>
                    <ArrowRight className="zone-issue-arrow" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
