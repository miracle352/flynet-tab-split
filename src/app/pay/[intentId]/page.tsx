import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { formatFly } from "@/money";
import { balanceFor } from "@/tabs/service";
import { findByIntentId } from "@/tabs/store";
import { PayIntent } from "./PayIntent";

export const metadata: Metadata = {
  title: "Pay your share · Flynet Tab Split",
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ intentId: string }>;
}) {
  const { intentId } = await params;

  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) {
    redirect(`/login?next=${encodeURIComponent(`/pay/${intentId}`)}`);
  }

  const found = await findByIntentId(intentId);
  if (!found) {
    notFound();
  }

  const { tab, share } = found;
  const mine = share.user_id === user.id;
  const balance = await balanceFor(user, session.accessToken);

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col gap-8">
        <header>
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pay your share
          </h1>
        </header>

        <dl className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-zinc-500">Venue</dt>
            <dd className="text-right text-sm font-medium">{tab.venue_label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-zinc-500">Requested from</dt>
            <dd className="text-right text-sm font-medium">
              {share.display_name ?? "Unknown"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <dt className="text-sm text-zinc-500">Amount owed</dt>
            <dd className="font-mono text-lg font-semibold">
              {formatFly(share.amount)} FLY
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-zinc-500">Your balance</dt>
            <dd className="font-mono text-sm">{formatFly(balance)} FLY</dd>
          </div>
        </dl>

        {mine ? (
          <PayIntent
            intentId={intentId}
            amount={share.amount}
            balance={balance.toString()}
            venueLabel={tab.venue_label}
            alreadyPaid={share.status === "paid"}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              This request belongs to {share.display_name ?? "another member"}, not
              to you. Switch account to pay it, or open your own request.
            </p>
            <Link href="/" className="text-sm text-zinc-500 underline">
              Back to my wallet
            </Link>
          </div>
        )}

        <Link
          href={`/tabs/${tab.id}`}
          className="text-sm text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          See the whole table
        </Link>
      </main>
    </div>
  );
}
