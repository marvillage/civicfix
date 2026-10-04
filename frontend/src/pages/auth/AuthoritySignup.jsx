import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Gauge,
  Route,
  Send,
  ShieldCheck,
  Timer,
} from "lucide-react";
import api from "../../api/axios";
import { BRAND, FEATURES } from "../../brand";
import AuthLayout, { PasswordField } from "./AuthLayout";

const ART = {
  art: "/images/control-room.png",
  artPosition: "30% center",
  eyebrow: `${BRAND.name} for officers`,
  points: [
    { icon: ClipboardList, label: `${FEATURES.crewQueue}, sorted by urgency` },
    { icon: Route, label: `${FEATURES.routeMap} for the day's jobs` },
    { icon: Timer, label: `Live ${FEATURES.fixClock} countdowns` },
    { icon: Gauge, label: `Your ${FEATURES.scorecard}` },
  ],
};

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
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    api
      .get("/organization/public-departments")
      .then((response) => setDepartments(response.data.departments || []))
      .catch(() => {});
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (form.password !== form.confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/register/authority", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        employeeId: form.employeeId.trim(),
        designation: form.designation.trim(),
        phone: form.phone.trim(),
        departmentId: form.departmentId || undefined,
      });

      setSubmitted({ message: response.data?.message || "" });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "Couldn't send your registration. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthLayout
        {...ART}
        title="Request received."
        text="Officer accounts are checked by a person before they go live."
      >
        <div className="auth-done">
          <svg className="success-check" viewBox="0 0 56 56" aria-hidden="true">
            <circle className="circle" cx="28" cy="28" r="26" />
            <path className="mark" d="M16 29.5l8 8 16-17" />
          </svg>

          <div className="auth-head">
            <p className="eyebrow">Officer sign-up</p>
            <h1>Registration sent</h1>
            <p>
              An administrator will check your government ID and approve the
              account. Logging in before then shows a "pending approval"
              message.
            </p>
          </div>

          {submitted.message && (
            <p className="form-info" role="status">
              {submitted.message}
            </p>
          )}

          <ol className="auth-next">
            <li>An admin checks your employee ID and department.</li>
            <li>You get an email as soon as you're approved.</li>
            <li>
              Log in and your {FEATURES.crewQueue} is waiting.
            </li>
          </ol>

          <Link to="/login" className="btn btn-accent btn-lg btn-block">
            Go to log in
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      {...ART}
      title="A control room for the people who do the work."
      text="Officers get an urgency-sorted queue, live deadlines, field reporting and a scorecard that shows the work they actually did."
      wide
    >
      <div className="auth-head">
        <p className="eyebrow">Officer sign-up</p>
        <h1>Join as a municipal officer</h1>
        <p>For municipal staff only. Residents should create a regular account.</p>
      </div>

      <div className="auth-notice" role="note">
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>Verified before first login.</strong> An admin checks your
          government ID first. Not staff?{" "}
          <Link to="/register" className="text-link">
            Create a resident account
          </Link>
          .
        </span>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="officer-name">Full name</label>
            <input
              id="officer-name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="As printed on your ID card"
              autoComplete="name"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="officer-email">Official email</label>
            <input
              id="officer-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="officer@municipality.gov.in"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="officer-id">Government or employee ID</label>
            <input
              id="officer-id"
              name="employeeId"
              type="text"
              value={form.employeeId}
              onChange={handleChange}
              placeholder="e.g. MCD-2026-0147"
              autoComplete="off"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="officer-designation">
              Designation <span className="auth-optional">(optional)</span>
            </label>
            <input
              id="officer-designation"
              name="designation"
              type="text"
              value={form.designation}
              onChange={handleChange}
              placeholder="e.g. Junior Engineer"
              autoComplete="organization-title"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="officer-phone">
              Work phone <span className="auth-optional">(optional)</span>
            </label>
            <input
              id="officer-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="+91 …"
              autoComplete="tel"
            />
          </div>

          <div className="field">
            <label htmlFor="officer-department">
              Department <span className="auth-optional">(optional)</span>
            </label>
            <select
              id="officer-department"
              name="departmentId"
              value={form.departmentId}
              onChange={handleChange}
            >
              <option value="">Select your department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <PasswordField
            id="officer-password"
            label="Password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <PasswordField
            id="officer-confirm"
            name="confirmPassword"
            label="Confirm password"
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-accent btn-lg btn-block"
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {loading ? "Sending…" : "Submit for verification"}
        </button>
      </form>

      <div className="auth-alt">
        <p>
          Already approved?{" "}
          <Link to="/login" className="text-link">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
