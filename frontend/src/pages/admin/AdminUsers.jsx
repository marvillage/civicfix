import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Check,
  Copy,
  HardHat,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
  Star,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import api from "../../api/axios";
import { FEATURES } from "../../brand";
import { useAuth } from "../../context/auth";
import { ROLE_LABEL } from "../../components/layout/navigation";
import {
  Avatar,
  EmptyState,
  Loading,
  PageHeader,
  Segmented,
  SectionHeader,
  StatTile,
} from "../../components/ui";
import { formatDate, formatNumber } from "../../lib/format";
import Modal from "../../components/ui/Modal";
import { Notice } from "./adminKit";
import { apiError } from "./adminUtils";

const ROLES = ["CITIZEN", "AUTHORITY", "ADMIN"];

const ROLE_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "CITIZEN", label: "Citizens" },
  { value: "AUTHORITY", label: "Officers" },
  { value: "ADMIN", label: "Admins" },
];

// What a role change means, in one line, for the confirm step.
const ROLE_EFFECT = {
  CITIZEN: `Keeps reporting, ${FEATURES.backIt} and ${FEATURES.wardVote}; loses every staff tool.`,
  AUTHORITY: `Gets a ${FEATURES.crewQueue}, ${FEATURES.patrolLog} and the ${FEATURES.costLedger}; stops filing citizen reports.`,
  ADMIN: `Gets full control, including ${FEATURES.accessControl}, ${FEATURES.fixClock} and the ${FEATURES.paperTrail}.`,
};

const EMPTY_FORM = {
  name: "",
  email: "",
  employeeId: "",
  designation: "",
  phone: "",
  departmentId: "",
};

function roleLabel(role) {
  return ROLE_LABEL[role] ?? role;
}

export default function AdminUsers() {
  const { user: me, can } = useAuth();
  const canManage = can("user:manage");

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [approving, setApproving] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [roleChange, setRoleChange] = useState(null); // { user, role }

  const fetchUsers = useCallback(async () => {
    try {
      const [usersRes, departmentsRes] = await Promise.all([
        api.get("/users"),
        api.get("/organization/departments"),
      ]);

      setUsers(usersRes.data.users || []);
      setDepartments(departmentsRes.data.departments || []);
      setError("");
    } catch (fetchError) {
      console.error("Fetch users error:", fetchError);
      setError(apiError(fetchError, "Unable to load people."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // State is only set after the request resolves.
    async function load() {
      await fetchUsers();
    }

    load();
  }, [fetchUsers]);

  async function approve(person) {
    try {
      setApproving(person.id);
      setNotice(null);

      const response = await api.patch(`/users/${person.id}/verify`, { verified: true });

      setUsers((current) =>
        current.map((item) => (item.id === person.id ? { ...item, isVerified: true } : item))
      );
      setNotice({
        tone: "success",
        text: response.data.message || `${person.name} can now sign in.`,
      });
    } catch (approveError) {
      setNotice({ tone: "error", text: apiError(approveError, "Unable to approve the account.") });
    } finally {
      setApproving("");
    }
  }

  const counts = useMemo(() => {
    const result = { CITIZEN: 0, AUTHORITY: 0, ADMIN: 0, pending: 0 };

    users.forEach((person) => {
      result[person.role] = (result[person.role] || 0) + 1;
      if (!person.isVerified) result.pending += 1;
    });

    return result;
  }, [users]);

  const pending = users.filter((person) => !person.isVerified);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((person) => {
      if (roleFilter !== "ALL" && person.role !== roleFilter) return false;

      if (needle) {
        const haystack = [
          person.name,
          person.email,
          person.employeeId,
          person.designation,
          person.department?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [users, query, roleFilter]);

  if (loading) {
    return <Loading label={`Loading ${FEATURES.accessControl}…`} />;
  }

  return (
    <div className="page admin-page">
      <PageHeader
        eyebrow={FEATURES.accessControl}
        title="People and roles"
        description="Who is a citizen, an officer or an admin. Approve staff who signed up, and give new officers their first password."
        actions={
          <>
            {can("rbac:read") && (
              <Link to="/admin/access" className="btn btn-secondary">
                <ShieldCheck aria-hidden="true" />
                {FEATURES.permissions}
              </Link>
            )}
            {canManage && (
              <button type="button" className="btn-accent" onClick={() => setShowCreate(true)}>
                <UserPlus aria-hidden="true" />
                New officer account
              </button>
            )}
          </>
        }
      />

      {error && <div className="form-error" role="alert">{error}</div>}
      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <section className="kpi-row" aria-label="People by role">
        <StatTile label="Citizens" value={formatNumber(counts.CITIZEN)} hint="report and back cases" icon={Users} />
        <StatTile label="Officers" value={formatNumber(counts.AUTHORITY)} hint="work the jobs" icon={HardHat} tone="navy" />
        <StatTile label="Admins" value={formatNumber(counts.ADMIN)} hint="run the city" icon={ShieldCheck} />
        <StatTile
          label="Awaiting approval"
          value={formatNumber(counts.pending)}
          hint={counts.pending ? "can't sign in yet" : "nobody waiting"}
          icon={UserCheck}
          tone={counts.pending ? "warning" : "success"}
        />
      </section>

      {canManage && pending.length > 0 && (
        <section className="card card-accent">
          <SectionHeader
            eyebrow="Action needed"
            title={`${pending.length} staff ${pending.length === 1 ? "account" : "accounts"} waiting`}
            description="They registered as municipal staff. Check their government ID before approving; until then they can't sign in."
          />

          <ul className="list-divided pending-list">
            {pending.map((person) => (
              <li key={person.id}>
                <span className="person-cell">
                  <Avatar user={person} size={36} />
                  <span className="person-stack">
                    <strong>{person.name}</strong>
                    <span>{person.email}</span>
                  </span>
                </span>
                <span className="pending-facts">
                  <span>
                    <span className="detail-label">Employee ID</span>
                    <span className="mono">{person.employeeId || "—"}</span>
                  </span>
                  {person.designation && (
                    <span>
                      <span className="detail-label">Designation</span>
                      {person.designation}
                    </span>
                  )}
                  {person.department?.name && (
                    <span>
                      <span className="detail-label">Department</span>
                      {person.department.name}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn-sm"
                  onClick={() => approve(person)}
                  disabled={approving === person.id}
                  aria-label={`Approve ${person.name}`}
                >
                  <BadgeCheck aria-hidden="true" />
                  {approving === person.id ? "Approving…" : "Approve"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack" aria-label="Everyone">
        <div className="filters-bar admin-filters">
          <label className="search-field">
            <span className="sr-only">Search people</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, employee ID or department"
            />
          </label>
        </div>

        <div className="admin-table-toolbar">
          <Segmented label="Filter by role" options={ROLE_FILTERS} value={roleFilter} onChange={setRoleFilter} />
          <p className="admin-count" aria-live="polite">
            {formatNumber(visible.length)} of {formatNumber(users.length)} people
          </p>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon={Users} title="Nobody matches">
            Try another name or role.
          </EmptyState>
        ) : (
          <div className="table-scroll admin-table-scroll">
            <table className="data-table admin-table">
              <caption className="sr-only">People and their roles</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Identity</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Change role</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((person) => {
                  const isMe = person.id === me?.id;

                  return (
                    <tr key={person.id}>
                      <td>
                        <span className="person-cell">
                          <Avatar user={person} size={32} />
                          <span className="person-stack">
                            <strong>
                              {person.name}
                              {isMe && <span className="chip chip-navy you-chip">You</span>}
                              {!person.isVerified && (
                                <span className="chip chip-warning you-chip">Pending</span>
                              )}
                            </strong>
                            <span>{person.email}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className={`role-badge role-${person.role.toLowerCase()}`}>
                          {roleLabel(person.role)}
                        </span>
                      </td>
                      <td>
                        {person.role === "AUTHORITY" ? (
                          <span className="identity-cell">
                            {person.employeeId && <span className="mono">{person.employeeId}</span>}
                            {(person.designation || person.department?.name) && (
                              <span className="cell-sub">
                                {[person.designation, person.department?.name]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            )}
                            {!person.employeeId && !person.designation && !person.department && (
                              <span className="muted">—</span>
                            )}
                          </span>
                        ) : person.role === "CITIZEN" ? (
                          <span className="cred-cell">
                            <Star aria-hidden="true" />
                            {formatNumber(person.points ?? 0)}
                            <span className="muted">{FEATURES.civicCred}</span>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="nowrap">
                        {formatNumber(person._count?.complaints || 0)} reports
                        <span className="cell-sub">
                          {formatNumber(person._count?.assignments || 0)} jobs
                        </span>
                      </td>
                      <td className="nowrap">{formatDate(person.createdAt)}</td>
                      <td>
                        {isMe ? (
                          <span className="locked-role" title="You can't change your own role">
                            <Lock aria-hidden="true" />
                            Your role
                          </span>
                        ) : canManage ? (
                          <select
                            className="role-select"
                            value={person.role}
                            aria-label={`Role for ${person.name}`}
                            onChange={(event) =>
                              setRoleChange({ user: person, role: event.target.value })
                            }
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {roleChange && (
        <RoleDialog
          person={roleChange.user}
          role={roleChange.role}
          onClose={() => setRoleChange(null)}
          onDone={(message, role) => {
            setUsers((current) =>
              current.map((item) =>
                item.id === roleChange.user.id ? { ...item, role } : item
              )
            );
            setRoleChange(null);
            setNotice({ tone: "success", text: message });
          }}
        />
      )}

      {showCreate && (
        <CreateOfficerDialog
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchUsers()}
          onCopied={(ok) =>
            setNotice(
              ok
                ? { tone: "success", text: "Temporary password copied." }
                : { tone: "error", text: "Copy failed. Note the password down by hand." }
            )
          }
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirm a role change
// ─────────────────────────────────────────────

function RoleDialog({ person, role, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    try {
      setBusy(true);
      setError("");

      const response = await api.patch(`/users/${person.id}/role`, { role });

      onDone(response.data.message || `${person.name} is now ${roleLabel(role)}.`, role);
    } catch (roleError) {
      setError(apiError(roleError, "Unable to change the role."));
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="Change role"
      title={`Make ${person.name} ${/^[aeiou]/i.test(roleLabel(role)) ? "an" : "a"} ${roleLabel(role).toLowerCase()}?`}
      onClose={onClose}
      busy={busy}
    >
      <div className="role-change">
        <span className={`role-badge role-${person.role.toLowerCase()}`}>{roleLabel(person.role)}</span>
        <span aria-hidden="true">→</span>
        <span className="sr-only">to</span>
        <span className={`role-badge role-${role.toLowerCase()}`}>{roleLabel(role)}</span>
      </div>

      <p className="role-effect">{ROLE_EFFECT[role]}</p>

      {role === "ADMIN" && (
        <div className="alert-warning alert">
          Admins can change anyone else's role, including yours. Only promote people you'd trust with the keys.
        </div>
      )}

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={busy} data-autofocus>
          Cancel
        </button>
        <button type="button" onClick={confirm} disabled={busy}>
          {busy ? "Changing…" : `Make ${roleLabel(role).toLowerCase()}`}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Provision an officer, show the one-time password
// ─────────────────────────────────────────────

function CreateOfficerDialog({ departments, onClose, onCreated, onCopied }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  function change(event) {
    const { name, value } = event.target;

    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();

    try {
      setBusy(true);
      setError("");

      const response = await api.post("/users/authority", {
        ...form,
        departmentId: form.departmentId || undefined,
      });

      setCreated({
        user: response.data.user ?? { name: form.name, email: form.email, employeeId: form.employeeId },
        tempPassword: response.data.tempPassword,
      });
      setForm(EMPTY_FORM);
      setCopied(false);
      onCreated();
    } catch (createError) {
      setError(apiError(createError, "Unable to create the officer account."));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.tempPassword);
      setCopied(true);
      onCopied(true);
    } catch {
      onCopied(false);
    }
  }

  if (created) {
    return (
      <Modal
        key="created"
        eyebrow="Account created"
        title={`${created.user.name} is ready to sign in`}
        description="Share this password securely. It is shown once and can't be recovered; the officer changes it from their profile after signing in."
        onClose={onClose}
      >
        <dl className="created-facts">
          <div>
            <dt className="detail-label">Email</dt>
            <dd>{created.user.email}</dd>
          </div>
          {created.user.employeeId && (
            <div>
              <dt className="detail-label">Employee ID</dt>
              <dd className="mono">{created.user.employeeId}</dd>
            </div>
          )}
        </dl>

        <div className="temp-password">
          <span className="detail-label">
            <KeyRound aria-hidden="true" />
            Temporary password
          </span>
          <code>{created.tempPassword}</code>
          <button type="button" className="btn-secondary btn-sm" onClick={copy} data-autofocus>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setCreated(null)}>
            <UserPlus aria-hidden="true" />
            Create another
          </button>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      key="form"
      eyebrow="New officer account"
      title="Provision an officer"
      description="Officer accounts carry identity details a citizen sign-up never asks for. A temporary password is generated for you to hand over."
      onClose={onClose}
      busy={busy}
      size="wide"
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="officer-name">Full name</label>
            <input id="officer-name" name="name" value={form.name} onChange={change} required autoComplete="off" data-autofocus />
          </div>
          <div className="field">
            <label htmlFor="officer-email">Official email</label>
            <input
              id="officer-email"
              name="email"
              type="email"
              value={form.email}
              onChange={change}
              placeholder="officer@municipality.gov.in"
              required
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="officer-employee-id">Government / employee ID</label>
            <input
              id="officer-employee-id"
              name="employeeId"
              value={form.employeeId}
              onChange={change}
              placeholder="e.g. MCD-2024-0147"
              required
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="officer-designation">
              Designation <span className="muted">(optional)</span>
            </label>
            <input
              id="officer-designation"
              name="designation"
              value={form.designation}
              onChange={change}
              placeholder="e.g. Junior Engineer"
            />
          </div>
          <div className="field">
            <label htmlFor="officer-phone">
              Phone <span className="muted">(optional)</span>
            </label>
            <input id="officer-phone" name="phone" type="tel" value={form.phone} onChange={change} placeholder="+91 …" />
          </div>
          <div className="field">
            <label htmlFor="officer-department">Department</label>
            <select id="officer-department" name="departmentId" value={form.departmentId} onChange={change}>
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-accent" disabled={busy}>
            <KeyRound aria-hidden="true" />
            {busy ? "Creating…" : "Create and generate password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
