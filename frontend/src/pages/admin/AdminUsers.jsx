import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const ROLES = ["CITIZEN", "AUTHORITY", "ADMIN"];

export default function AdminUsers() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    employeeId: "",
    designation: "",
    phone: "",
    departmentId: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [created, setCreated] = useState(null);

  async function fetchUsers() {
    try {
      const [usersRes, deptRes] = await Promise.all([
        api.get("/users"),
        api.get("/organization/departments"),
      ]);

      setUsers(usersRes.data.users || []);
      setDepartments(
        deptRes.data.departments || []
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleVerify(userId, verified) {
    setError("");
    setMessage("");

    try {
      const response = await api.patch(
        `/users/${userId}/verify`,
        { verified }
      );

      setMessage(response.data.message);

      setUsers((previous) =>
        previous.map((user) =>
          user.id === userId
            ? { ...user, isVerified: verified }
            : user
        )
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to update the account."
      );
    }
  }

  async function handleRoleChange(userId, role) {
    setError("");
    setMessage("");

    try {
      const response = await api.patch(
        `/users/${userId}/role`,
        { role }
      );

      setMessage(response.data.message);

      setUsers((previous) =>
        previous.map((user) =>
          user.id === userId
            ? { ...user, role }
            : user
        )
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to change the role."
      );
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    setCreateError("");
    setCreating(true);

    try {
      const response = await api.post(
        "/users/authority",
        {
          ...form,
          departmentId: form.departmentId || undefined,
        }
      );

      setCreated({
        user: response.data.user,
        tempPassword: response.data.tempPassword,
      });

      setForm({
        name: "",
        email: "",
        employeeId: "",
        designation: "",
        phone: "",
        departmentId: "",
      });

      fetchUsers();
    } catch (error) {
      setCreateError(
        error.response?.data?.message ||
          "Unable to create the authority account."
      );
    } finally {
      setCreating(false);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  const pending = users.filter(
    (user) => !user.isVerified
  );

  if (loading) {
    return (
      <div className="page">
        <h1>Users</h1>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header admin-dash-header">
        <div>
          <Link to="/admin">‹ Back to Admin</Link>

          <p className="eyebrow">RBAC</p>

          <h1>Users &amp; Roles</h1>

          <p>
            Manage who is a citizen, an authority, or
            an admin — and create authority accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreate((previous) => !previous);
            setCreated(null);
          }}
        >
          {showCreate
            ? "Close"
            : "+ New authority account"}
        </button>
      </div>

      {error && (
        <div className="form-error">{error}</div>
      )}

      {message && (
        <div className="form-success">{message}</div>
      )}

      {showCreate && (
        <section className="details-card">
          <h2>Create authority account</h2>

          <p className="verification-intro">
            Authority accounts are for municipal
            staff, so they carry extra identity
            details a citizen sign-up never asks for.
            A temporary password is generated and
            shown once — share it securely; the
            officer should change it from their
            Profile after first login.
          </p>

          {created ? (
            <div className="temp-password-box">
              <h3>
                Account for {created.user.name} created
              </h3>

              <p>
                Email:{" "}
                <strong>{created.user.email}</strong>
                <br />
                Employee ID:{" "}
                <strong>
                  {created.user.employeeId}
                </strong>
              </p>

              <p className="temp-password-label">
                Temporary password (shown only once):
              </p>

              <code className="temp-password">
                {created.tempPassword}
              </code>

              <div className="issue-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        created.tempPassword
                      );
                      setMessage(
                        "Password copied to clipboard"
                      );
                    } catch {
                      setMessage(
                        "Copy failed — note it down manually"
                      );
                    }
                  }}
                >
                  Copy password
                </button>

                <button
                  type="button"
                  onClick={() => setCreated(null)}
                >
                  Create another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <div className="location-fields">
                <div className="form-group">
                  <label htmlFor="auth-name">
                    Full name *
                  </label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="Officer's full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-email">
                    Official email *
                  </label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="officer@municipality.gov.in"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-employee-id">
                    Government / employee ID *
                  </label>
                  <input
                    id="auth-employee-id"
                    name="employeeId"
                    type="text"
                    value={form.employeeId}
                    onChange={handleFormChange}
                    placeholder="e.g. MCD-2024-0147"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-designation">
                    Designation
                  </label>
                  <input
                    id="auth-designation"
                    name="designation"
                    type="text"
                    value={form.designation}
                    onChange={handleFormChange}
                    placeholder="e.g. Junior Engineer"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-phone">
                    Phone
                  </label>
                  <input
                    id="auth-phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleFormChange}
                    placeholder="+91 …"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-department">
                    Department
                  </label>
                  <select
                    id="auth-department"
                    name="departmentId"
                    value={form.departmentId}
                    onChange={handleFormChange}
                  >
                    <option value="">
                      No department
                    </option>
                    {departments.map(
                      (department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {createError && (
                <div className="form-error">
                  {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
              >
                {creating
                  ? "Creating…"
                  : "Create account & generate password"}
              </button>
            </form>
          )}
        </section>
      )}

      {pending.length > 0 && (
        <section className="details-card pending-card">
          <p className="eyebrow">ACTION REQUIRED</p>

          <h2>
            Authority accounts awaiting approval (
            {pending.length})
          </h2>

          <p className="verification-intro">
            These people registered as municipal
            staff. Verify their government ID before
            approving — until you do, they cannot
            sign in.
          </p>

          <div className="stats-list">
            {pending.map((user) => (
              <div
                className="stats-list-item pending-row"
                key={user.id}
              >
                <span>
                  <strong>{user.name}</strong>
                  <small>
                    {user.email} · ID:{" "}
                    {user.employeeId || "—"}
                    {user.designation
                      ? ` · ${user.designation}`
                      : ""}
                    {user.department?.name
                      ? ` · ${user.department.name}`
                      : ""}
                  </small>
                </span>

                <span className="pending-actions">
                  <button
                    type="button"
                    onClick={() =>
                      handleVerify(user.id, true)
                    }
                  >
                    ✓ Approve
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="details-card">
        <h2>All users ({users.length})</h2>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Identity</th>
                <th>Activity</th>
                <th>Joined</th>
                <th>Change role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    {user.id === me?.id && " (you)"}
                    {!user.isVerified && (
                      <span className="pending-badge">
                        Pending
                      </span>
                    )}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span
                      className={`role-badge role-${user.role.toLowerCase()}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.role === "AUTHORITY" ? (
                      <>
                        {user.employeeId && (
                          <div>
                            ID: {user.employeeId}
                          </div>
                        )}
                        {user.designation && (
                          <div>
                            {user.designation}
                          </div>
                        )}
                        {user.department?.name && (
                          <div>
                            {user.department.name}
                          </div>
                        )}
                      </>
                    ) : user.role === "CITIZEN" ? (
                      `★ ${user.points}`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {user._count?.complaints || 0}{" "}
                    reports ·{" "}
                    {user._count?.assignments || 0}{" "}
                    assignments
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    {user.id === me?.id ? (
                      "—"
                    ) : (
                      <select
                        value={user.role}
                        onChange={(event) =>
                          handleRoleChange(
                            user.id,
                            event.target.value
                          )
                        }
                      >
                        {ROLES.map((role) => (
                          <option
                            key={role}
                            value={role}
                          >
                            {role}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
