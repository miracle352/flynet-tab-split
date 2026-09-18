import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { displayName } from "@/auth/demoUsers";
import { getActiveCheckIn } from "@/checkInState";
import { Card, CardHead, EmptyState, Note, ProgressBar, Stat } from "@/components/ui";
import { checkIn } from "@/flynetClient";
import { formatFly, formatUsdCents } from "@/money";
import { tabsInvolving } from "@/tabs/store";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const active = await getActiveCheckIn();
  let venueLabel: string | null = null;
  let atVenue = false;
  if (active) {
    try {
      const record = await checkIn(active.locationId);
      venueLabel = [
        record.location.restaurant.name,
        record.location.name ?? record.location.neighborhood.name,
      ]
        .filter(Boolean)
        .join(" — ");
      atVenue = record.ended_at === null;
    } catch {
      venueLabel = null;
    }
  }

  const tabs = (await tabsInvolving(user.id)).slice(0, 5);
  const openTabs = tabs.filter((tab) => tab.status === "open");
  const firstName = displayName(user).split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <header className="rise">
        <p className="eyebrow">Wallet</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Hey {firstName}
        </h1>
      </header>

      <Card raised className="rise overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-6 px-5 py-6 sm:px-6">
          <div>
            <p className="eyebrow">FLY balance</p>
            <p className="mt-2 font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
              {formatFly(user.balance.balance.value)}
              <span className="ml-2 text-lg font-medium text-[var(--muted)]">FLY</span>
            </p>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              ≈ {formatUsdCents(user.balance.balance_usd.value)}
            </p>
          </div>
          <div className="flex flex-col gap-2 text-right">
            <span className="eyebrow">Spending wallet</span>
            <span className="max-w-[16rem] truncate font-mono text-xs text-[var(--muted)]">
              {user.wallets.find((w) => w.wallet_type === "SPENDING")?.address ?? "—"}
            </span>
          </div>
        </div>
        <div className="divider grid grid-cols-2 divide-x divide-[var(--line)] sm:grid-cols-3">
          <Stat label="Open tables" value={openTabs.length} />
          <Stat label="Settled" value={tabs.length - openTabs.length} />
          <div className="hidden sm:block">
            <Stat
              label="Checked in"
              value={venueLabel ? "Yes" : "No"}
              sub={venueLabel ?? "Pick a venue to start"}
            />
          </div>
        </div>
      </Card>

      <Card className="rise">
        <CardHead
          title={venueLabel ? `You're at ${venueLabel}` : "Where are you eating?"}
          hint={
            venueLabel && atVenue
              ? "Your check-in anchors the bill to this visit."
              : "Check in first — that's what ties the split to a real table."
          }
          action={
            <Link href={venueLabel ? "/split" : "/restaurants"} className="btn btn-accent">
              {venueLabel ? "Split the bill" : "Find a venue"}
            </Link>
          }
        />
        {!venueLabel ? (
          <div className="divider">
            <EmptyState
              title="No active check-in"
              body="Flynet check-ins are what prove a bill belongs to a real visit. Pick a venue and check in to open a table."
            />
          </div>
        ) : null}
      </Card>

      <Card className="rise">
        <CardHead
          title="Your tables"
          hint="Tables you opened or have a seat at"
          action={
            tabs.length > 0 ? (
              <Link href="/restaurants" className="btn btn-outline !py-1.5 text-xs">
                New table
              </Link>
            ) : null
          }
        />
        {tabs.length === 0 ? (
          <div className="divider">
            <EmptyState
              title="No tables yet"
              body="Open a table from a venue you're checked in at, then send your friends the invite link."
            />
          </div>
        ) : (
          <ul className="divider divide-y divide-[var(--line)]">
            {tabs.map((tab) => {
              const paid = tab.shares.filter((s) => s.status === "paid").length;
              return (
                <li key={tab.id}>
                  <Link
                    href={`/tabs/${tab.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[var(--surface-sunken)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{tab.venue_label}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {tab.status === "settled"
                            ? "Settled"
                            : `${paid} of ${tab.shares.length} paid`}{" "}
                          · code {tab.join_code}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm">
                        {formatFly(tab.total)} FLY
                      </span>
                    </div>
                    <ProgressBar paid={paid} total={tab.shares.length} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="rise">
        <CardHead
          title="How settlement works here"
          hint="Two Flynet constraints shape this app"
        />
        <div className="divider flex flex-col gap-3 px-5 py-4">
          <Note>
            <strong className="font-semibold text-[var(--ink)]">
              Money moves one way: member → venue.
            </strong>{" "}
            Flynet v1 has no peer-to-peer transfer, so nobody fronts the bill and
            gets reimbursed. Instead each person pays their share{" "}
            <em>directly to the restaurant</em>, before anyone pays in full.
          </Note>
          <Note>
            <strong className="font-semibold text-[var(--ink)]">
              There is no friends list to pick from.
            </strong>{" "}
            Flynet exposes no social graph, so guests either get picked by the
            host or arrive through an invite link and sign in themselves — every
            payer is a real, consenting wallet.
          </Note>
          <Link href="/visits" className="link mt-1 text-sm">
            See the check-ins that prove your visits →
          </Link>
        </div>
      </Card>
    </div>
  );
}
