import { cookies } from "next/headers";

/**
 * Remembers which venue the signed-in member is currently at, so the
 * confirmation survives a refresh and the next step (splitting the
 * tab) knows where they are. Mirrors `auth/session.ts`.
 *
 * Only the ids live in the cookie — the full `CheckIn` is always
 * re-read from `flynetClient.checkIn()`, which is idempotent per
 * location, so there is no second source of truth to go stale.
 */

const CHECK_IN_COOKIE = "flynet_check_in";

export interface ActiveCheckIn {
  locationId: string;
  checkInId: string;
}

export async function getActiveCheckIn(): Promise<ActiveCheckIn | null> {
  const store = await cookies();
  const raw = store.get(CHECK_IN_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ActiveCheckIn;
    if (!parsed?.locationId || !parsed?.checkInId) {
      return null;
    }
    return { locationId: parsed.locationId, checkInId: parsed.checkInId };
  } catch {
    return null;
  }
}

export async function setActiveCheckIn(value: ActiveCheckIn): Promise<void> {
  const store = await cookies();
  store.set(CHECK_IN_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearActiveCheckIn(): Promise<void> {
  const store = await cookies();
  store.delete(CHECK_IN_COOKIE);
}
