import { useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import api, { DEMO_MODE } from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [role, setRole] = useState("CITIZEN");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ROLES = [
    { value: "CITIZEN", label: "Citizen", icon: "👤" },
    { value: "AUTHORITY", label: "Authority", icon: "🛠" },
    { value: "ADMIN", label: "Admin", icon: "🛡" },
  ];

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // In demo mode the selected role picks which sample
    // account the email/password form signs into.
    await signIn(
      DEMO_MODE ? { ...form, demoRole: role } : form,
      role
    );
  }

  // Demo mode only: one-click sign-in as a sample account.
  function tryDemo(demoRole) {
    setRole(demoRole);
    signIn({ demoRole }, demoRole);
  }

  async function signIn(credentials, expectedRole) {
    setError("");
    setLoading(true);

    try {
      const response = await api.post(
        "/auth/login",
        credentials
      );

      const { token, user } = response.data;

      // The server is the authority on roles; this is a
      // guard so people land where they expect to.
      if (user.role !== expectedRole) {
        setError(
          `This account is registered as ${user.role.toLowerCase()}, not ${expectedRole.toLowerCase()}. Switch the role above and try again.`
        );
        setLoading(false);
        return;
      }

      login(token, user);

      if (user.role === "ADMIN") {
        navigate("/admin");
      } else if (user.role === "AUTHORITY") {
        navigate("/authority");
      } else {
        navigate("/citizen");
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Unable to login. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-art">
        <div className="auth-art-caption">
          <p className="auth-art-eyebrow">CIVICFIX</p>

          <h2>
            Your street. Your voice. Your fix.
          </h2>

          <p>
            Photos become tracked work orders with
            deadlines — and nothing closes until the
            citizen who reported it confirms the fix.
          </p>
        </div>
      </aside>

      <div className="auth-panel">
        <div className="auth-card">
          <Link to="/" className="auth-brand">
            <img
              className="brand-icon"
              src="/images/logo-icon.png"
              alt=""
            />
            CivicFix
          </Link>

          <div className="auth-header">
            <h1>Welcome back</h1>
            <p>
              Sign in to track and manage your civic
              issues.
            </p>
          </div>

          {DEMO_MODE && (
            <div className="demo-try">
              <p className="demo-try-title">
                Explore the demo — no sign-up needed
              </p>

              <div className="demo-try-buttons">
                {ROLES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="demo-try-button"
                    aria-label={`Try the demo as ${option.label}`}
                    disabled={loading}
                    onClick={() => tryDemo(option.value)}
                  >
                    <span
                      className="demo-try-icon"
                      aria-hidden="true"
                    >
                      {option.icon}
                    </span>
                    <span className="demo-try-label">
                      <small>Try as </small>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>

              <p className="demo-try-note">
                Runs on sample data recorded from a seeded
                CivicFix instance. Changes aren't saved.
              </p>
            </div>
          )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="form-group">
            <label>Sign in as</label>

            <div
              className="role-selector"
              role="radiogroup"
              aria-label="Select your role"
            >
              {ROLES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={role === option.value}
                  className={
                    role === option.value
                      ? "role-option active"
                      : "role-option"
                  }
                  onClick={() => {
                    setRole(option.value);
                    setError("");
                  }}
                >
                  <span className="role-option-icon">
                    {option.icon}
                  </span>
                  <span>{option.label}</span>
                  {role === option.value && (
                    <span className="role-check">
                      ✓
                    </span>
                  )}
                </button>
              ))}
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
            {loading && <span className="spinner" />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
          <p className="auth-switch">
            Don't have an account?{" "}
            <Link to="/register">Create one</Link>
          </p>

          <p className="auth-alt">
            In a hurry?{" "}
            <Link to="/report">
              Report anonymously
            </Link>{" "}
            — no account needed.
          </p>

          <p className="auth-alt">
            Municipal staff?{" "}
            <Link to="/register/authority">
              Register as an authority
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}