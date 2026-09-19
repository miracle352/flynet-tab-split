import { fetchLiveCurrentUser } from "@/flynetClient";
import { getMember, touchMember } from "@/users/store";
import { getSession } from "./session";
import { toCurrentUser, type CurrentUser } from "./types";

/**
 * The signed-in person.
 *
 * A session that carries a provider access token is resolved against
 * that provider first; every other session resolves against the member
 * directory, which is also where sign-ups are written.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  if (session.accessToken) {
    try {
      return await fetchLiveCurrentUser(session.accessToken);
    } catch {
      return null;
    }
  }

  const member = await getMember(session.userId);
  if (!member) {
    return null;
  }

  // Cheap presence signal for "last seen" on the people screen.
  void touchMember(member.id).catch(() => undefined);

  return toCurrentUser(member);
}
