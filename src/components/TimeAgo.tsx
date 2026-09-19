"use client";

import { useSyncExternalStore } from "react";
import {
  getClockSnapshot,
  getServerClockSnapshot,
  subscribeClock,
} from "./clock";

/**
 * Relative time.
 *
 * The server has no idea when the browser will hydrate, so the first
 * paint shows a placeholder and the real value arrives from the shared
 * clock: no hydration mismatch, no per-component timer.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);
}

function describe(diffMs: number): string {
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (minutes < 60 * 24) {
    return `${Math.round(minutes / 60)}h ago`;
  }
  return `${Math.round(minutes / 1440)}d ago`;
}

export function TimeAgo({
  iso,
  className = "",
  fallback = "-",
}: {
  iso: string | null;
  className?: string;
  fallback?: string;
}) {
  const now = useNow();

  if (!iso || now === 0) {
    return <span className={className}>{fallback}</span>;
  }

  const target = Date.parse(iso);
  if (Number.isNaN(target)) {
    return <span className={className}>{fallback}</span>;
  }

  const diff = now - target;
  if (diff < 60 * 60 * 24 * 7 * 1000) {
    return (
      <span className={className} suppressHydrationWarning>
        {describe(diff)}
      </span>
    );
  }

  return (
    <span className={className} suppressHydrationWarning>
      {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
        new Date(target),
      )}
    </span>
  );
}

/** Wall-clock time in a named time zone: venue-local timestamps. */
export function LocalTime({
  iso,
  timeZone,
  className = "",
}: {
  iso: string | null;
  timeZone?: string;
  className?: string;
}) {
  const now = useNow();

  if (!iso || now === 0) {
    return <span className={className}>-</span>;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return <span className={className}>{iso}</span>;
  }

  let text: string;
  try {
    text = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    text = date.toLocaleString();
  }

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
