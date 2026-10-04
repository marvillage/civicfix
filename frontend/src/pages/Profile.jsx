import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Camera,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  IdCard,
  KeyRound,
  Mail,
  MapPin,
  Palette,
  Phone,
  Save,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import api from "../api/axios";
import { BRAND, FEATURES } from "../brand";
import { useAuth } from "../context/auth";
import { ThemeChooser } from "../components/layout/ThemeToggle";
import { ROLE_LABEL } from "../components/layout/navigation";
import { Avatar, PageHeader, SectionHeader } from "../components/ui";
import { formatDate, formatNumber } from "../lib/format";
import { BadgeGrid } from "./CaseKit";

const BIO_MAX = 280;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);
  const isCitizen = user?.role === "CITIZEN";

  const [form, setForm] = useState({
    name: user?.name || "",
    bio: user?.bio || "",
    ward: user?.ward || "",
    phone: user?.phone || "",
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [impact, setImpact] = useState(null);
  const [badges, setBadges] = useState([]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Keep the form in step with the signed-in user (e.g. after /auth/me).
  const [syncedId, setSyncedId] = useState(user?.id);

  if (user && user.id !== syncedId) {
    setSyncedId(user.id);
    setForm({
      name: user.name || "",
      bio: user.bio || "",
      ward: user.ward || "",
      phone: user.phone || "",
    });
  }

  useEffect(() => {
    if (!isCitizen) return undefined;

    let cancelled = false;

    api
      .get("/dashboard/my-impact")
      .then((response) => !cancelled && setImpact(response.data.impact))
      .catch(() => {});

    api
      .get("/dashboard/my-badges")
      .then((response) => !cancelled && setBadges(response.data.badges || []))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isCitizen]);

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview]
  );

  function handleAvatarPick(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setProfileMessage("");
    event.target.value = "";
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    setProfileError("");
    setProfileMessage("");
    setSavingProfile(true);

    try {
      const data = new FormData();
      data.append("name", form.name.trim());
      data.append("bio", form.bio);
      data.append("ward", form.ward);
      data.append("phone", form.phone);

      if (avatarFile) {
        data.append("avatar", avatarFile);
      }

      const response = await api.patch("/auth/profile", data);

      if (response.data.user) {
        updateUser(response.data.user);
      }

      setAvatarFile(null);
      setAvatarPreview(null);
      setProfileMessage("Profile saved.");
    } catch (saveError) {
      setProfileError(
        saveError.response?.data?.message || "Unable to update your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for the new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The new password and its confirmation don't match.");
      return;
    }

    setSavingPassword(true);

    try {
      await api.patch("/auth/password", { currentPassword, newPassword });

      setPasswordMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (passwordFailure) {
      setPasswordError(
        passwordFailure.response?.data?.message ||
          "Unable to change the password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  const earned = badges.filter((badge) => badge.earned).length;
  const roleLabel = ROLE_LABEL[user?.role] ?? user?.role ?? "";
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="page account">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description={`How you appear to crews and neighbours, and how ${BRAND.name} looks for you.`}
      />

      <div className="acct-layout">
        <aside className="card acct-id" aria-label="Your identity">
          <div className="acct-cover" aria-hidden="true" />

          <div className="acct-avatar">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="acct-avatar-img" />
            ) : (
              <Avatar user={user} size={96} />
            )}

            <button
              type="button"
              className="acct-avatar-edit"
              onClick={() => fileRef.current?.click()}
              aria-label="Change profile picture"
              title="Change profile picture"
            >
              <Camera aria-hidden="true" />
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarPick}
              hidden
            />
          </div>

          <div className="acct-name">
            <h2>{user?.name}</h2>
            <p>
              <Mail aria-hidden="true" />
              {user?.email}
            </p>
          </div>

          {avatarFile && (
            <p className="acct-pending">
              New picture selected. Save your details to apply it.
            </p>
          )}

          <div className="acct-chips">
            <span
              className={`role-badge role-${(user?.role || "citizen").toLowerCase()}`}
            >
              {roleLabel}
            </span>
            {user?.designation && <span className="chip">{user.designation}</span>}
          </div>

          {user?.bio && <p className="acct-bio">{user.bio}</p>}

          <dl className="acct-facts">
            {user?.department?.name && (
              <div>
                <dt>
                  <Building2 aria-hidden="true" />
                  Department
                </dt>
                <dd>{user.department.name}</dd>
              </div>
            )}
            {user?.employeeId && (
              <div>
                <dt>
                  <IdCard aria-hidden="true" />
                  Employee ID
                </dt>
                <dd className="mono">{user.employeeId}</dd>
              </div>
            )}
            {user?.ward && (
              <div>
                <dt>
                  <MapPin aria-hidden="true" />
                  Ward
                </dt>
                <dd>{user.ward}</dd>
              </div>
            )}
            {user?.phone && (
              <div>
                <dt>
                  <Phone aria-hidden="true" />
                  Phone
                </dt>
                <dd>{user.phone}</dd>
              </div>
            )}
            {user?.createdAt && (
              <div>
                <dt>
                  <CalendarDays aria-hidden="true" />
                  Joined
                </dt>
                <dd>{formatDate(user.createdAt, { day: undefined })}</dd>
              </div>
            )}
          </dl>

          {isCitizen && (
            <div className="acct-cred">
              <div className="acct-cred-head">
                <span className="eyebrow">{FEATURES.civicCred}</span>
                <strong>
                  {formatNumber(user?.points ?? 0)}
                  <span> points</span>
                </strong>
              </div>

              {impact && (
                <ul className="acct-footprint" aria-label={FEATURES.footprint}>
                  <li>
                    <ClipboardList aria-hidden="true" />
                    <strong>{formatNumber(impact.totalReports ?? 0)}</strong>
                    <span>reports</span>
                  </li>
                  <li>
                    <CircleCheck aria-hidden="true" />
                    <strong>{formatNumber(impact.resolved ?? 0)}</strong>
                    <span>fixed</span>
                  </li>
                  <li>
                    <ThumbsUp aria-hidden="true" />
                    <strong>{formatNumber(impact.upvotesReceived ?? 0)}</strong>
                    <span>backers</span>
                  </li>
                </ul>
              )}

              {badges.length > 0 && (
                <>
                  <p className="acct-badge-count">
                    <BadgeCheck aria-hidden="true" />
                    {earned} of {badges.length} badges earned
                  </p>
                  <BadgeGrid badges={badges} compact />
                </>
              )}
            </div>
          )}
        </aside>

        <div className="acct-main">
          <section className="card" aria-labelledby="details-title">
            <SectionHeader
              eyebrow="Details"
              title={
                <span id="details-title" className="acct-title">
                  <UserRound aria-hidden="true" />
                  Profile details
                </span>
              }
              description="Your name and photo show on your reports, Street Talk replies and the leaderboard."
            />

            <form onSubmit={handleProfileSubmit}>
              <div className="field">
                <label htmlFor="profile-name">Display name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="profile-bio">About you</label>
                <textarea
                  id="profile-bio"
                  value={form.bio}
                  onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  rows={3}
                  maxLength={BIO_MAX}
                  placeholder="A line about you and the streets you care about."
                  aria-describedby="profile-bio-count"
                />
                <span id="profile-bio-count" className="field-hint acct-count">
                  {form.bio.length}/{BIO_MAX}
                </span>
              </div>

              <div className="form-row">
                <div className="field">
                  <label htmlFor="profile-ward">Ward or locality</label>
                  <input
                    id="profile-ward"
                    type="text"
                    value={form.ward}
                    onChange={(event) => setForm({ ...form, ward: event.target.value })}
                    placeholder="e.g. Gandhi Nagar (W-12)"
                  />
                </div>

                <div className="field">
                  <label htmlFor="profile-phone">Phone</label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+91 …"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {profileError && (
                <div className="form-error" role="alert">
                  {profileError}
                </div>
              )}

              {profileMessage && (
                <div className="form-success" role="status">
                  {profileMessage}
                </div>
              )}

              <button type="submit" disabled={savingProfile}>
                {savingProfile ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                {savingProfile ? "Saving…" : "Save details"}
              </button>
            </form>
          </section>

          <section className="card" aria-labelledby="password-title">
            <SectionHeader
              eyebrow="Security"
              title={
                <span id="password-title" className="acct-title">
                  <KeyRound aria-hidden="true" />
                  Change password
                </span>
              }
            />

            <form onSubmit={handlePasswordSubmit}>
              <div className="field">
                <label htmlFor="current-password">Current password</label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    aria-describedby="new-password-hint"
                    required
                  />
                  <span id="new-password-hint" className="field-hint">
                    At least 8 characters.
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                  {passwordsMatch && (
                    <span className="field-hint acct-match">
                      <CircleCheck aria-hidden="true" />
                      Matches
                    </span>
                  )}
                </div>
              </div>

              {passwordError && (
                <div className="form-error" role="alert">
                  {passwordError}
                </div>
              )}

              {passwordMessage && (
                <div className="form-success" role="status">
                  {passwordMessage}
                </div>
              )}

              <button type="submit" className="btn-secondary" disabled={savingPassword}>
                {savingPassword ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <KeyRound aria-hidden="true" />
                )}
                {savingPassword ? "Changing…" : "Change password"}
              </button>
            </form>
          </section>

          <section className="card" aria-labelledby="appearance-title">
            <SectionHeader
              eyebrow="Appearance"
              title={
                <span id="appearance-title" className="acct-title">
                  <Palette aria-hidden="true" />
                  Theme
                </span>
              }
              description="Light, dark, or follow your device. Saved on this browser."
            />

            <div className="acct-theme">
              <ThemeChooser />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
