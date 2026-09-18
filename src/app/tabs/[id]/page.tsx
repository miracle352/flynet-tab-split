import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { listChallenges } from "@/flynetClient";
import type { Challenge } from "@/types";
import { getTab } from "@/tabs/store";
import { TabStatus } from "./TabStatus";

export const metadata: Metadata = {
  title: "Table status · Flynet Tab Split",
};

export default async function TabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/tabs/${id}`)}`);
  }

  const tab = await getTab(id);
  if (!tab) {
    notFound();
  }

  const involved =
    tab.host_user_id === user.id ||
    tab.shares.some((share) => share.user_id === user.id);
  if (!involved) {
    redirect("/");
  }

  // The loyalty angle: what this venue is rewarding right now. A failed
  // lookup must never break the status view.
  let challenges: Challenge[] = [];
  try {
    challenges = (await listChallenges(tab.restaurant_id)).challenges;
  } catch {
    challenges = [];
  }

  return (
    <div className="flex flex-col gap-8">
      <main className="flex w-full max-w-lg flex-col gap-8">
        <header>
          <p className="eyebrow">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
            {tab.status === "settled" ? "All settled" : "Who has paid?"}
          </h1>
        </header>

        <TabStatus
          tabId={tab.id}
          currentUserId={user.id}
          initialTab={tab}
          challenges={challenges}
        />
      </main>
    </div>
  );
}
