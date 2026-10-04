import { BRAND } from "../../brand";

// The mark: a yellow road-sign diamond with a navy check —
// "a street problem, signed off".
export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg
      className={`logo-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="5.4"
        y="5.4"
        width="21.2"
        height="21.2"
        rx="4.2"
        transform="rotate(45 16 16)"
        fill="#FFC629"
        stroke="#0A1730"
        strokeWidth="1.8"
      />
      <path
        d="M10.8 16.4l3.6 3.6 7-7.4"
        fill="none"
        stroke="#0A1730"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({ size = 30, className = "" }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark size={size} />
      <span className="logo-word">{BRAND.name}</span>
    </span>
  );
}
