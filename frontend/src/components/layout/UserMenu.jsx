import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../../context/auth";
import usePopover from "./usePopover";
import { ThemeChooser } from "./ThemeToggle";
import { Avatar } from "../ui";
import { ROLE_LABEL } from "./navigation";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { open, toggle, close, rootRef, triggerRef } = usePopover();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    close();
    logout();
    navigate("/");
  }

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-chip"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
      >
        <Avatar user={user} size={32} />
        <span className="user-chip-text">
          <strong>{user.name}</strong>
          <span>{ROLE_LABEL[user.role] ?? user.role}</span>
        </span>
        <ChevronDown className="user-chip-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="popover popover-menu" role="menu">
          <div className="menu-identity">
            <Avatar user={user} size={40} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>

          <Link
            to="/profile"
            role="menuitem"
            className="menu-item"
            onClick={close}
          >
            <UserRound aria-hidden="true" />
            Profile &amp; settings
          </Link>

          <div className="menu-section">
            <span className="menu-label">Appearance</span>
            <ThemeChooser />
          </div>

          <button
            type="button"
            role="menuitem"
            className="menu-item menu-item-danger"
            onClick={handleLogout}
          >
            <LogOut aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
