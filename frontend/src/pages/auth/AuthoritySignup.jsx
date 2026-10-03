import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function AuthoritySignup() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    employeeId: "",
    designation: "",
    phone: "",
    departmentId: "",
    password: "",
    confirmPassword: "",
  });

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api
      .get("/organization/public-departments")
      .then((response) =>
        setDepartments(
          response.data.departments || []
        )
      )
      .catch(() => {});
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register/authority", {
        name: form.name,
        email: form.email,
        password: form.password,
        employeeId: form.employeeId,
        designation: form.designation,
        phone: form.phone,
        departmentId: form.departmentId || undefined,
      });

      setSubmitted(true);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to submit the registration."
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="auth-page">
        <aside className="auth-art auth-art-authority">
          <div className="auth-art-caption">
            <p className="auth-art-eyebrow">
              CIVICFIX FOR STAFF
            </p>

            <h2>Request received.</h2>

            <p>
              Municipal accounts are verified before
              they go live.
            </p>
          </div>
        </aside>

        <div className="auth-panel">
          <div className="auth-card">
            <svg
              className="success-check"
              viewBox="0 0 56 56"
              aria-hidden="true"
              style={{ margin: "0 auto 16px" }}
            >
              <circle
                className="circle"
                cx="28"
                cy="28"
                r="26"
              />
              <path
                className="mark"
                d="M16 29.5l8 8 16-17"
              />
            </svg>

            <div className="auth-header">
              <h1>Registration submitted</h1>

              <p>
                An administrator will verify your
                government ID and approve the
                account. You will be able to sign in
                once it is approved — trying earlier
                will show a "pending approval"
                message.
              </p>
            </div>

            <Link to="/login">
              <button
                type="button"
                style={{ width: "100%" }}
              >
                Go to sign in
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <aside className="auth-art auth-art-authority">
        <div className="auth-art-caption">
          <p className="auth-art-eyebrow">
            CIVICFIX FOR STAFF
          </p>

          <h2>
            The control room for the people who do
            the work.
          </h2>

          <p>
            Municipal officers get an urgency-sorted
            queue with live SLA countdowns, field
            survey mode, progress updates and a
            performance scorecard.
          </p>
        </div>
      </aside>

      <div className="auth-panel">
        <div className="auth-card auth-card-wide">
          <Link to="/" className="auth-brand">
            <img
              className="brand-icon"
              src="/images/logo-icon.png"
              alt=""
            />
            CivicFix
          </Link>

          <div className="auth-header">
            <h1>Authority registration</h1>

            <p>
              For municipal staff only. Your
              government ID is verified by an admin
              before the account is activated.
            </p>
          </div>

          <div className="verify-notice">
            <strong>Verification required</strong>
            <span>
              Accounts stay pending until an
              administrator approves them. Citizens
              should{" "}
              <Link to="/register">
                register here
              </Link>{" "}
              instead.
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">
                Full name *
              </label>

              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="As printed on your ID card"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">
                Official email *
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="officer@municipality.gov.in"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="employeeId">
                Government / employee ID *
              </label>

              <input
                id="employeeId"
                name="employeeId"
                type="text"
                value={form.employeeId}
                onChange={handleChange}
                placeholder="e.g. MCD-2026-0147"
                required
              />
            </div>

            <div className="location-fields">
              <div className="form-group">
                <label htmlFor="designation">
                  Designation
                </label>

                <input
                  id="designation"
                  name="designation"
                  type="text"
                  value={form.designation}
                  onChange={handleChange}
                  placeholder="e.g. Junior Engineer"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">
                  Work phone
                </label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 …"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="departmentId">
                Department
              </label>

              <select
                id="departmentId"
                name="departmentId"
                value={form.departmentId}
                onChange={handleChange}
              >
                <option value="">
                  Select your department
                </option>

                {departments.map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="location-fields">
              <div className="form-group">
                <label htmlFor="password">
                  Password *
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">
                  Confirm password *
                </label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  minLength={8}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              {loading && (
                <span className="spinner" />
              )}
              {loading
                ? "Submitting…"
                : "Submit for verification"}
            </button>
          </form>

          <p className="auth-switch">
            Already approved?{" "}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
