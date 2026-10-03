import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const response = await api.post(
        "/auth/register",
        form
      );

      const { token, user } = response.data;

      login(token, user);

      navigate("/citizen");
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Unable to create account. Please try again.";

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
            Every fixed street started with one
            report.
          </h2>

          <p>
            Earn civic points and badges, climb the
            ward leaderboard, and watch your
            neighbourhood actually improve.
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
            <h1>Join CivicFix</h1>

          <p>
            Create your account and start improving
            your community.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">
              Full Name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </div>

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
              placeholder="Create a password"
              minLength={6}
              required
            />
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
            {loading
              ? "Creating account..."
              : "Create Account"}
          </button>
        </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login">Sign in</Link>
          </p>

          <p className="auth-alt">
            Municipal staff?{" "}
            <Link to="/register/authority">
              Register as an authority
            </Link>{" "}
            — requires a government ID.
          </p>
        </div>
      </div>
    </div>
  );
}