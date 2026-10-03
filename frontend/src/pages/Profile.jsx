import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    bio: "",
    ward: "",
    phone: "",
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] =
    useState(null);

  const [impact, setImpact] = useState(null);
  const [badges, setBadges] = useState([]);

  const [savingProfile, setSavingProfile] =
    useState(false);
  const [profileMessage, setProfileMessage] =
    useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] =
    useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [passwordMessage, setPasswordMessage] =
    useState("");
  const [passwordError, setPasswordError] =
    useState("");
  const [savingPassword, setSavingPassword] =
    useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        bio: user.bio || "",
        ward: user.ward || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (user?.role !== "CITIZEN") {
      return;
    }

    api
      .get("/dashboard/my-impact")
      .then((response) =>
        setImpact(response.data.impact)
      )
      .catch(() => {});

    api
      .get("/dashboard/my-badges")
      .then((response) =>
        setBadges(response.data.badges || [])
      )
      .catch(() => {});
  }, [user?.role]);

  const homePath =
    user?.role === "ADMIN"
      ? "/admin"
      : user?.role === "AUTHORITY"
        ? "/authority"
        : "/citizen";

  const initials = (user?.name || "?")
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleAvatarPick(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    setProfileError("");
    setProfileMessage("");
    setSavingProfile(true);

    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("bio", form.bio);
      data.append("ward", form.ward);
      data.append("phone", form.phone);

      if (avatarFile) {
        data.append("avatar", avatarFile);
      }

      const response = await api.patch(
        "/auth/profile",
        data
      );

      login(
        localStorage.getItem("civicfix_token"),
        response.data.user
      );

      setAvatarFile(null);
      setAvatarPreview(null);
      setProfileMessage("Profile updated ✓");
    } catch (error) {
      setProfileError(
        error.response?.data?.message ||
          "Unable to update the profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    setPasswordError("");
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "New password and confirmation do not match."
      );
      return;
    }

    setSavingPassword(true);

    try {
      await api.patch("/auth/password", {
        currentPassword,
        newPassword,
      });

      setPasswordMessage("Password changed ✓");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(
        error.response?.data?.message ||
          "Unable to change the password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function formatDate(date) {
    if (!date) {
      return "";
    }

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const earned = badges.filter((b) => b.earned);

  return (
    <div className="page">
      <div className="form-container profile-container">
        <div className="page-header">
          <div className="profile-back-row">
            <Link
              to={homePath}
              className="back-link"
            >
              <span aria-hidden="true">‹</span>
              Back to dashboard
            </Link>

            <Link to="/" className="back-link">
              <span aria-hidden="true">⌂</span>
              Home
            </Link>
          </div>
        </div>

        {/* Profile banner */}
        <section className="profile-hero">
          <div className="profile-avatar-wrap">
            {avatarPreview || user?.avatarUrl ? (
              <img
                className="profile-avatar"
                src={avatarPreview || user.avatarUrl}
                alt={user?.name}
              />
            ) : (
              <div className="profile-avatar profile-avatar-fallback">
                {initials}
              </div>
            )}

            <button
              type="button"
              className="avatar-edit"
              onClick={() => fileRef.current?.click()}
              aria-label="Change profile picture"
            >
              ✎
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarPick}
              hidden
            />
          </div>

          <div className="profile-hero-info">
            <h1>{user?.name}</h1>

            <p className="profile-email">
              {user?.email}
            </p>

            <div className="profile-chips">
              <span
                className={`role-badge role-${(user?.role || "citizen").toLowerCase()}`}
              >
                {user?.role}
              </span>

              {user?.role === "CITIZEN" &&
                typeof user?.points === "number" && (
                  <span className="points-chip profile-points">
                    ★ {user.points} civic points
                  </span>
                )}

              {user?.designation && (
                <span className="profile-meta-chip">
                  {user.designation}
                </span>
              )}

              {user?.department?.name && (
                <span className="profile-meta-chip">
                  {user.department.name}
                </span>
              )}

              {user?.employeeId && (
                <span className="profile-meta-chip">
                  ID: {user.employeeId}
                </span>
              )}

              {user?.createdAt && (
                <span className="profile-meta-chip">
                  Joined {formatDate(user.createdAt)}
                </span>
              )}
            </div>

            {user?.bio && (
              <p className="profile-bio">{user.bio}</p>
            )}
          </div>
        </section>

        {/* Citizen impact */}
        {user?.role === "CITIZEN" && impact && (
          <section className="stats-grid impact-grid">
            <div className="stat-card">
              <h2>{impact.totalReports}</h2>
              <p>Reports filed</p>
            </div>

            <div className="stat-card">
              <h2>{impact.resolved}</h2>
              <p>Fixed because of you</p>
            </div>

            <div className="stat-card">
              <h2>{impact.upvotesReceived}</h2>
              <p>Upvotes received</p>
            </div>
          </section>
        )}

        {/* Badges */}
        {user?.role === "CITIZEN" &&
          earned.length > 0 && (
            <section className="details-card">
              <p className="eyebrow">ACHIEVEMENTS</p>

              <h2>
                Badges earned ({earned.length}/
                {badges.length})
              </h2>

              <div className="badge-grid">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`badge-card ${badge.earned ? "" : "badge-locked"}`}
                    title={badge.description}
                  >
                    <span className="badge-icon">
                      {badge.icon}
                    </span>
                    <strong>{badge.name}</strong>
                    <small>{badge.description}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

        {/* Edit details */}
        <section className="details-card">
          <p className="eyebrow">EDIT</p>

          <h2>Profile details</h2>

          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label htmlFor="profile-name">
                Display name
              </label>

              <input
                id="profile-name"
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="profile-bio">
                About you
              </label>

              <textarea
                id="profile-bio"
                value={form.bio}
                onChange={(event) =>
                  setForm({
                    ...form,
                    bio: event.target.value,
                  })
                }
                rows={3}
                maxLength={280}
                placeholder="A line about you and the area you care about."
              />
            </div>

            <div className="location-fields">
              <div className="form-group">
                <label htmlFor="profile-ward">
                  Your ward / locality
                </label>

                <input
                  id="profile-ward"
                  type="text"
                  value={form.ward}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      ward: event.target.value,
                    })
                  }
                  placeholder="e.g. Gandhi Nagar (W-12)"
                />
              </div>

              <div className="form-group">
                <label htmlFor="profile-phone">
                  Phone
                </label>

                <input
                  id="profile-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value,
                    })
                  }
                  placeholder="+91 …"
                />
              </div>
            </div>

            {avatarFile && (
              <p className="detail-label">
                New picture selected: {avatarFile.name}
              </p>
            )}

            {profileError && (
              <div className="form-error">
                {profileError}
              </div>
            )}

            {profileMessage && (
              <div className="form-success">
                {profileMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
            >
              {savingProfile && (
                <span className="spinner" />
              )}
              {savingProfile
                ? "Saving…"
                : "Save changes"}
            </button>
          </form>
        </section>

        {/* Password */}
        <section className="details-card">
          <p className="eyebrow">SECURITY</p>

          <h2>Change password</h2>

          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="current-password">
                Current password
              </label>

              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(
                    event.target.value
                  )
                }
                required
              />
            </div>

            <div className="location-fields">
              <div className="form-group">
                <label htmlFor="new-password">
                  New password (min 8)
                </label>

                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  minLength={8}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">
                  Confirm new password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  minLength={8}
                  required
                />
              </div>
            </div>

            {passwordError && (
              <div className="form-error">
                {passwordError}
              </div>
            )}

            {passwordMessage && (
              <div className="form-success">
                {passwordMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword}
            >
              {savingPassword && (
                <span className="spinner" />
              )}
              {savingPassword
                ? "Changing…"
                : "Change password"}
            </button>
          </form>
        </section>

        <section className="details-card">
          <p className="eyebrow">SESSION</p>

          <h2>Sign out</h2>

          <p className="verification-intro">
            You will need to log in again to access
            your dashboard.
          </p>

          <button
            type="button"
            className="verification-danger-button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </button>
        </section>
      </div>
    </div>
  );
}
