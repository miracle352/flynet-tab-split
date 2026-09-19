"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon, CopyIcon, InfoIcon, XIcon } from "./icons";

/**
 * UI primitives. Everything here reads the design tokens, so retheming
 * is a token edit rather than a component sweep.
 */

export function Card({
  children,
  className = "",
  raised = false,
  sunken = false,
  pad = false,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  sunken?: boolean;
  pad?: boolean;
}) {
  return (
    <section
      className={[
        "card",
        raised ? "card-raised" : null,
        sunken ? "card-sunken" : null,
        pad ? "card-pad" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  hint,
  action,
  icon,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="icon-tile mt-0.5 size-8">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="title truncate">{title}</h2>
          {hint ? (
            <p className="mt-0.5 text-[0.8125rem] leading-5 text-[var(--muted)]">{hint}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type ChipTone = "accent" | "pending" | "idle" | "danger" | "info";

export function Chip({
  tone = "idle",
  children,
  dot = false,
}: {
  tone?: ChipTone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`chip chip-${tone}`}>
      {dot ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-80" />
      ) : null}
      {children}
    </span>
  );
}

/** Settlement progress — reads instantly at a glance. */
export function ProgressBar({
  paid,
  total,
  tone = "accent",
}: {
  paid: number;
  total: number;
  tone?: "accent" | "pending";
}) {
  const pct = total === 0 ? 0 : Math.round((paid / total) * 100);
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${paid} of ${total} shares paid`}
    >
      <div
        className="progress-fill"
        style={{
          width: `${pct}%`,
          background:
            tone === "pending"
              ? "linear-gradient(90deg, var(--pending), color-mix(in srgb, var(--pending) 70%, var(--gold)))"
              : undefined,
        }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "accent" | "danger";
}) {
  return (
    <div className="px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p
        className="tnum mt-1.5 text-xl font-semibold tracking-tight"
        style={{ color: tone === "accent" ? "var(--accent)" : tone === "danger" ? "var(--danger)" : undefined }}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--muted)]"
      >
        {icon ?? <InfoIcon size={20} />}
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-[0.8125rem] leading-5 text-[var(--muted)]">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function Note({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "pending" | "accent";
}) {
  const colors: Record<string, string> = {
    info: "var(--info-soft)",
    pending: "var(--pending-soft)",
    accent: "var(--accent-soft)",
  };
  return (
    <div
      className="flex gap-3 rounded-[var(--radius)] border border-[var(--line)] px-4 py-3 text-[0.8125rem] leading-6 text-[var(--ink-soft)]"
      style={{ background: colors[tone] }}
    >
      <InfoIcon size={16} className="mt-1 shrink-0 opacity-70" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Generated avatar: hue comes from the member record, so it is stable. */
export function Avatar({
  name,
  hue = 168,
  size = 40,
  ring = false,
}: {
  name: string;
  hue?: number;
  size?: number;
  ring?: boolean;
}) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(145deg, hsl(${hue} 62% 52%), hsl(${(hue + 34) % 360} 58% 38%))`,
        outline: ring ? "2px solid var(--surface)" : undefined,
        outlineOffset: ring ? "-2px" : undefined,
      }}
      aria-hidden="true"
    >
      {letters || "?"}
    </span>
  );
}

/** Tiny price chart. Pure SVG, no chart library. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  up = true,
  strokeWidth = 1.6,
  area = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  up?: boolean;
  strokeWidth?: number;
  area?: boolean;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - strokeWidth * 2) - strokeWidth;
    return [x, y] as const;
  });

  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const fill = `${line} L${width},${height} L0,${height} Z`;
  const color = up ? "var(--accent)" : "var(--danger)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      {area ? (
        <path d={fill} fill={color} opacity="0.14" />
      ) : null}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={strokeWidth + 0.9}
        fill={color}
      />
    </svg>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog from 640px up. */
export function Sheet({
  open,
  onClose,
  title,
  hint,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet-grab sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="title">{title}</h2>
            {hint ? <p className="mt-1 text-[0.8125rem] text-[var(--muted)]">{hint}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-quiet btn-sm !px-2"
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/** Click-to-copy field for addresses and invite links. */
export function CopyField({
  value,
  label,
  mono = true,
}: {
  value: string;
  label?: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-sunken)] px-3 py-2.5">
        <span
          className={`min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--ink-soft)] ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={copy}
          className="btn btn-quiet btn-sm !px-2 !py-1.5"
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        </button>
      </div>
    </div>
  );
}

export function KeyValue({
  label,
  children,
  strong = false,
}: {
  label: ReactNode;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[0.8125rem] text-[var(--muted)]">{label}</dt>
      <dd
        className={`tnum text-right text-[0.875rem] ${strong ? "font-semibold" : "font-medium"}`}
      >
        {children}
      </dd>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
