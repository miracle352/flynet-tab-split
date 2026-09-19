import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { Avatar, Card, CardHead, Chip, KeyValue, Stat } from "@/components/ui";
import {
  ArrowRightIcon,
  InfoIcon,
  PeopleIcon,
  ReceiptIcon,
  WalletIcon,
} from "@/components/icons";
import { formatFly, formatUsdt } from "@/money";
import { formatUsdCents, quoteAt, usdCentsFromFly } from "@/price/fly";
import { ledgerFor, summarise } from "@/ledger/store";
import { memberName } from "@/users/types";
import { connectionsFor } from "@/users/store";
import { expireStaleTabs } from "@/tabs/service";
import { AccountPanel } from "./AccountPanel";

export const metadata: Metadata = {
  title: "Account",
  description: "Your profile, wallet summary and session.",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [connections, tabs, entries] = await Promise.all([
    connectionsFor(user.id),
    expireStaleTabs(),
    ledgerFor(user.id, 100),
  ]);

  const mine = tabs.filter(
    (tab) =>
      tab.host_user_id === user.id ||
      tab.shares.some((share) => share.user_id === user.id),
  );
  const totals = summarise(entries);
  const quote = quoteAt();
  const totalCents =
    usdCentsFromFly(BigInt(user.balance.fly), quote.priceMicro) +
    BigInt(user.balance.usdt) / BigInt(10) ** BigInt(16);

  return (
    <div className="flex flex-col gap-7">
      <header className="rise flex flex-wrap items-center gap-4">
        <Avatar name={memberName(user)} hue={user.avatar_hue} size={64} />
        <div className="min-w-0">
          <p className="eyebrow">Account</p>
          <h1 className="display mt-1">{memberName(user)}</h1>
          <p className="mt-1 text-[0.875rem] text-[var(--muted)]">
            @{user.handle} · {user.email}
          </p>
        </div>
        <span className="ml-auto">
          <Chip tone="accent" dot>
            Wallet active
          </Chip>
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rise">
          <Stat label="Total value" value={formatUsdCents(totalCents)} sub="At the live quote" />
        </Card>
        <Card className="rise">
          <Stat label="FLY" value={formatFly(user.balance.fly)} sub="Settles your shares" tone="accent" />
        </Card>
        <Card className="rise">
          <Stat label="USDT" value={formatUsdt(user.balance.usdt)} sub="Swap into FLY any time" />
        </Card>
        <Card className="rise">
          <Stat
            label="Tables"
            value={mine.length}
            sub={`${totals.tableCount} settled · ${connections.length} people`}
          />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-5">
          <Card className="rise overflow-hidden">
            <CardHead
              title="Wallet"
              hint={
                user.connected_wallet
                  ? `${user.connected_wallet.provider} connected`
                  : "No external wallet connected"
              }
              icon={<WalletIcon size={17} />}
              action={
                <Link href="/wallet?tab=wallet" className="btn btn-outline btn-sm">
                  Manage
                  <ArrowRightIcon size={15} />
                </Link>
              }
            />
            <dl className="divider flex flex-col px-5 py-4">
              <KeyValue label="Spending wallet">
                <span className="font-mono text-[0.75rem]">
                  {user.wallets.find((wallet) => wallet.wallet_type === "SPENDING")?.address ?? "-"}
                </span>
              </KeyValue>
              <KeyValue label="Membership wallet">
                <span className="font-mono text-[0.75rem]">
                  {user.wallets.find((wallet) => wallet.wallet_type === "MEMBERSHIP")?.address ?? "-"}
                </span>
              </KeyValue>
              {user.connected_wallet ? (
                <KeyValue label="Connected wallet">
                  <span className="font-mono text-[0.75rem]">
                    {user.connected_wallet.address}
                  </span>
                </KeyValue>
              ) : null}
              <KeyValue label="Received in FLY">{formatFly(totals.receivedFly)}</KeyValue>
              <KeyValue label="Settled at tables">{formatFly(totals.spentFly)}</KeyValue>
            </dl>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/people"
              className="card card-pad rise flex flex-col gap-2 transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <span
                className="icon-tile size-9"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <PeopleIcon size={17} />
              </span>
              <p className="title">{connections.length} people</p>
              <p className="text-[0.8125rem] leading-5 text-[var(--muted)]">
                Search, add, and start a table with them.
              </p>
            </Link>

            <Link
              href="/how-it-works"
              className="card card-pad rise flex flex-col gap-2 transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <span className="icon-tile size-9">
                <InfoIcon size={17} />
              </span>
              <p className="title">How settlement works</p>
              <p className="text-[0.8125rem] leading-5 text-[var(--muted)]">
                What moves, where, and when a table closes.
              </p>
            </Link>
          </div>

          <Link
            href="/tables"
            className="card card-pad rise flex items-center gap-3 transition-shadow hover:shadow-[var(--shadow-md)]"
          >
            <span className="icon-tile size-9">
              <ReceiptIcon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="title block">Your tables</span>
              <span className="mt-0.5 block text-[0.8125rem] text-[var(--muted)]">
                {mine.filter((tab) => tab.status === "open").length} open ·{" "}
                {mine.filter((tab) => tab.status === "settled").length} settled
              </span>
            </span>
            <ArrowRightIcon size={17} className="text-[var(--muted)]" />
          </Link>
        </div>

        <div className="rise">
          <AccountPanel invitePath={`/invite/${user.handle}`} />
        </div>
      </div>
    </div>
  );
}
