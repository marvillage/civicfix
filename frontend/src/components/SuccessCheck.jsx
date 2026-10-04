// Full-screen "done" confirmation with an animated check.
// `children` can add actions under the message.
// Styles: components.css (.success-*) + styles/pages/issue.css.
export default function SuccessCheck({ title, message, children }) {
  return (
    <div className="success-overlay" role="status" aria-live="polite">
      <div className="success-card">
        <span className="success-stripe" aria-hidden="true" />

        <svg
          className="success-check"
          viewBox="0 0 56 56"
          aria-hidden="true"
        >
          <circle className="circle" cx="28" cy="28" r="26" />
          <path className="mark" d="M16 29.5l8 8 16-17" />
        </svg>

        <h2>{title}</h2>

        {message && <p>{message}</p>}

        {children && <div className="success-actions">{children}</div>}
      </div>
    </div>
  );
}
