import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getActiveCheckIn } from "@/checkInState";
import { ActivityList } from "@/components/ActivityList";
import { TableCard } from "@/components/TableCard";
import { WalletHero } from "@/components/WalletHero";
import { Card, CardHead, Chip, EmptyState, Note } from "@/components/ui";
import {
  ArrowRightIcon,
  PinIcon,
  ReceiptIcon,
  SparkIcon,
} from "@/components/icons";
import { checkIn } from "@/flynetClient";
import { ledgerFor } from "@/ledger/store";
import { memberName } from "@/users/types";
import { expireStaleTabs } from "@/tabs/service";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const active = await getActiveCheckIn();
  let venueLabel: string | null = null;
  let atVenue = false;
  let venueNeighborhood: string | null = null;
  if (active) {
    try {
      const record = await checkIn(active.locationId);
      venueLabel = [
        record.location.restaurant.name,
        record.location.name ?? record.location.neighborhood.name,
      ]
        .filter(Boolean)
        .join(" - ");
      venueNeighborhood = `${record.location.neighborhood.name}, ${record.location.neighborhood.region}`;
      atVenue = record.ended_at === null;
    } catch {
      venueLabel = null;
    }
  }

  const [allTabs, recent] = await Promise.all([expireStaleTabs(), ledgerFor(user.id, 6)]);

  const mine = allTabs.filter(
    (tab) =>
      tab.host_user_id === user.id ||
      tab.shares.some((share) => share.user_id === user.id),
  );
  const live = mine.filter((tab) => tab.status === "open");
  const history = mine.filter((tab) => tab.status !== "open").slice(0, 3);
  const firstName = memberName(user).split(" ")[0];

  return (
    <div className="flex flex-col gap-7">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Wallet</p>
          <h1 className="display mt-1.5">Hey {firstName}</h1>
          <p className="mt-2 max-w-xl text-[0.875rem] leading-6 text-[var(--muted)]">
            {venueLabel && atVenue
              ? `You're checked in at ${venueLabel}. Open a table whenever the check lands.`
              : "Check in at a venue, then split the bill. Every seat pays the venue directly in FLY."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/wallet" className="btn btn-outline btn-sm">
            Fund wallet
          </Link>
          <Link href="/restaurants" className="btn btn-ink btn-sm">
            <PinIcon size={15} />
            {venueLabel ? "Change venue" : "Find a venue"}
          </Link>
        </div>
      </header>

      <WalletHero firstName={firstName} />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="rise overflow-hidden">
          <CardHead
            title="Your tables"
            hint={
              live.length > 0
                ? `${live.length} open right now`
                : "Tables you host or have a seat at"
            }
            icon={<ReceiptIcon size={17} />}
            action={
              <Link
                href="/tables"
                className="btn btn-quiet btn-sm"
                aria-label="See all tables"
              >
                All
                <ArrowRightIcon size={15} />
              </Link>
            }
          />
          {mine.length === 0 ? (
            <div className="divider">
              <EmptyState
                title="No tables yet"
                body="Check in at a venue, enter the bill, pick who is splitting it, and send the invites. Everybody pays their own share."
                icon={<ReceiptIcon size={20} />}
                action={
                  <Link href="/split" className="btn btn-primary btn-sm mt-1">
                    Open a table
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="divider flex flex-col gap-3 p-4">
              {(live.length > 0 ? live : history).map((tab) => (
                <TableCard key={tab.id} tab={tab} />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="rise overflow-hidden">
            <CardHead
              title={venueLabel && atVenue ? "You're checked in" : "Where are you eating?"}
              hint={
                venueLabel && atVenue
                  ? venueNeighborhood ?? undefined
                  : "A check-in is what ties the split to a real visit"
              }
              icon={<PinIcon size={17} />}
            />
            <div className="divider flex flex-col gap-3 px-5 py-4">
              {venueLabel && atVenue ? (
                <>
                  <p className="text-[0.9375rem] font-semibold tracking-tight">{venueLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip tone="accent" dot>
                      Check-in active
                    </Chip>
                    <Link href="/split" className="btn btn-primary btn-sm">
                      Split the bill
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[0.8125rem] leading-6 text-[var(--muted)]">
                    Pick the venue you are sitting in. The check-in anchors the
                    bill, so the restaurant can see the table settled against a
                    real visit.
                  </p>
                  <Link href="/restaurants" className="btn btn-primary btn-sm self-start">
                    Find a venue
                  </Link>
                </>
              )}
            </div>
          </Card>

          <Card className="rise overflow-hidden">
            <CardHead
              title="How settlement works"
              hint="Three moves, one direction"
              icon={<SparkIcon size={17} />}
              action={
                <Link href="/how-it-works" className="btn btn-quiet btn-sm">
                  Details
                  <ArrowRightIcon size={15} />
                </Link>
              }
            />
            <div className="divider flex flex-col gap-3 px-5 py-4">
              <ol className="flex flex-col gap-3">
                {[
                  {
                    step: "1",
                    title: "Everyone gets a request",
                    body: "Opening a table creates one payment request per seat, in FLY.",
                  },
                  {
                    step: "2",
                    title: "Each seat pays the venue",
                    body: "Nobody fronts the bill and chases the others; money goes member to venue.",
                  },
                  {
                    step: "3",
                    title: "The table closes itself",
                    body: "When the last share lands the table settles. Leave it idle and it closes with a refund.",
                  },
                ].map((item) => (
                  <li key={item.step} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[0.6875rem] font-bold text-[var(--accent)]">
                      {item.step}
                    </span>
                    <span>
                      <span className="block text-[0.8125rem] font-semibold">{item.title}</span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-5 text-[var(--muted)]">
                        {item.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <Note tone="accent">
                Settlement is one-way by design: <strong className="font-semibold text-[var(--ink)]">your wallet → the venue</strong>.
                That is what makes a split stick without anybody trusting anybody else with cash.
              </Note>
            </div>
          </Card>
        </div>
      </div>

      <Card className="rise overflow-hidden">
        <CardHead
          title="Recent activity"
          hint="Deposits, swaps and settled shares"
          icon={<SparkIcon size={17} />}
          action={
            <Link href="/activity" className="btn btn-quiet btn-sm">
              History
              <ArrowRightIcon size={15} />
            </Link>
          }
        />
        <div className="divider">
          <ActivityList
            entries={recent}
            emptyTitle="Nothing yet"
            emptyBody="Add funds or settle a table and it will appear here with the USD value at the time."
          />
        </div>
      </Card>
    </div>
  );
}
