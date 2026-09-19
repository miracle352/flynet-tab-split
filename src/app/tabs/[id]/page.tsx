import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { ArrowRightIcon } from "@/components/icons";
import { listChallenges } from "@/flynetClient";
import { expireStaleTabs } from "@/tabs/service";
import { getTab } from "@/tabs/store";
import { balanceFor } from "@/tabs/service";
import type { Challenge } from "@/types";
import { TabStatus } from "./TabStatus";

export const metadata: Metadata = {
  title: "Table",
  description: "Live view of who has paid and what is still outstanding.",
};

export default async function TabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) {
    redirect(`/login?next=${encodeURIComponent(`/tabs/${id}`)}`);
  }

  // Reading the list clears idle tables, so this page never shows a
  // board that should already have closed.
  await expireStaleTabs();
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

  // What this venue is rewarding right now. A failed lookup must never
  // break the live board.
  let challenges: Challenge[] = [];
  try {
    challenges = (await listChallenges(tab.restaurant_id)).challenges;
  } catch {
    challenges = [];
  }

  const balance = await balanceFor(user, session.accessToken);

  return (
    <div className="flex flex-col gap-6">
      <div className="rise flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/tables"
          className="btn btn-quiet btn-sm"
        >
          All tables
          <ArrowRightIcon size={15} />
        </Link>
        <Link href="/how-it-works" className="link text-[0.8125rem]">
          How settlement works
        </Link>
      </div>

      <TabStatus
        tabId={tab.id}
        initialTab={tab}
        challenges={challenges}
        balance={balance.toString()}
      />
    </div>
  );
}
