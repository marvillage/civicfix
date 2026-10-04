// Small helpers shared by the admin workspace pages (Case Desk,
// Dispatch, Fix Clock, Access Control, Paper Trail, Budgets).
// Page-specific styling lives in styles/pages/admin.css.

import { CircleAlert, CircleCheck, X } from "lucide-react";

// Page-level result banner. `notice` = { tone: "success" | "error", text }
export function Notice({ notice, onDismiss }) {
  if (!notice?.text) return null;

  const success = notice.tone !== "error";
  const Icon = success ? CircleCheck : CircleAlert;

  return (
    <div
      className={`${success ? "form-success" : "form-error"} admin-notice`}
      role={success ? "status" : "alert"}
    >
      <Icon aria-hidden="true" />
      <span>{notice.text}</span>
      {onDismiss && (
        <button
          type="button"
          className="icon-button admin-notice-close"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
