import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import api from "../../api/axios";
import usePopover from "./usePopover";
import { timeAgo } from "../../lib/format";

const POLL_MS = 60_000;

// Topbar alerts: unread count on the bell, latest items in a panel.
export default function NotificationBell() {
  const { open, toggle, rootRef, triggerRef } = usePopover();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/notifications");
      setItems(response.data.notifications || []);
    } catch {
      // Keep whatever we had; the bell is not critical.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // State is only set once the request resolves.
    async function poll() {
      await load();
    }

    poll();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [load]);

  const unread = items.filter((item) => !item.isRead).length;

  async function markRead(id) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, isRead: true } : item
      )
    );

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      load();
    }
  }

  async function markAll() {
    setItems((current) =>
      current.map((item) => ({ ...item, isRead: true }))
    );

    try {
      await api.patch("/notifications/read-all");
    } catch {
      load();
    }
  }

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button bell-button"
        aria-label={
          unread ? `Alerts, ${unread} unread` : "Alerts"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Bell />
        {unread > 0 && (
          <span className="bell-count" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="popover popover-alerts"
          role="dialog"
          aria-label="Alerts"
        >
          <div className="popover-head">
            <strong>Alerts</strong>

            {unread > 0 && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={markAll}
              >
                <CheckCheck aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <ul className="alert-list">
            {!loaded && <li className="alert-empty">Loading…</li>}

            {loaded && items.length === 0 && (
              <li className="alert-empty">
                You're all caught up.
              </li>
            )}

            {items.slice(0, 12).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`alert-item ${item.isRead ? "" : "is-unread"}`}
                  onClick={() => !item.isRead && markRead(item.id)}
                >
                  <span className="alert-dot" aria-hidden="true" />
                  <span className="alert-body">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <time dateTime={item.createdAt}>
                      {timeAgo(item.createdAt)}
                    </time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
