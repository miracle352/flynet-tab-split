"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, Card, Chip, Spinner } from "@/components/ui";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  PinIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";
import { LocalTime } from "@/components/TimeAgo";
import { useToast } from "@/components/providers";
import type { CheckIn } from "@/types";
import type { VenueOption } from "@/venues";

function priceTier(price: number | null): string {
  if (price === null || price <= 0) {
    return "";
  }
  return "$".repeat(Math.min(price, 4));
}

/** Deterministic tile gradient, so a venue always looks the same. */
function tileHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

function streetOf(location: VenueOption["locations"][number]): string {
  return (
    [
      location.address.street,
      location.address.city,
      location.address.state,
      location.address.zipcode,
    ]
      .filter(Boolean)
      .join(", ") || "Address not listed"
  );
}

export function RestaurantPicker({
  venues,
  totalCount,
  truncated,
  initialCheckIn,
}: {
  venues: VenueOption[];
  totalCount: number;
  truncated: boolean;
  initialCheckIn: CheckIn | null;
}) {
  const { push } = useToast();
  const [checkInState, setCheckInState] = useState<CheckIn | null>(initialCheckIn);
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const venue of venues) {
      for (const item of venue.restaurant.cuisine) {
        set.add(item);
      }
    }
    return [...set].sort();
  }, [venues]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return venues.filter(({ restaurant, locations }) => {
      const matchesCuisine = !cuisine || restaurant.cuisine.includes(cuisine);
      if (!matchesCuisine) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        restaurant.name,
        ...restaurant.cuisine,
        ...locations.map((location) =>
          [location.name, location.neighborhood.name, location.neighborhood.region].join(" "),
        ),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [venues, query, cuisine]);

  const locationCount = filtered.reduce((total, venue) => total + venue.locations.length, 0);

  async function handleCheckIn(locationId: string, venueName: string) {
    setError(null);
    setPendingId(locationId);
    try {
      const res = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Check-in failed");
      }
      const data = (await res.json()) as { check_in: CheckIn };
      setCheckInState(data.check_in);
      push({
        title: `Checked in at ${venueName}`,
        description: "You can open a table whenever the check lands.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
      push({
        title: "Could not check in",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleLeave() {
    setPendingId("__leave__");
    try {
      await fetch("/api/check-ins", { method: "DELETE" });
      setCheckInState(null);
      push({ title: "Check-in cleared", tone: "info" });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Active check-in */}
      {checkInState ? (
        <Card className="rise overflow-hidden border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-[var(--radius)] text-xl font-semibold text-white"
              style={{
                background: `linear-gradient(145deg, hsl(${tileHue(checkInState.location.restaurant.name)} 58% 46%), hsl(${(tileHue(checkInState.location.restaurant.name) + 40) % 360} 52% 32%))`,
              }}
            >
              {checkInState.location.restaurant.name.charAt(0)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {checkInState.location.restaurant.name}
                </h2>
                <Chip tone="accent" dot>
                  Checked in
                </Chip>
              </div>
              <p className="mt-1 text-[0.8125rem] text-[var(--muted)]">
                {checkInState.location.name ?? checkInState.location.neighborhood.name} ·{" "}
                {checkInState.location.neighborhood.name},{" "}
                {checkInState.location.neighborhood.region}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-[var(--muted)]">
                <ClockIcon size={13} />
                <LocalTime
                  iso={checkInState.created_at}
                  timeZone={checkInState.location.time_zone}
                />
                <span aria-hidden="true">·</span>
                <span>{checkInState.location.time_zone.replace("_", " ")}</span>
                {checkInState.blackbird_pay_enabled ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--accent)]">Settlement enabled</span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link href="/split" className="btn btn-primary">
                Split the bill
                <ArrowRightIcon size={16} />
              </Link>
              <button
                type="button"
                onClick={handleLeave}
                disabled={pendingId === "__leave__"}
                className="btn btn-quiet btn-sm"
              >
                <XIcon size={14} />
                {pendingId === "__leave__" ? "Clearing…" : "Check in somewhere else"}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Search + filters */}
      <Card className="rise card-pad flex flex-col gap-4">
        <div className="relative">
          <SearchIcon
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            className="input input-lg pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search venues, neighborhoods or cuisines"
            aria-label="Search venues"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCuisine(null)}
            className={`btn btn-sm ${cuisine === null ? "btn-ink" : "btn-outline"}`}
          >
            All
          </button>
          {cuisines.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCuisine(cuisine === item ? null : item)}
              className={`btn btn-sm ${cuisine === item ? "btn-ink" : "btn-outline"}`}
            >
              {item}
            </button>
          ))}
          <span className="ml-auto text-[0.75rem] text-[var(--muted)]">
            {filtered.length} {filtered.length === 1 ? "venue" : "venues"} · {locationCount}{" "}
            {locationCount === 1 ? "location" : "locations"}
            {truncated ? " · more available" : ""}
          </span>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <Card className="rise px-5 py-12 text-center">
          <p className="text-sm font-semibold">No venues match that</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[0.8125rem] leading-5 text-[var(--muted)]">
            Try a different neighborhood or clear the cuisine filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCuisine(null);
            }}
            className="btn btn-outline btn-sm mt-4"
          >
            Clear filters
          </button>
        </Card>
      ) : null}

      {/* Venue grid */}
      <div className="stagger grid gap-4 md:grid-cols-2">
        {filtered.map(({ restaurant, locations }) => {
          const hue = tileHue(restaurant.name);
          const isCheckedInHere =
            checkInState?.location.restaurant.id === restaurant.id;

          return (
            <Card key={restaurant.id} className="rise overflow-hidden">
              <div
                className="relative flex h-24 items-end p-4"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue} 54% 44%), hsl(${(hue + 42) % 360} 48% 28%))`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-[rgb(255_255_255/0.14)]"
                />
                <div className="relative flex w-full items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold tracking-tight text-white">
                      {restaurant.name}
                    </h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-[rgb(255_255_255/0.85)]">
                      <span>
                        {restaurant.cuisine.length > 0
                          ? restaurant.cuisine.join(" · ")
                          : "Cuisine not listed"}
                      </span>
                      {priceTier(restaurant.price) ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tnum">{priceTier(restaurant.price)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {isCheckedInHere ? (
                    <span className="chip" style={{ background: "rgb(255 255 255 / 0.22)", color: "#fff" }}>
                      <CheckIcon size={13} />
                      Here now
                    </span>
                  ) : null}
                </div>
              </div>

              <ul className="divide-y divide-[var(--line)]">
                {locations.length === 0 ? (
                  <li className="px-5 py-4 text-[0.8125rem] text-[var(--muted)]">
                    No locations listed yet.
                  </li>
                ) : null}

                {locations.map((location) => {
                  const busy = pendingId === location.id;
                  const disabled = pendingId !== null || !location.payments_enabled;
                  const active = checkInState?.location.id === location.id;

                  return (
                    <li key={location.id} className="flex items-start gap-3 px-4 py-3.5">
                      <span className="icon-tile mt-0.5 size-9">
                        <PinIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.875rem] font-medium">
                          {location.name ?? restaurant.name}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                          {location.neighborhood.name} · {location.neighborhood.region}
                        </p>
                        <p className="mt-0.5 truncate text-[0.75rem] text-[var(--muted)]">
                          {streetOf(location)}
                        </p>
                        {!location.payments_enabled ? (
                          <p className="mt-1.5 text-[0.75rem] text-[var(--pending)]">
                            Settlement not enabled at this location
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        disabled={disabled}
                        aria-busy={busy}
                        onClick={() =>
                          handleCheckIn(location.id, `${restaurant.name} — ${location.name ?? location.neighborhood.name}`)
                        }
                        className={`btn btn-sm shrink-0 ${active ? "btn-outline" : "btn-primary"}`}
                      >
                        {busy ? <Spinner size={14} /> : null}
                        {active ? (
                          <>
                            <CheckIcon size={14} />
                            Checked in
                          </>
                        ) : busy ? (
                          "Checking in…"
                        ) : (
                          "Check in"
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {restaurant.website_url ? (
                <div className="hairline flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2 text-[0.75rem] text-[var(--muted)]">
                    <Avatar
                      name={restaurant.name}
                      hue={hue}
                      size={22}
                    />
                    {locations.length} {locations.length === 1 ? "location" : "locations"}
                  </span>
                  <a
                    href={restaurant.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="link text-[0.75rem]"
                  >
                    Visit website
                  </a>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <p className="text-center text-[0.75rem] text-[var(--muted)]">
        Showing {filtered.length} of {totalCount} venues. Checking in records the
        visit against your account — that is what anchors the bill.
      </p>
    </div>
  );
}
