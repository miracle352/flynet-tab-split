import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { ActivityList } from "@/components/ActivityList";
import { HistoryTabs } from "@/components/HistoryTabs";
import { Card, CardHead, Stat } from "@/components/ui";
import { ArrowDownIcon, ReceiptIcon, SwapIcon } from "@/components/icons";
import { ledgerFor, summarise } from "@/ledger/store";
import { formatFly, formatUsdt } from "@/money";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Every deposit, swap and settled share on your account.",
};

export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/activity");
  }

  const entries = await ledgerFor(user.id, 200);
  const totals = summarise(entries);

  return (
    <div className="flex flex-col gap-7">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="display mt-1.5">Transactions</h1>
          <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-[var(--muted)]">
            Every movement on your account, with the dollar value captured at the
            moment it settled.
          </p>
        </div>
        <HistoryTabs current="activity" />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rise">
          <Stat
            label="Funded"
            value={`${formatUsdt(totals.fundedUsdt * BigInt(10) ** BigInt(18))} USDT`}
            sub={
              totals.swappedUsdt > BigInt(0)
                ? `${formatUsdt(totals.swappedUsdt * BigInt(10) ** BigInt(18))} USDT swapped into FLY`
                : "USDT added to this wallet"
            }
          />
        </Card>
        <Card className="rise">
          <Stat
            label="Received in FLY"
            value={formatFly(totals.receivedFly)}
            sub="Deposits, swaps in and refunds"
            tone="accent"
          />
        </Card>
        <Card className="rise">
          <Stat
            label="Settled at tables"
            value={formatFly(totals.spentFly)}
            sub={`Across ${totals.tableCount} ${totals.tableCount === 1 ? "table" : "tables"}`}
          />
        </Card>
      </div>

      <Card className="rise overflow-hidden">
        <CardHead
          title="All movements"
          hint={`${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
          icon={<SwapIcon size={17} />}
          action={
            <span className="hidden gap-2 sm:flex">
              <span className="chip chip-accent">
                <ArrowDownIcon size={13} /> In
              </span>
              <span className="chip chip-idle">
                <ReceiptIcon size={13} /> Out
              </span>
            </span>
          }
        />
        <div className="divider">
          <ActivityList entries={entries} />
        </div>
      </Card>

      <p className="text-center text-[0.75rem] text-[var(--muted)]">
        Dollar values are captured when a movement settles. Balances elsewhere on
        the site use the live FLY quote.
      </p>
    </div>
  );
}
