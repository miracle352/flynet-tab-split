import { getCurrentUser } from "@/auth/currentUser";
import { ledgerFor } from "@/ledger/store";
import { expireStaleTabs } from "@/tabs/service";
import { connectionsFor } from "@/users/store";

/**
 * GET /api/people: the signed-in member's people graph, plus the
 * tables and movements that produced it.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const [connections, tabs, entries] = await Promise.all([
    connectionsFor(user.id),
    expireStaleTabs(),
    ledgerFor(user.id, 25),
  ]);

  const mine = tabs.filter(
    (tab) =>
      tab.host_user_id === user.id ||
      tab.shares.some((share) => share.user_id === user.id),
  );

  // Who this member has actually split a bill with, most recently first.
  const sharedTables = new Map<string, { name: string; handle: string | null; count: number; last: string }>();
  for (const tab of mine) {
    for (const share of tab.shares) {
      if (!share.user_id || share.user_id === user.id || !share.display_name) {
        continue;
      }
      const existing = sharedTables.get(share.user_id);
      sharedTables.set(share.user_id, {
        name: share.display_name,
        handle: share.handle,
        count: (existing?.count ?? 0) + 1,
        last:
          existing && existing.last > tab.created_at ? existing.last : tab.created_at,
      });
    }
  }

  return Response.json({
    connections,
    split_with: [...sharedTables.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.last.localeCompare(a.last)),
    tables: mine.slice(0, 10),
    recent: entries,
  });
}
