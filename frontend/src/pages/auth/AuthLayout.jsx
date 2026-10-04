import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { BRAND, FEATURES } from "../../brand";
import Logo from "../../components/layout/Logo";
import ThemeToggle from "../../components/layout/ThemeToggle";

// Split layout shared by log in, register and officer sign-up:
// an illustrated navy panel on the left, the form on the right.
// These pages are stand-alone (no app shell), so the layout brings
// its own slim header and footer. Styles: styles/pages/auth.css.
export default function AuthLayout({
  art,
  artPosition = "center",
  eyebrow,
  title,
  text,
  points = [],
  wide = false,
  children,
}) {
  return (
    <div className="auth">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="auth-art" aria-label={`About ${BRAND.name}`}>
        <img
          src={art}
          alt=""
          className="auth-art-img"
          style={{ objectPosition: artPosition }}
        />
        <span className="auth-art-shade" aria-hidden="true" />

        <Link to="/" className="auth-art-brand" aria-label={`${BRAND.name} home`}>
          <Logo size={32} />
        </Link>

        <div className="auth-art-caption">
          {eyebrow && <p className="auth-art-eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          {text && <p>{text}</p>}

          {points.length > 0 && (
            <ul className="auth-art-points">
              {points.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <span aria-hidden="true">
                    <Icon />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <span className="auth-art-stripe" aria-hidden="true" />
      </aside>

      <div className="auth-main">
        <header className="auth-top">
          <Link to="/" className="auth-top-brand" aria-label={`${BRAND.name} home`}>
            <Logo size={28} />
          </Link>

          <div className="auth-top-actions">
            <Link to="/" className="btn btn-ghost btn-sm auth-back">
              <ArrowLeft aria-hidden="true" />
              Back to {BRAND.name}
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main
          id="main"
          className={`auth-panel ${wide ? "is-wide" : ""}`}
          tabIndex={-1}
        >
          {children}
        </main>

        <footer className="auth-foot">
          <span>
            © {new Date().getFullYear()} {BRAND.name}
          </span>
          <nav aria-label="Explore">
            <Link to="/issues">{FEATURES.radar}</Link>
            <Link to="/pulse">{FEATURES.pulse}</Link>
            <Link to="/report">{FEATURES.quickDrop}</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

// Password input with a show/hide toggle.
export function PasswordField({
  id,
  label,
  value,
  onChange,
  hint,
  name = "password",
  ...rest
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>

      <div className="auth-pass">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...rest}
        />

        <button
          type="button"
          className="icon-button auth-pass-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>

      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}
