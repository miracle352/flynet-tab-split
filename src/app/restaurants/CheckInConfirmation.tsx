import Link from "next/link";
import type { ReactNode } from "react";
import type { CheckIn } from "@/types";

/**
 * Confirmation shown after `checkIn()` resolves. Renders the raw
 * `CheckIn` object from Flynet rather than a reshaped DTO, so swapping
 * the mock for the live API changes nothing here.
 */

/**
 * Formats in the venue's own time zone. Server and client can disagree
 * on ICU output, so the caller marks the node `suppressHydrationWarning`.
 */
function formatAt(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-3">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[var(--ink)]">
        {children}
      </dd>
    </div>
  );
}

export function CheckInConfirmation({
  checkIn,
  leaving,
  onLeave,
}: {
  checkIn: CheckIn;
  leaving: boolean;
  onLeave: () => void;
}) {
  const { location } = checkIn;
  const street = [
    location.address.street,
    location.address.street2,
    location.address.city,
    location.address.state,
    location.address.zipcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="status"
      className="flex flex-col gap-6 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)]/60 p-6/30"
    >
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--bg)]"
          >
            ✓
          </span>
          You’re checked in
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
          {location.restaurant.name}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          {location.name ?? location.neighborhood.name} ·{" "}
          {location.neighborhood.name}, {location.neighborhood.region}
        </p>
      </div>

      <dl className="flex flex-col gap-3">
        <Row label="Checked in at">
          <span suppressHydrationWarning>
            {formatAt(checkIn.created_at, location.time_zone)}
          </span>
        </Row>
        <Row label="Time zone">{location.time_zone}</Row>
        <Row label="Address">{street || "Address not listed"}</Row>
        <Row label="Phone">{location.phone_number ?? "—"}</Row>
        <Row label="Blackbird Pay">
          {checkIn.blackbird_pay_enabled ? "Enabled" : "Not enabled"}
        </Row>
        <Row label="Table status">
          {checkIn.ended_at
            ? `Ended ${formatAt(checkIn.ended_at, location.time_zone)}`
            : "Open"}
        </Row>
      </dl>

      <p className="font-mono text-xs break-all text-[var(--muted)]">
        check-in {checkIn.id}
      </p>

      <p className="text-sm text-[var(--ink-soft)]">
        Next, split the bill — everyone at your table pays their share straight
        to the venue in FLY.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/split"
          className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90"
        >
          Split the bill
        </Link>
        <button
          type="button"
          onClick={onLeave}
          disabled={leaving}
          className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)] disabled:opacity-60"
        >
          {leaving ? "Leaving…" : "Check in somewhere else"}
        </button>
      </div>
    </div>
  );
}
