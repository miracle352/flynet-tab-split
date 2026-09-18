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
    <div className="flex flex-col gap-8">
      <main className="flex w-full max-w-md flex-col gap-8">
        <header>
          <p className="eyebrow">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
            You’re invited to the table
          </h1>
        </header>

        <div className="flex flex-col gap-4 card">
          <div>
            <p className="text-sm text-[var(--muted)]">Venue</p>
            <p className="mt-1 text-base font-semibold text-[var(--ink)]">
              {tab.venue_label}
            </p>
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Table total</dt>
              <dd className="font-mono">{formatFly(tab.total)} FLY</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Seats</dt>
              <dd className="font-mono">
                {tab.shares.filter((share) => share.user_id !== null).length} of{" "}
                {tab.shares.length} claimed
              </dd>
            </div>
            <div className="flex justify-between border-t border-[var(--line)] pt-2 font-semibold">
              <dt>Your share</dt>
              <dd className="font-mono">
                {freeSeat ? `${formatFly(freeSeat.amount)} FLY` : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {full ? (
          <p className="text-sm text-[var(--muted)]">
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
