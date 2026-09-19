import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { expireStaleTabs } from "@/tabs/service";
import { connectionsFor } from "@/users/store";
import { PeopleBrowser } from "./PeopleBrowser";

export const metadata: Metadata = {
  title: "People",
  description: "Search people on Flynet and see who you split with.",
};

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/people");
  }

  const [connections, tabs] = await Promise.all([
    connectionsFor(user.id),
    expireStaleTabs(),
  ]);

  const shared = new Map<
    string,
    { name: string; handle: string | null; count: number; last: string }
  >();
  for (const tab of tabs) {
    for (const share of tab.shares) {
      if (!share.user_id || share.user_id === user.id || !share.display_name) {
        continue;
      }
      const existing = shared.get(share.user_id);
      shared.set(share.user_id, {
        name: share.display_name,
        handle: share.handle,
        count: (existing?.count ?? 0) + 1,
        last: existing && existing.last > tab.created_at ? existing.last : tab.created_at,
      });
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="rise">
        <p className="eyebrow">People</p>
        <h1 className="display mt-1.5">Who you split with</h1>
        <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-[var(--muted)]">
          Pick somebody by name when you open a table, or send them the invite
          link. Either way they sign in themselves, so every payer on a bill is a
          real account with its own wallet.
        </p>
      </header>

      <PeopleBrowser
        initialConnections={connections.map((edge) => edge.member)}
        splitWith={[...shared.entries()]
          .map(([id, value]) => ({ id, ...value }))
          .sort((a, b) => b.last.localeCompare(a.last))}
      />
    </div>
  );
}
