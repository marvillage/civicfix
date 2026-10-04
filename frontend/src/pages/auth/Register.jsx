import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BellRing,
  ClipboardList,
  LocateFixed,
  Trophy,
  UserPlus,
} from "lucide-react";
import api from "../../api/axios";
import { BRAND, FEATURES } from "../../brand";
import { HOME_BY_ROLE, useAuth } from "../../context/auth";
import AuthLayout, { PasswordField } from "./AuthLayout";

// Citizen accounts only; officers use /register/authority.
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/register", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      const { token, user } = response.data;
      const from =
        typeof location.state?.from === "string" ? location.state.from : null;

      login(token, user);
      navigate(from || HOME_BY_ROLE[user?.role] || "/citizen", {
        replace: true,
      });
    } catch (registerError) {
      setError(
        registerError.response?.data?.message ||
          "Couldn't create your account. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      art="/images/community.png"
      artPosition="28% center"
      eyebrow={`Join ${BRAND.name}`}
      title="Every fixed street started with one report."
      text="A free account turns one-off complaints into cases you can follow, back and sign off."
      points={[
        { icon: ClipboardList, label: `${FEATURES.myCases}: every report, one place` },
        { icon: BellRing, label: "Updates the moment a crew moves" },
        { icon: LocateFixed, label: `${FEATURES.watchZones} around home and school` },
        { icon: Trophy, label: `${FEATURES.civicCred} for reports, votes and drives` },
      ]}
    >
      <div className="auth-head">
        <p className="eyebrow">Create an account</p>
        <h1>Join your neighbours</h1>
        <p>
          Free for residents. Takes under a minute, and your first report can
          follow straight after.
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="As you'd like neighbours to see it"
            autoComplete="name"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
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
          id="register-password"
          label="Password"
          value={form.password}
          onChange={handleChange}
          placeholder="Create a password"
          autoComplete="new-password"
          minLength={6}
          hint="At least 6 characters."
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
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          {loading ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <div className="auth-alt">
        <p>
          Already have an account?{" "}
          <Link to="/login" state={location.state} className="text-link">
            Log in
          </Link>
        </p>
        <p>
          Municipal staff?{" "}
          <Link to="/register/authority" className="text-link">
            Officer sign-up
          </Link>{" "}
          needs a government ID.
        </p>
      </div>
    </AuthLayout>
  );
}
