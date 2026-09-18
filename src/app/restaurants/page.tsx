import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { displayName } from "@/auth/demoUsers";
import { getActiveCheckIn } from "@/checkInState";
import { checkIn } from "@/flynetClient";
import type { CheckIn } from "@/types";
import { loadVenueCatalog } from "@/venues";
import { RestaurantPicker } from "./RestaurantPicker";

export const metadata: Metadata = {
  title: "Pick a venue · Flynet Tab Split",
  description: "Choose a restaurant and check in to start splitting the tab",
};

/**
 * Re-reads the member's active check-in so a refresh lands back on the
 * confirmation. The venue's current check-in is the source of truth;
 * the cookie only points at the location.
 *
 * This runs during render, so it must stay read-only — Next.js only
 * allows cookie writes from a Route Handler or Server Action. A cookie
 * that outlives the venue (or the mock server's in-memory state) is
 * treated as "not checked in" and gets overwritten by the next POST.
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
    redirect("/login");
  }

  const [catalog, activeCheckIn] = await Promise.all([
    loadVenueCatalog(),
    resolveActiveCheckIn(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <header>
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Where are you eating?
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Checking in as {displayName(user)} tells Flynet which venue to
            settle the tab with.
          </p>
        </header>

        <RestaurantPicker
          venues={catalog.venues}
          totalCount={catalog.totalCount}
          truncated={catalog.truncated}
          initialCheckIn={activeCheckIn}
        />
      </main>
    </div>
  );
}
