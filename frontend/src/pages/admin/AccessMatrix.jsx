import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, Search, ShieldCheck, Users } from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { ROLE_LABEL } from "../../components/layout/navigation";
import {
  EmptyState,
  Loading,
  PageHeader,
  Segmented,
} from "../../components/ui";
import { formatNumber } from "../../lib/format";
import { apiError } from "./adminUtils";

const DEFAULT_ROLES = ["CITIZEN", "AUTHORITY", "ADMIN"];

export default function AccessMatrix() {
  const { can } = useAuth();

  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [heldBy, setHeldBy] = useState("ALL");

  useEffect(() => {
    let cancelled = false;

    api
      .get("/admin/access-matrix")
      .then((response) => {
        if (!cancelled) setMatrix(response.data);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(apiError(fetchError, "Unable to load the permission matrix."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const roles = matrix?.roles?.length ? matrix.roles : DEFAULT_ROLES;
  const permissions = useMemo(() => matrix?.permissions ?? [], [matrix]);

  const totals = useMemo(
    () =>
      Object.fromEntries(
        roles.map((role) => [
          role,
          permissions.filter((permission) => permission.roles?.includes(role)).length,
        ])
      ),
    [roles, permissions]
  );

  // Rows grouped by `group`, in the order the server lists them.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map();

    permissions
      .filter((permission) => heldBy === "ALL" || permission.roles?.includes(heldBy))
      .filter(
        (permission) =>
          !needle ||
          [permission.key, permission.description, permission.group]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)
      )
      .forEach((permission) => {
        const group = permission.group || "Other";

        if (!map.has(group)) map.set(group, []);
        map.get(group).push(permission);
      });

    return [...map.entries()];
  }, [permissions, query, heldBy]);

  const shown = groups.reduce((sum, [, rows]) => sum + rows.length, 0);

  if (loading) {
    return <Loading label={`Loading the ${FEATURES.permissions}…`} />;
  }

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow={FEATURES.permissions}
        title="Who can do what"
        description="Every permission the server checks, grouped by area, and which roles hold it. This is read-only: it mirrors the code."
        actions={
          can("user:manage") && (
            <Link to="/admin/users" className="btn btn-secondary">
              <Users aria-hidden="true" />
              {FEATURES.accessControl}
            </Link>
          )
        }
      />

      {error && <div className="form-error" role="alert">{error}</div>}

      <section className="card card-navy matrix-explainer">
        <span className="matrix-explainer-icon" aria-hidden="true">
          <ShieldCheck />
        </span>
        <div className="matrix-explainer-text">
          <h2>Permissions first, ownership on top</h2>
          <p>
            Routes check permissions, not roles; ownership rules (only the assigned officer, only
            your own zone) are enforced on top.
          </p>
        </div>
        <ul className="matrix-totals" aria-label="Permissions per role">
          {roles.map((role) => (
            <li key={role}>
              <strong>{formatNumber(totals[role] ?? 0)}</strong>
              <span>{ROLE_LABEL[role] ?? role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-label="Permission matrix">
        <div className="filters-bar admin-filters">
          <label className="search-field">
            <span className="sr-only">Search permissions</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a permission key or what it allows"
            />
          </label>
        </div>

        <div className="admin-table-toolbar">
          <Segmented
            label="Held by"
            options={[
              { value: "ALL", label: "Everything" },
              ...roles.map((role) => ({ value: role, label: ROLE_LABEL[role] ?? role })),
            ]}
            value={heldBy}
            onChange={setHeldBy}
          />
          <p className="admin-count" aria-live="polite">
            {formatNumber(shown)} of {formatNumber(permissions.length)} permissions
          </p>
        </div>

        {shown === 0 ? (
          <EmptyState icon={ShieldCheck} title="No permissions match">
            Try a shorter search, like “budget” or “issue:”.
          </EmptyState>
        ) : (
          <div className="table-scroll admin-table-scroll">
            <table className="data-table admin-table matrix-table">
              <caption className="sr-only">
                Permissions by role. Each cell says whether the role is allowed.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Permission</th>
                  {roles.map((role) => (
                    <th key={role} scope="col" className="matrix-role">
                      {ROLE_LABEL[role] ?? role}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map(([group, rows]) => (
                <tbody key={group}>
                  <tr className="matrix-group">
                    <th scope="rowgroup" colSpan={roles.length + 1}>
                      {group}
                      <span className="matrix-group-count">{rows.length}</span>
                    </th>
                  </tr>
                  {rows.map((permission) => (
                    <tr key={permission.key}>
                      <th scope="row" className="matrix-permission">
                        <span>{permission.description}</span>
                        <code>{permission.key}</code>
                      </th>
                      {roles.map((role) => {
                        const allowed = permission.roles?.includes(role);

                        return (
                          <td key={role} className="matrix-cell">
                            {allowed ? (
                              <span className="matrix-yes" title="Allowed">
                                <Check aria-hidden="true" />
                                <span className="sr-only">Allowed</span>
                              </span>
                            ) : (
                              <span className="matrix-no" title="Not allowed">
                                <Minus aria-hidden="true" />
                                <span className="sr-only">Not allowed</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
