import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Camera, LayoutDashboard, Menu, X } from "lucide-react";
import { BRAND, FEATURES } from "../../brand";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { PUBLIC_LINKS } from "./navigation";
import { Loading } from "../ui";
import { useAuth } from "../../context/auth";

export function PublicHeader({ variant = "solid" }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { isAuthenticated, homePath } = useAuth();
  const [lastPath, setLastPath] = useState(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return undefined;

    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`public-header public-header-${variant}`}>
      <div className="public-header-inner">
        <Link to="/" className="public-brand" aria-label={`${BRAND.name} home`}>
          <Logo size={30} />
        </Link>

        <nav
          className={`public-nav ${open ? "is-open" : ""}`}
          aria-label="Primary"
        >
          {PUBLIC_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `public-link ${isActive ? "is-active" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}

          {!isAuthenticated && (
            <div className="public-nav-mobile-actions">
              <Link to="/login" className="btn btn-secondary btn-block">
                Log in
              </Link>
              <Link to="/register" className="btn btn-block">
                Create account
              </Link>
            </div>
          )}
        </nav>

        <div className="public-actions">
          <ThemeToggle />

          {isAuthenticated ? (
            <Link to={homePath} className="btn btn-accent public-report">
              <LayoutDashboard aria-hidden="true" />
              <span>Open workspace</span>
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost public-login">
                Log in
              </Link>

              <Link to="/report" className="btn btn-accent public-report">
                <Camera aria-hidden="true" />
                <span>Report an issue</span>
              </Link>
            </>
          )}

          <button
            type="button"
            className="icon-button public-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-stripe" aria-hidden="true" />

      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Logo size={34} />
          <p>{BRAND.tagline}</p>
          <p className="site-footer-note">
            Civic issues, tracked in public from the first photo to
            the citizen's sign-off.
          </p>
        </div>

        <div className="site-footer-cols">
          <div>
            <h4>Report</h4>
            <Link to="/report">{FEATURES.quickDrop}</Link>
            <Link to="/register">Create an account</Link>
            <Link to="/issues">{FEATURES.radar}</Link>
          </div>

          <div>
            <h4>Community</h4>
            <Link to="/bulletins">{FEATURES.bulletins}</Link>
            <Link to="/polls">{FEATURES.wardVote}</Link>
            <Link to="/drives">{FEATURES.drives}</Link>
          </div>

          <div>
            <h4>Transparency</h4>
            <Link to="/pulse">{FEATURES.pulse}</Link>
            <Link to="/register/authority">Officer sign-up</Link>
            <Link to="/login">Staff log in</Link>
          </div>
        </div>
      </div>

      <div className="site-footer-base">
        <span>
          © {new Date().getFullYear()} {BRAND.name}
        </span>
        <span>Open data · Fictional demo city</span>
      </div>
    </footer>
  );
}

// Signed-out pages: header, content, footer.
export default function PublicShell() {
  return (
    <div className="public-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <PublicHeader />

      <main id="main" className="public-content" tabIndex={-1}>
        <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
