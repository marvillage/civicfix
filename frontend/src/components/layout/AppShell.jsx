import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Camera, Menu, X } from "lucide-react";
import { useAuth } from "../../context/auth";
import { FEATURES } from "../../brand";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";
import { ROLE_LABEL, visibleGroups } from "./navigation";
import { Avatar, Loading } from "../ui";

// Signed-in workspace: navy sidebar (permission-driven) + topbar.
export default function AppShell() {
  const { user, can, homePath } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) return undefined;

    function onKey(event) {
      if (event.key === "Escape") setDrawerOpen(false);
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const groups = visibleGroups(user, can);

  const cta = can("issue:report")
    ? { to: "/citizen/report", label: `${FEATURES.snapSend}` }
    : can("field:report") && user?.role === "AUTHORITY"
      ? { to: "/authority/report", label: FEATURES.patrolLog }
      : null;

  return (
    <div className="app-shell" data-role={user?.role}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside
        className={`sidebar ${drawerOpen ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-top">
          <Link to={homePath} className="sidebar-brand">
            <Logo size={30} />
          </Link>

          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <X />
          </button>
        </div>

        <div className="sidebar-stripe" aria-hidden="true" />

        {cta && (
          <Link to={cta.to} className="btn btn-accent sidebar-cta">
            <Camera aria-hidden="true" />
            {cta.label}
          </Link>
        )}

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <p className="sidebar-group-label">{group.label}</p>

              <ul>
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? "is-active" : ""}`
                      }
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <Link to="/profile" className="sidebar-user">
          <Avatar user={user} size={36} />
          <span>
            <strong>{user?.name}</strong>
            <span>
              {ROLE_LABEL[user?.role] ?? user?.role}
              {user?.department?.name
                ? ` · ${user.department.name}`
                : user?.ward
                  ? ` · ${user.ward}`
                  : ""}
            </span>
          </span>
        </Link>
      </aside>

      <div
        className={`sidebar-scrim ${drawerOpen ? "is-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button topbar-menu"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu />
          </button>

          <Link to={homePath} className="topbar-brand">
            <Logo size={26} />
          </Link>

          <div className="topbar-spacer" />

          <div className="topbar-actions">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main id="main" className="app-content" tabIndex={-1}>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
