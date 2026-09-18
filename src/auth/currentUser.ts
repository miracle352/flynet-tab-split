import { findDemoUser } from "./demoUsers";
import { getSession } from "./session";
import type { CurrentUser } from "./types";

/**
 * Server-side current user. Today this is a demo-user lookup from the
 * session cookie. Swap the body for Flynet `GET /users/me` + wallets
 * when `session.accessToken` is present — keep the `CurrentUser`
 * return type so `useCurrentUser()` and pages stay unchanged.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }
  return findDemoUser(session.userId) ?? null;
}
