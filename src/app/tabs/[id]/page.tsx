import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
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

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <main className="flex w-full max-w-lg flex-col gap-8">
        <header>
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {tab.status === "settled" ? "All settled" : "Who has paid?"}
          </h1>
        </header>

        <TabStatus tabId={tab.id} currentUserId={user.id} initialTab={tab} />
      </main>
    </div>
  );
}
