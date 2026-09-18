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
    <div className="flex flex-col gap-8">
      <main className="flex w-full max-w-md flex-col gap-8">
        <header>
          <p className="eyebrow">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
            Pay your share
          </h1>
        </header>

        <dl className="flex flex-col gap-3 card">
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-[var(--muted)]">Venue</dt>
            <dd className="text-right text-sm font-medium">{tab.venue_label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-[var(--muted)]">Requested from</dt>
            <dd className="text-right text-sm font-medium">
              {share.display_name ?? "Unknown"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-3">
            <dt className="text-sm text-[var(--muted)]">Amount owed</dt>
            <dd className="font-mono text-lg font-semibold">
              {formatFly(share.amount)} FLY
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-[var(--muted)]">Your balance</dt>
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
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-sunken)] p-4 text-sm text-[var(--muted)] dark:text-[var(--muted)]">
              This request belongs to {share.display_name ?? "another member"}, not
              to you. Switch account to pay it, or open your own request.
            </p>
            <Link href="/" className="text-sm text-[var(--muted)] underline">
              Back to my wallet
            </Link>
          </div>
        )}

        <Link
          href={`/tabs/${tab.id}`}
          className="text-sm text-[var(--muted)] underline decoration-[var(--line-strong)] underline-offset-4 hover:text-[var(--ink)]"
        >
          See the whole table
        </Link>
      </main>
    </div>
  );
}
