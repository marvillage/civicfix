import { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function IssueChat({ issueId }) {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [allowed, setAllowed] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (!issueId) {
      return;
    }

    let cancelled = false;

    async function fetchMessages() {
      try {
        const response = await api.get(
          `/issues/${issueId}/messages`
        );

        if (!cancelled) {
          setMessages(response.data.messages || []);
          setAllowed(true);
        }
      } catch (error) {
        if (
          !cancelled &&
          error.response?.status === 403
        ) {
          setAllowed(false);
        }
      }
    }

    fetchMessages();

    const timer = setInterval(fetchMessages, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [issueId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop =
        listRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function handleSend(event) {
    event.preventDefault();

    if (!text.trim()) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await api.post(
        `/issues/${issueId}/messages`,
        { text: text.trim() }
      );

      setMessages((previous) => [
        ...previous,
        response.data.data,
      ]);

      setText("");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to send the message."
      );
    } finally {
      setSending(false);
    }
  }

  function formatTime(date) {
    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!allowed) {
    return null;
  }

  return (
    <section className="details-card chat-section">
      <h2>Private thread</h2>

      <p className="verification-intro">
        Only you and the assigned authority can see
        these messages — use it for directions,
        access details, or clarifications.
      </p>

      <div className="chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <p className="comments-empty">
            No messages yet.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-bubble ${
                message.sender?.id === user?.id
                  ? "chat-mine"
                  : ""
              }`}
            >
              <div className="chat-meta">
                <strong>
                  {message.sender?.id === user?.id
                    ? "You"
                    : message.sender?.name}
                </strong>
                <small>
                  {formatTime(message.createdAt)}
                </small>
              </div>

              <p>{message.text}</p>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="form-error">{error}</div>
      )}

      <form className="chat-form" onSubmit={handleSend}>
        <input
          type="text"
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder="Write a message…"
          maxLength={2000}
        />

        <button
          type="submit"
          disabled={sending || !text.trim()}
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}
