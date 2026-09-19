"use client";

import { ClockIcon } from "./icons";
import { useNow } from "./TimeAgo";

/**
 * Counts a table's idle window down, in the venue's own time zone.
 *
 * When it reaches zero the table is on borrowed time: the next read of
 * the table list closes it and hands back anything that was paid.
 */
export function Countdown({
  expiresAt,
  timeZone,
  compact = false,
}: {
  expiresAt: string;
  timeZone?: string;
  compact?: boolean;
}) {
  const now = useNow();

  if (now === 0) {
    return <span className="tnum text-xs text-[var(--muted)]">…</span>;
  }

  const remaining = Date.parse(expiresAt) - now;

  if (remaining <= 0) {
    return (
      <span className="chip chip-idle">
        <ClockIcon size={13} />
        Closed
      </span>
    );
  }

  const totalMinutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const urgent = remaining < 10 * 60_000;

  const label =
    hours > 0
      ? `${hours}h ${String(minutes).padStart(2, "0")}m left`
      : `${minutes}:${String(seconds).padStart(2, "0")} left`;

  if (compact) {
    return (
      <span
        className="tnum text-[0.6875rem] font-medium"
        style={{ color: urgent ? "var(--pending)" : "var(--muted)" }}
        suppressHydrationWarning
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className="chip"
      style={{
        background: urgent ? "var(--pending-soft)" : "var(--surface-sunken)",
        color: urgent ? "var(--pending)" : "var(--muted)",
        borderColor: urgent
          ? "color-mix(in srgb, var(--pending) 26%, transparent)"
          : "var(--line)",
      }}
      title={
        timeZone
          ? `Closes automatically after going idle · ${timeZone}`
          : "Closes automatically after going idle"
      }
      suppressHydrationWarning
    >
      <ClockIcon size={13} />
      <span className="tnum">{label}</span>
    </span>
  );
}
