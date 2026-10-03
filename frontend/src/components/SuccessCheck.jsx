export default function SuccessCheck({
  title,
  message,
}) {
  return (
    <div className="success-overlay" role="status">
      <div className="success-card">
        <svg
          className="success-check"
          viewBox="0 0 56 56"
          aria-hidden="true"
        >
          <circle
            className="circle"
            cx="28"
            cy="28"
            r="26"
          />
          <path
            className="mark"
            d="M16 29.5l8 8 16-17"
          />
        </svg>

        <h2>{title}</h2>

        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
