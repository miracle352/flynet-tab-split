import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getActiveCheckIn } from "@/checkInState";
import { Chip } from "@/components/ui";
import { checkIn } from "@/flynetClient";
import { memberName } from "@/users/types";
import type { CheckIn } from "@/types";
import { loadVenueCatalog } from "@/venues";
import { RestaurantPicker } from "./RestaurantPicker";

export const metadata: Metadata = {
  title: "Venues",
  description: "Find the venue you are at and check in to start splitting the tab.",
};

/**
 * Re-reads the active check-in so a refresh lands back on the confirmed
 * venue. The venue's current check-in is the source of truth; the cookie
 * only points at the location, and this runs during render, so it stays
 * read-only.
 */
async function resolveActiveCheckIn(): Promise<CheckIn | null> {
  const active = await getActiveCheckIn();
  if (!active) {
    return null;
  }
  try {
    return await checkIn(active.locationId);
  } catch {
    return null;
  }
}

export default async function RestaurantsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/restaurants");
  }

  const [catalog, activeCheckIn] = await Promise.all([
    loadVenueCatalog(),
    resolveActiveCheckIn(),
  ]);

  return (
    <div className="flex flex-col gap-7">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Venues</p>
          <h1 className="display mt-1.5">Where are you eating?</h1>
          <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-[var(--muted)]">
            Checking in as {memberName(user)} tells the venue which visit to
            settle the table against. Pick a location, then open your table.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="accent" dot>
            {catalog.totalCount} venues available
          </Chip>
          <Link href="/split" className="btn btn-outline btn-sm">
            Open a table
          </Link>
        </div>
      </header>

      <RestaurantPicker
        venues={catalog.venues}
        totalCount={catalog.totalCount}
        truncated={catalog.truncated}
        initialCheckIn={activeCheckIn}
      />
    </div>
  );
}
