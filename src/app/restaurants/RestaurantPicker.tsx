"use client";

import { useState } from "react";
import type { CheckIn } from "@/types";
import type { VenueOption } from "@/venues";
import { CheckInConfirmation } from "./CheckInConfirmation";

function priceTier(price: number | null): string {
  if (price === null || price <= 0) {
    return "—";
  }
  return "$".repeat(Math.min(price, 4));
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

interface RestaurantPickerProps {
  venues: VenueOption[];
  totalCount: number;
  truncated: boolean;
  initialCheckIn: CheckIn | null;
}

export function RestaurantPicker({
  venues,
  totalCount,
  truncated,
  initialCheckIn,
}: RestaurantPickerProps) {
  const [checkIn, setCheckIn] = useState<CheckIn | null>(initialCheckIn);
  const [picking, setPicking] = useState(initialCheckIn === null);
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleCheckIn(locationId: string) {
    setError(null);
    setPendingLocationId(locationId);
    try {
      const res = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Check-in failed");
      }
      const data = (await res.json()) as { check_in: CheckIn };
      setCheckIn(data.check_in);
      setPicking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setPendingLocationId(null);
    }
  }

  async function handleLeave() {
    setError(null);
    setPendingLocationId("__leave__");
    try {
      await fetch("/api/check-ins", { method: "DELETE" });
      setCheckIn(null);
      setPicking(true);
    } finally {
      setPendingLocationId(null);
    }
  }

  if (!picking && checkIn) {
    return (
      <CheckInConfirmation
        checkIn={checkIn}
        leaving={pendingLocationId === "__leave__"}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-[var(--muted)]">
          {venues.length} of {totalCount} venues
        </p>
        {truncated ? (
          <p className="text-xs text-[var(--muted)]">More venues not loaded</p>
        ) : null}
      </div>

      {venues.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--line-strong)] p-6 text-sm text-[var(--muted)]">
          No venues available yet.
        </p>
      ) : null}

      {venues.map(({ restaurant, locations }) => (
        <section
          key={restaurant.id}
          className="overflow-hidden card"
        >
          <div className="flex items-start gap-4 border-b border-[var(--line)] px-5 py-4">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-base font-semibold text-[var(--bg)]"
            >
              {initial(restaurant.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-[var(--ink)]">
                {restaurant.name}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {restaurant.cuisine.length > 0
                  ? restaurant.cuisine.join(" · ")
                  : "Cuisine not listed"}
                {"  ·  "}
                {priceTier(restaurant.price)}
              </p>
            </div>
            {restaurant.website_url ? (
              <a
                href={restaurant.website_url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sm text-[var(--muted)] underline decoration-[var(--line-strong)] underline-offset-4 hover:text-[var(--ink)]"
              >
                Site
              </a>
            ) : null}
          </div>

          {locations.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[var(--muted)]">
              No locations listed for this restaurant.
            </p>
          ) : null}

          <ul className="divide-y divide-[var(--line)]">
            {locations.map((location) => {
              const busy = pendingLocationId === location.id;
              const disabled =
                pendingLocationId !== null || !location.payments_enabled;
              const street = [
                location.address.street,
                location.address.city,
                location.address.state,
                location.address.zipcode,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <li
                  key={location.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {location.name ?? restaurant.name}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {location.neighborhood.name} ·{" "}
                      {location.neighborhood.region}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {street || "Address not listed"}
                    </p>
                    {location.payments_enabled ? null : (
                      <p className="mt-1 text-xs text-[var(--pending)]">
                        Payments not enabled at this location
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-busy={busy}
                    onClick={() => handleCheckIn(location.id)}
                    className="shrink-0 rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-sunken)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "Checking in…" : "Check in"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
