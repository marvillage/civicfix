import { useEffect, useId, useRef, useState } from "react";
import { Lock, MessageCircle, Send } from "lucide-react";
import api from "../api/axios";
import { FEATURES } from "../brand";
import { useAuth } from "../context/auth";
import { ROLE_LABEL } from "./layout/navigation";
import { formatDateTime, timeAgo } from "../lib/format";

const POLL_MS = 10000;

// Direct Line: private thread between the reporter and the assigned
// officer (admins can read it too). Hidden when the API says 403.
// Styles: styles/pages/issue.css.
export default function IssueChat({ issueId }) {
  const { user } = useAuth();
  const headingId = useId();
  const fieldId = useId();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [allowed, setAllowed] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (!issueId) {
      return undefined;
    }

    let cancelled = false;

    async function fetchMessages() {
      try {
        const response = await api.get(`/issues/${issueId}/messages`);

        if (!cancelled) {
          setMessages(response.data.messages || []);
          setAllowed(true);
        }
      } catch (fetchError) {
        if (!cancelled && fetchError.response?.status === 403) {
          setAllowed(false);
        }
      }
    }

    fetchMessages();

    const timer = setInterval(fetchMessages, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [issueId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function handleSend(event) {
    event.preventDefault();

    const body = text.trim();

    if (!body) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await api.post(`/issues/${issueId}/messages`, {
        text: body,
      });

      if (response.data.data) {
        setMessages((previous) => [...previous, response.data.data]);
      }

      setText("");
    } catch (sendError) {
      setError(
        sendError.response?.data?.message || "Couldn't send the message."
      );
    } finally {
      setSending(false);
    }
  }

  if (!allowed) {
    return null;
  }

  return (
    <section className="card direct-line" aria-labelledby={headingId}>
      <div className="section-head">
        <div>
          <p className="eyebrow">{FEATURES.directLine}</p>
          <h2 id={headingId}>Private thread</h2>
          <p className="section-lede direct-line-note">
            <Lock aria-hidden="true" />
            Only the reporter, the assigned officer and admins can read
            this. Use it for directions, gate codes or photos of access.
          </p>
        </div>
      </div>

      <div
        className="dl-list"
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={`${FEATURES.directLine} messages`}
        tabIndex={0}
      >
        {messages.length === 0 ? (
          <p className="dl-empty">
            <MessageCircle aria-hidden="true" />
            No messages yet. Say hello to the crew.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender?.id === user?.id;
            const role = message.sender?.role;

            return (
              <div
                key={message.id}
                className={`dl-msg ${mine ? "is-mine" : ""}`}
              >
                <div className="dl-meta">
                  <strong>{mine ? "You" : message.sender?.name || "Crew"}</strong>
                  {!mine && role && role !== "CITIZEN" && (
                    <span className="dl-role">{ROLE_LABEL[role] ?? role}</span>
                  )}
                  <time
                    dateTime={message.createdAt}
                    title={formatDateTime(message.createdAt)}
                  >
                    {timeAgo(message.createdAt)}
                  </time>
                </div>

                <p>{message.text}</p>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <form className="dl-form" onSubmit={handleSend}>
        <label htmlFor={fieldId} className="sr-only">
          Message
        </label>

        <input
          id={fieldId}
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          autoComplete="off"
        />

        <button
          type="submit"
          className="dl-send"
          disabled={sending || !text.trim()}
          aria-label="Send message"
        >
          <Send aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
