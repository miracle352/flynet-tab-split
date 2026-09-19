import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { Card, CardHead, KeyValue, Note } from "@/components/ui";
import { ArrowRightIcon, ReceiptIcon } from "@/components/icons";
import { formatDecimal } from "@/money";
import { balanceFor } from "@/tabs/service";
import { findByIntentId } from "@/tabs/store";
import { PayIntent } from "./PayIntent";

export const metadata: Metadata = {
  title: "Pay your share",
  description: "Settle your share of the table in FLY.",
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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <header className="rise">
        <p className="eyebrow">Payment request</p>
        <h1 className="display mt-1.5">
          {formatDecimal(share.amount, 4)} FLY
        </h1>
        <p className="mt-2 text-[0.875rem] leading-6 text-[var(--muted)]">
          Your seat at {tab.venue_label}, payable straight to the venue.
        </p>
      </header>

      <Card className="rise overflow-hidden">
        <CardHead title="The request" icon={<ReceiptIcon size={17} />} />
        <dl className="divider flex flex-col px-5 py-4">
          <KeyValue label="Venue">{tab.venue_label}</KeyValue>
          <KeyValue label="Table total">
            {formatDecimal(tab.total, 2)} FLY
          </KeyValue>
          <KeyValue label="Requested from">
            {share.display_name ?? "A member"}
          </KeyValue>
          <KeyValue label="Your share" strong>
            {formatDecimal(share.amount, 4)} FLY
          </KeyValue>
          <KeyValue label="Your balance">
            {formatDecimal(balance, 4)} FLY
          </KeyValue>
        </dl>
      </Card>

      {mine ? (
        <PayIntent
          intentId={intentId}
          amount={share.amount}
          balance={balance.toString()}
          venueLabel={tab.venue_label}
          alreadyPaid={share.status === "paid"}
          tabId={tab.id}
          tableOpen={tab.status === "open"}
        />
      ) : (
        <Card className="rise card-pad flex flex-col gap-3">
          <Note>
            This request belongs to {share.display_name ?? "another member"}, not
            to you. Sign in as them to settle it, or open your own table.
          </Note>
          <div className="flex flex-wrap gap-2">
            <Link href={`/tabs/${tab.id}`} className="btn btn-outline btn-sm">
              See the table
            </Link>
            <Link href="/" className="btn btn-quiet btn-sm">
              Back to my wallet
            </Link>
          </div>
        </Card>
      )}

      <Link
        href={`/tabs/${tab.id}`}
        className="btn btn-quiet btn-sm self-center"
      >
        See the whole table
        <ArrowRightIcon size={15} />
      </Link>
    </div>
  );
}
