import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  HardHat,
  LogIn,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react";
import api, { DEMO_MODE } from "../../api/axios";
import { BRAND, FEATURES } from "../../brand";
import { HOME_BY_ROLE, useAuth } from "../../context/auth";
import { ROLE_LABEL } from "../../components/layout/navigation";
import AuthLayout, { PasswordField } from "./AuthLayout";

const DEMO_ROLES = [
  {
    role: "CITIZEN",
    icon: UserRound,
    blurb: "Report and back cases",
  },
  {
    role: "AUTHORITY",
    icon: HardHat,
    blurb: `Work the ${FEATURES.crewQueue}`,
  },
  {
    role: "ADMIN",
    icon: ShieldCheck,
    blurb: `Run the ${FEATURES.commandDeck}`,
  },
];

// Where to go after logging in: the page that sent us here, if any.
function returnPath(state) {
  const from = state?.from;
  const path =
    typeof from === "string"
      ? from
      : from?.pathname
        ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
        : null;

  return path && !/^\/(login|register)/.test(path) ? path : null;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(null); // "form" | role | null
  const [demoAccounts, setDemoAccounts] = useState(null);

  // Sample account names for the demo buttons (demo code only loads
  // in demo mode).
  useEffect(() => {
    if (!DEMO_MODE) return undefined;

    let cancelled = false;

    import("../../demo/demoAdapter.js")
      .then((module) => {
        if (!cancelled) setDemoAccounts(module.demoAccounts ?? null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function signIn(credentials, mode) {
    setError("");
    setLoading(mode);

    try {
      const response = await api.post("/auth/login", credentials);
      const { token, user } = response.data;

      login(token, user);
      navigate(
        returnPath(location.state) || HOME_BY_ROLE[user.role] || "/",
        { replace: true }
      );
    } catch (loginError) {
      setError(
        loginError.response?.data?.message ||
          "Couldn't log you in. Check your details and try again."
      );
      setLoading(null);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    signIn({ email: form.email.trim(), password: form.password }, "form");
  }

  return (
    <AuthLayout
      art="/images/report-dusk.png"
      artPosition="center 60%"
      eyebrow={`Welcome back to ${BRAND.name}`}
      title="Your street. Your report. Your sign-off."
      text="Every photo becomes a tracked case with a deadline, and nothing closes until the person who reported it says it's fixed."
      points={[
        { icon: Camera, label: `${FEATURES.snapSend} in thirty seconds` },
        { icon: Timer, label: `A ${FEATURES.fixClock} on every case` },
        { icon: BadgeCheck, label: `Closed only on your ${FEATURES.signOff}` },
      ]}
    >
      <div className="auth-head">
        <p className="eyebrow">Log in</p>
        <h1>Welcome back</h1>
        <p>Follow your cases, back your neighbours' and keep crews on the clock.</p>
      </div>

      {DEMO_MODE && (
        <section className="auth-demo" aria-labelledby="auth-demo-title">
          <div className="auth-demo-head">
            <span className="auth-demo-badge">
              <Sparkles aria-hidden="true" />
              Demo
            </span>
            <h2 id="auth-demo-title">Explore without signing up</h2>
            <p>
              Pick a role. It all runs on recorded sample data and nothing
              you change is saved.
            </p>
          </div>

          <div className="auth-demo-roles">
            {DEMO_ROLES.map(({ role, icon: Icon, blurb }) => {
              const account = demoAccounts?.[role];
              const who = account?.name
                ? `${account.name}${account.designation ? `, ${account.designation}` : ""}`
                : null;

              return (
                <button
                  key={role}
                  type="button"
                  className="auth-demo-role"
                  onClick={() => signIn({ demoRole: role }, role)}
                  disabled={!!loading}
                  aria-label={`Try the demo as ${ROLE_LABEL[role]}${who ? ` (${who})` : ""}`}
                >
                  <span
                    className={`auth-demo-icon auth-demo-${role.toLowerCase()}`}
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>

                  <span className="auth-demo-text">
                    <strong>{ROLE_LABEL[role]}</strong>
                    <span>{who ? `${who} · ${blurb}` : blurb}</span>
                  </span>

                  {loading === role ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="auth-demo-go" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {DEMO_MODE && (
        <div className="auth-divider">
          <span>or log in with email</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <PasswordField
          id="login-password"
          label="Password"
          value={form.password}
          onChange={handleChange}
          placeholder="Your password"
          autoComplete="current-password"
          required
        />

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-accent btn-lg btn-block"
          disabled={!!loading}
        >
          {loading === "form" ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <LogIn aria-hidden="true" />
          )}
          {loading === "form" ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="auth-alt">
        <p>
          New to {BRAND.name}?{" "}
          <Link to="/register" state={location.state} className="text-link">
            Create an account
          </Link>
        </p>
        <p>
          In a hurry?{" "}
          <Link to="/report" className="text-link">
            {FEATURES.quickDrop}
          </Link>{" "}
          files a report without an account.
        </p>
        <p>
          Municipal staff?{" "}
          <Link to="/register/authority" className="text-link">
            Officer sign-up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
