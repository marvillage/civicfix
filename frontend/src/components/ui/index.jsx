// Small presentational building blocks shared by every page.
// They only compose class names from styles/components.css.

import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import {
  CATEGORY_META,
  SEVERITY_LABEL,
  STATUS_LABEL,
  statusClass,
} from "../../lib/labels";
import { initials } from "../../lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-lede">{description}</p>}
        {children}
      </div>

      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="section-lede">{description}</p>}
      </div>

      {actions && <div className="section-actions">{actions}</div>}
    </div>
  );
}

export function Card({ as: Tag = "section", className = "", children, ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;

  return (
    <span className={statusClass(status)}>
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  if (!severity) return null;

  return (
    <span className={`severity-badge severity-${severity.toLowerCase()}`}>
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  );
}

export function CategoryChip({ category, short = false }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.OTHER;
  const Icon = meta.icon;

  return (
    <span className="category-chip">
      <span className={`cat-dot cat-${category}`} aria-hidden="true" />
      <Icon aria-hidden="true" />
      {short ? meta.short : meta.label}
    </span>
  );
}

export function Avatar({ user, size = 36 }) {
  const name = user?.name ?? "";

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" loading="lazy" />
      ) : (
        initials(name) || "?"
      )}
    </span>
  );
}

// KPI tile: label, value, optional delta and hint.
// `delta` is a signed number (percent); `upIsGood` decides its tone.
export function StatTile({
  label,
  value,
  hint,
  delta,
  upIsGood = true,
  icon: Icon,
  tone,
  to,
  children,
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const good = hasDelta && (delta >= 0) === upIsGood;

  const body = (
    <>
      <div className="stat-tile-top">
        <span className="stat-tile-label">{label}</span>
        {Icon && (
          <span className="stat-tile-icon" aria-hidden="true">
            <Icon />
          </span>
        )}
      </div>

      <strong className="stat-tile-value">{value}</strong>

      {(hasDelta || hint) && (
        <div className="stat-tile-foot">
          {hasDelta && (
            <span className={`delta ${good ? "delta-good" : "delta-bad"}`}>
              {delta >= 0 ? (
                <ArrowUpRight aria-hidden="true" />
              ) : (
                <ArrowDownRight aria-hidden="true" />
              )}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
          {hint && <span className="stat-tile-hint">{hint}</span>}
        </div>
      )}

      {children}
    </>
  );

  const className = `stat-tile ${tone ? `stat-tile-${tone}` : ""}`;

  return to ? (
    <Link to={to} className={`${className} stat-tile-link`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <Icon />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// Segmented control: [{ value, label, icon? }]
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? "is-active" : ""}
            onClick={() => onChange(option.value)}
          >
            {Icon && <Icon aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
