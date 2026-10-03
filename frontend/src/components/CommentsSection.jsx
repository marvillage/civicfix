import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function CommentsSection({ issueId }) {
  const { isAuthenticated, user } = useAuth();

  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!issueId) {
      return;
    }

    let cancelled = false;

    async function fetchComments() {
      try {
        const response = await api.get(
          `/issues/${issueId}/comments`
        );

        if (!cancelled) {
          setComments(response.data.comments || []);
        }
      } catch (error) {
        console.error("Fetch comments error:", error);
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

    if (!text.trim()) {
      return;
    }

    setPosting(true);
    setError("");

    try {
      const response = await api.post(
        `/issues/${issueId}/comments`,
        { text: text.trim() }
      );

      setComments((previous) => [
        ...previous,
        response.data.comment,
      ]);

      setText("");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Unable to post the comment."
      );
    } finally {
      setPosting(false);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="details-card comments-section">
      <h2>
        Discussion{" "}
        {comments.length > 0 && (
          <span className="comments-count">
            {comments.length}
          </span>
        )}
      </h2>

      {loading ? (
        <p className="comments-empty">
          Loading comments…
        </p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="comment-item"
            >
              <div className="comment-avatar">
                {comment.user?.name
                  ?.charAt(0)
                  ?.toUpperCase() || "?"}
              </div>

              <div className="comment-body">
                <div className="comment-meta">
                  <strong>
                    {comment.user?.name || "Unknown"}
                  </strong>

                  {comment.user?.role !== "CITIZEN" && (
                    <span className="comment-role">
                      {comment.user?.role === "ADMIN"
                        ? "Admin"
                        : "Authority"}
                    </span>
                  )}

                  <small>
                    {formatDate(comment.createdAt)}
                  </small>
                </div>

                <p>{comment.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAuthenticated ? (
        <form
          className="comment-form"
          onSubmit={handleSubmit}
        >
          <textarea
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            placeholder={`Comment as ${user?.name || "you"}…`}
            maxLength={2000}
            rows={3}
          />

          {error && (
            <div className="form-error">{error}</div>
          )}

          <button
            type="submit"
            disabled={posting || !text.trim()}
          >
            {posting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="comments-login-hint">
          <Link to="/login" className="text-link">
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}
    </section>
  );
}
