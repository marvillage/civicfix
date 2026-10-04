import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Camera,
  ClipboardList,
  MapPin,
  Search,
  Siren,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import {
  CategoryChip,
  EmptyState,
  Loading,
  PageHeader,
  Segmented,
  SeverityBadge,
  StatusBadge,
} from "../../components/ui";
import { CATEGORY_META } from "../../lib/labels";
import { formatDate, timeAgo } from "../../lib/format";
import { FixClockChip } from "../CaseKit";
import {
  DONE_STATUSES,
  SIGN_OFF_STATUSES,
  fixClock,
  useNow,
} from "../caseUtils";

function bucketOf(status) {
  if (SIGN_OFF_STATUSES.includes(status)) return "SIGN_OFF";
  if (DONE_STATUSES.includes(status)) return "CLOSED";

  return "OPEN";
}

const BUCKET_ORDER = { SIGN_OFF: 0, OPEN: 1, CLOSED: 2 };

function CountLabel({ label, count }) {
  return (
    <>
      {label}
      <span className="mc-seg-count">{count}</span>
    </>
  );
}

export default function MyComplaints() {
  const now = useNow(60_000);

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function fetchComplaints() {
      try {
        const response = await api.get("/complaints/my");

        setComplaints(response.data.complaints || []);
      } catch (fetchError) {
        console.error("Fetch complaints error:", fetchError);

        setError(
          fetchError.response?.data?.message ||
            "Unable to load your cases."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchComplaints();
  }, []);

  const rows = useMemo(
    () =>
      complaints.map((complaint) => {
        const issue = complaint.issue ?? {};
        const clock = fixClock(
          {
            sla: issue.sla,
            status: issue.status,
            createdAt: issue.createdAt,
          },
          now
        );

        return {
          complaint,
          issue,
          bucket: bucketOf(issue.status),
          clock,
        };
      }),
    [complaints, now]
  );

  const counts = rows.reduce(
    (acc, row) => ({ ...acc, [row.bucket]: (acc[row.bucket] || 0) + 1 }),
    { OPEN: 0, SIGN_OFF: 0, CLOSED: 0 }
  );

  const needle = query.trim().toLowerCase();

  const visible = rows
    .filter((row) => filter === "ALL" || row.bucket === filter)
    .filter(
      (row) =>
        !needle ||
        [
          row.issue.title,
          row.complaint.description,
          row.issue.address,
          row.issue.ward?.name,
          CATEGORY_META[row.issue.category]?.label,
        ]
          .filter(Boolean)
          .some((text) => text.toLowerCase().includes(needle))
    )
    .sort((a, b) => {
      const byBucket = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];

      if (byBucket) return byBucket;

      if (a.bucket === "OPEN") {
        const ra = a.clock?.remainingMs ?? Number.MAX_SAFE_INTEGER;
        const rb = b.clock?.remainingMs ?? Number.MAX_SAFE_INTEGER;

        if (ra !== rb) return ra - rb;
      }

      return (
        new Date(b.complaint.createdAt).getTime() -
        new Date(a.complaint.createdAt).getTime()
      );
    });

  const header = (
    <PageHeader
      eyebrow={FEATURES.myCases}
      title="Everything you've reported"
      description={`Follow each case from report to fix. Anything waiting for your ${FEATURES.signOff} sits at the top.`}
      actions={
        <Link to="/citizen/report" className="btn btn-accent">
          <Camera aria-hidden="true" />
          {FEATURES.snapSend}
        </Link>
      }
    />
  );

  if (loading) {
    return (
      <div className="page">
        {header}
        <Loading label="Loading your cases…" />
      </div>
    );
  }

  return (
    <div className="page my-cases">
      {header}

      {error && <div className="form-error">{error}</div>}

      {!error && complaints.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No cases yet"
          action={
            <Link to="/citizen/report" className="btn btn-accent">
              <Camera aria-hidden="true" />
              Make your first report
            </Link>
          }
        >
          When you report a broken streetlight, a pothole or an overflowing
          bin, you can follow it here until it's fixed.
        </EmptyState>
      )}

      {complaints.length > 0 && (
        <>
          <div className="filters-bar mc-filters">
            <Segmented
              label="Filter cases"
              value={filter}
              onChange={setFilter}
              options={[
                {
                  value: "ALL",
                  label: <CountLabel label="All" count={rows.length} />,
                },
                {
                  value: "OPEN",
                  label: <CountLabel label="Open" count={counts.OPEN} />,
                },
                {
                  value: "SIGN_OFF",
                  label: (
                    <CountLabel label="To sign off" count={counts.SIGN_OFF} />
                  ),
                },
                {
                  value: "CLOSED",
                  label: <CountLabel label="Closed" count={counts.CLOSED} />,
                },
              ]}
            />

            <div className="search-field">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your cases"
                aria-label="Search your cases"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nothing matches"
              action={
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFilter("ALL");
                    setQuery("");
                  }}
                >
                  Show all cases
                </button>
              }
            >
              No cases in this view. Try another filter or clear the search.
            </EmptyState>
          ) : (
            <ul className="mc-grid">
              {visible.map(({ complaint, issue, bucket, clock }) => {
                const meta = CATEGORY_META[issue.category] ?? CATEGORY_META.OTHER;
                const Icon = meta.icon;

                return (
                  <li key={complaint.id}>
                    <Link
                      to={`/citizen/complaints/${complaint.id}`}
                      className={`card card-link mc-card ${
                        bucket === "SIGN_OFF" ? "is-signoff" : ""
                      }`}
                    >
                      <span className="mc-photo">
                        {complaint.imageUrl ? (
                          <img src={complaint.imageUrl} alt="" loading="lazy" />
                        ) : (
                          <Icon aria-hidden="true" />
                        )}
                        {complaint.photos?.length > 1 && (
                          <span className="mc-photo-count">
                            {complaint.photos.length} photos
                          </span>
                        )}
                      </span>

                      <span className="mc-body">
                        <span className="mc-chips">
                          <StatusBadge status={issue.status} />
                          {issue.isEmergency && (
                            <span className="red-alert">
                              <Siren aria-hidden="true" />
                              {FEATURES.redAlert}
                            </span>
                          )}
                          {bucket === "SIGN_OFF" && (
                            <span className="chip chip-accent">
                              <BadgeCheck aria-hidden="true" />
                              {FEATURES.signOff} needed
                            </span>
                          )}
                        </span>

                        <strong className="mc-title">
                          {issue.title || "Untitled case"}
                        </strong>

                        <span className="complaint-description">
                          {complaint.description ||
                            issue.description ||
                            "No description provided."}
                        </span>

                        <span className="meta-row">
                          {issue.category && (
                            <CategoryChip category={issue.category} short />
                          )}
                          <SeverityBadge severity={issue.severity} />
                        </span>

                        <span className="mc-foot">
                          {issue.address && (
                            <span className="mc-address">
                              <MapPin aria-hidden="true" />
                              {issue.address}
                            </span>
                          )}
                          <span className="mc-when">
                            <time dateTime={complaint.createdAt}>
                              {formatDate(complaint.createdAt)}
                            </time>{" "}
                            · {timeAgo(complaint.createdAt, now)}
                          </span>
                          {clock && bucket === "OPEN" && (
                            <FixClockChip clock={clock} />
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
