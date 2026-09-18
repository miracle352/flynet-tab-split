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
        <p className="text-sm text-zinc-500">
          {venues.length} of {totalCount} venues
        </p>
        {truncated ? (
          <p className="text-xs text-zinc-500">More venues not loaded</p>
        ) : null}
      </div>

      {venues.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
          No venues available yet.
        </p>
      ) : null}

      {venues.map(({ restaurant, locations }) => (
        <section
          key={restaurant.id}
          className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-start gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {initial(restaurant.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {restaurant.name}
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">
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
                className="shrink-0 text-sm text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Site
              </a>
            ) : null}
          </div>

          {locations.length === 0 ? (
            <p className="px-5 py-4 text-sm text-zinc-500">
              No locations listed for this restaurant.
            </p>
          ) : null}

          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {location.name ?? restaurant.name}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {location.neighborhood.name} ·{" "}
                      {location.neighborhood.region}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {street || "Address not listed"}
                    </p>
                    {location.payments_enabled ? null : (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                        Payments not enabled at this location
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-busy={busy}
                    onClick={() => handleCheckIn(location.id)}
                    className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
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
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
