import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import api from "../../api/axios";
import { CategoryChip, StatusBadge } from "../ui";
import { FEATURES } from "../../brand";

// Search public cases (GET /issues?q=) and link one.
// value: IssueRef | null · onChange(IssueRef | null)
export default function IssuePicker({
  value,
  onChange,
  label = `Link a ${FEATURES.caseFile}`,
  hint,
  compact = false,
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState("");

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return undefined;

    let active = true;

    const timer = setTimeout(() => {
      setSearching(true);

      api
        .get("/issues", { params: { q: term, limit: 8 } })
        .then((response) => {
          if (!active) return;
          setResults((response.data.issues || []).slice(0, 8));
          setSearched(term);
        })
        .catch(() => {
          if (active) {
            setResults([]);
            setSearched(term);
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  const showResults = term.length >= 2;

  if (value) {
    return (
      <div className={`field issue-picker ${compact ? "is-compact" : ""}`}>
        {!compact && <span className="picker-label">{label}</span>}

        <div className="picked-issue">
          <span className="picked-issue-main">
            <Link to={`/issues/${value.id}`} className="text-link" target="_blank" rel="noreferrer">
              {value.title}
            </Link>
            <span className="meta-row">
              {value.category && <CategoryChip category={value.category} short />}
              {value.status && <StatusBadge status={value.status} />}
            </span>
          </span>

          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => onChange(null)}
            aria-label={`Unlink ${value.title}`}
          >
            <X aria-hidden="true" />
            Unlink
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`field issue-picker ${compact ? "is-compact" : ""}`}>
      <label htmlFor={id} className={compact ? "sr-only" : undefined}>
        {label}
      </label>

      <div className="search-field">
        <Search aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={query}
          placeholder="Search cases by title, street or ward"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
      </div>

      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}

      {showResults && (
        <div className="picker-results" role="region" aria-label="Matching cases" aria-live="polite">
          {searching && results.length === 0 ? (
            <p className="empty-inline">Searching…</p>
          ) : results.length === 0 && searched === term ? (
            <p className="empty-inline">No cases match “{term}”.</p>
          ) : (
            <ul>
              {results.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    className="picker-result"
                    onClick={() => {
                      onChange({
                        id: issue.id,
                        title: issue.title,
                        status: issue.status,
                        category: issue.category,
                      });
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <span className="picker-result-title">{issue.title}</span>
                    <span className="meta-row">
                      <CategoryChip category={issue.category} short />
                      <StatusBadge status={issue.status} />
                      {issue.ward?.name && <span>{issue.ward.name}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
