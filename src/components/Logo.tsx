import { useId } from "react";

/**
 * Brand mark.
 *
 * A split bill drawn as an "F": one stem, two shares breaking away from
 * it, and the settled coin landing at the end. Reads at 16px in the tab
 * bar and at 64px on the sign-in screen.
 */
export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const gradient = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Flynet Tab Split"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16c79a" />
          <stop offset="52%" stopColor="#0a7d5a" />
          <stop offset="100%" stopColor="#04513c" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="12" fill={`url(#${gradient})`} />
      <rect
        x="0.6"
        y="0.6"
        width="38.8"
        height="38.8"
        rx="11.6"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="1.2"
      />

      {/* The stem of the F, with the two shares peeling off it. */}
      <path
        d="M13.6 10.4h12.9a1.9 1.9 0 0 1 0 3.8h-9.2v3.9h6.6a1.9 1.9 0 0 1 0 3.8h-6.6v6.9a1.9 1.9 0 0 1-3.8 0V12.3a1.9 1.9 0 0 1 .1-1.9Z"
        fill="#ffffff"
        fillOpacity="0.96"
      />
      {/* Settled coin. */}
      <circle cx="27.4" cy="27.2" r="3.6" fill="#ffffff" fillOpacity="0.85" />
      <path
        d="M27.4 25.4v3.6M25.9 26.6h3M25.9 28.1h3"
        stroke="#0a7d5a"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function Wordmark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[0.9375rem] font-semibold tracking-[-0.02em]">
          Flynet
        </span>
        <span className="mt-0.5 text-[0.6875rem] font-medium tracking-[0.14em] text-[var(--muted)] uppercase">
          Tab Split
        </span>
      </span>
    </span>
  );
}
