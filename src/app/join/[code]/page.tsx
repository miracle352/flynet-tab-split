import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { formatFly } from "@/money";
import { getTabByCode } from "@/tabs/store";
import { JoinTab } from "./JoinTab";

export const metadata: Metadata = {
  title: "Join the table · Flynet Tab Split",
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  const tab = await getTabByCode(code);
  if (!tab) {
    notFound();
  }

  // Already seated — skip straight to the live view.
  const existingSeat = tab.shares.find((share) => share.user_id === user.id);
  if (existingSeat) {
    redirect(`/tabs/${tab.id}`);
  }

  const freeSeat = tab.shares.find((share) => share.user_id === null);
  const full = !freeSeat || tab.status !== "open";

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col gap-8">
        <header>
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            You’re invited to the table
          </h1>
        </header>

        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <p className="text-sm text-zinc-500">Venue</p>
            <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {tab.venue_label}
            </p>
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Table total</dt>
              <dd className="font-mono">{formatFly(tab.total)} FLY</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Seats</dt>
              <dd className="font-mono">
                {tab.shares.filter((share) => share.user_id !== null).length} of{" "}
                {tab.shares.length} claimed
              </dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
              <dt>Your share</dt>
              <dd className="font-mono">
                {freeSeat ? `${formatFly(freeSeat.amount)} FLY` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {full ? (
          <p className="text-sm text-zinc-500">
            {tab.status === "settled"
              ? "This table has already settled."
              : "Every seat at this table is taken."}
          </p>
        ) : (
          <JoinTab tabId={tab.id} amount={freeSeat.amount} />
        )}
      </main>
    </div>
  );
}
