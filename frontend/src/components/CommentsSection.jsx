import { useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessagesSquare, Send } from "lucide-react";
import api from "../api/axios";
import { FEATURES } from "../brand";
import { useAuth } from "../context/auth";
import { ROLE_LABEL } from "./layout/navigation";
import { Avatar, Loading } from "./ui";
import { formatDateTime, timeAgo } from "../lib/format";

const MAX_LENGTH = 2000;

// Street Talk: the public comment thread under a case.
// Styles: styles/pages/issue.css.
export default function CommentsSection({ issueId }) {
  const { isAuthenticated, user, can } = useAuth();
  const location = useLocation();
  const headingId = useId();
  const fieldId = useId();

  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!issueId) {
      return undefined;
    }

    let cancelled = false;

    async function fetchComments() {
      try {
        const response = await api.get(`/issues/${issueId}/comments`);

        if (!cancelled) {
          setComments(response.data.comments || []);
        }
      } catch (fetchError) {
        console.error("Fetch comments error:", fetchError);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchComments();

    return () => {
      cancelled = true;
    };
  }, [issueId]);

  async function handleSubmit(event) {
    event.preventDefault();

    const body = text.trim();

    if (!body) {
      return;
    }

    setPosting(true);
    setError("");

    try {
      const response = await api.post(`/issues/${issueId}/comments`, {
        text: body,
      });

      if (response.data.comment) {
        setComments((previous) => [...previous, response.data.comment]);
      }

      setText("");
    } catch (postError) {
      setError(
        postError.response?.data?.message || "Couldn't post your comment."
      );
    } finally {
      setPosting(false);
    }
  }

  const canPost = isAuthenticated && can("issue:comment");

  return (
    <section className="card street-talk" aria-labelledby={headingId}>
      <div className="section-head">
        <div>
          <p className="eyebrow">{FEATURES.streetTalk}</p>
          <h2 id={headingId}>
            What people are saying
            {comments.length > 0 && (
              <span className="talk-count">{comments.length}</span>
            )}
          </h2>
          <p className="section-lede">
            Public thread. Neighbours, officers and admins can all reply.
          </p>
        </div>
      </div>

      {loading ? (
        <Loading label={`Loading ${FEATURES.streetTalk}…`} />
      ) : comments.length === 0 ? (
        <p className="talk-empty">
          <MessagesSquare aria-hidden="true" />
          Nobody has said anything yet. Start the thread.
        </p>
      ) : (
        <ol className="talk-list">
          {comments.map((comment) => {
            const role = comment.user?.role;
            const staff = role && role !== "CITIZEN";
            const mine = comment.user?.id && comment.user.id === user?.id;

            return (
              <li
                key={comment.id}
                className={`talk-item ${staff ? "is-staff" : ""}`}
              >
                <Avatar user={comment.user} size={36} />

                <div className="talk-body">
                  <div className="talk-meta">
                    <strong>
                      {comment.user?.name || "Someone"}
                      {mine && <span className="talk-you"> (you)</span>}
                    </strong>

                    {staff && (
                      <span className={`role-badge role-${role.toLowerCase()}`}>
                        {ROLE_LABEL[role] ?? role}
                      </span>
                    )}

                    <time
                      dateTime={comment.createdAt}
                      title={formatDateTime(comment.createdAt)}
                    >
                      {timeAgo(comment.createdAt)}
                    </time>
                  </div>

                  <p>{comment.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canPost ? (
        <form className="talk-form" onSubmit={handleSubmit}>
          <Avatar user={user} size={36} />

          <div className="talk-form-main">
            <label htmlFor={fieldId} className="sr-only">
              Add to {FEATURES.streetTalk}
            </label>

            <textarea
              id={fieldId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Reply as ${user?.name?.split(" ")[0] || "you"}…`}
              maxLength={MAX_LENGTH}
              rows={3}
            />

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <div className="talk-form-foot">
              <span className="field-hint">
                {text.length > MAX_LENGTH * 0.8
                  ? `${MAX_LENGTH - text.length} characters left`
                  : "Be specific and kind. Everyone can read this."}
              </span>

              <button
                type="submit"
                className="btn-sm"
                disabled={posting || !text.trim()}
              >
                <Send aria-hidden="true" />
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </form>
      ) : !isAuthenticated ? (
        <p className="talk-signin">
          <Link
            to="/login"
            state={{ from: location.pathname }}
            className="text-link"
          >
            Log in
          </Link>{" "}
          to join {FEATURES.streetTalk}.
        </p>
      ) : null}
    </section>
  );
}
