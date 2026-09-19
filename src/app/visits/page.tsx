import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { getActiveCheckIn } from "@/checkInState";
import { HistoryTabs } from "@/components/HistoryTabs";
import { LocalTime } from "@/components/TimeAgo";
import { Card, CardHead, Chip, EmptyState } from "@/components/ui";
import { ArrowRightIcon, PinIcon, ReceiptIcon } from "@/components/icons";
import { listMyCheckIns } from "@/flynetClient";
import { formatFly } from "@/money";
import { expireStaleTabs } from "@/tabs/service";
import type { CheckIn } from "@/types";

export const metadata: Metadata = {
  title: "Visits",
  description: "Your check-in history and the tables you settled at each venue.",
};

function duration(checkIn: CheckIn): string | null {
  if (!checkIn.ended_at) {
    return null;
  }
  const start = Date.parse(checkIn.created_at);
  const end = Date.parse(checkIn.ended_at);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }
  const minutes = Math.max(0, Math.round((end - start) / 60_000));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default async function VisitsPage() {
  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) {
    redirect("/login?next=/visits");
  }

  const active = await getActiveCheckIn();

  let checkIns: CheckIn[] = [];
  let failed = false;
  try {
    checkIns = (
      await listMyCheckIns(session.accessToken ?? undefined, active?.locationId)
    ).check_ins;
  } catch {
    failed = true;
  }

  const tabs = await expireStaleTabs();
  const mine = tabs.filter(
    (tab) =>
      tab.host_user_id === user.id ||
      tab.shares.some((share) => share.user_id === user.id),
  );

  const tablesAt = (locationId: string) =>
    mine.filter((tab) => tab.location_id === locationId);

  const totalVisits = checkIns.length;
  const totalSettled = mine.filter((tab) => tab.status === "settled").length;

  return (
    <div className="flex flex-col gap-7">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="display mt-1.5">Visits</h1>
          <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-[var(--muted)]">
            Every check-in is tied to your account, which is what makes a bill
            provably yours — {totalVisits}{" "}
            {totalVisits === 1 ? "visit" : "visits"} and {totalSettled} settled{" "}
            {totalSettled === 1 ? "table" : "tables"}.
          </p>
        </div>
        <HistoryTabs current="visits" />
      </header>

      <Card className="rise overflow-hidden">
        <CardHead
          title="Check-in history"
          hint={failed ? "Could not load right now" : "Newest first"}
          icon={<PinIcon size={17} />}
          action={
            <Link href="/restaurants" className="btn btn-outline btn-sm">
              Check in
            </Link>
          }
        />

        {checkIns.length === 0 ? (
          <div className="divider">
            <EmptyState
              title={failed ? "History unavailable" : "No visits yet"}
              body={
                failed
                  ? "The check-in feed could not be reached. Your tables still work — this screen is a record, not a gate."
                  : "Check in at a venue and every visit after that lands here, with the tables you settled while you were there."
              }
              icon={<PinIcon size={20} />}
              action={
                <Link href="/restaurants" className="btn btn-primary btn-sm mt-1">
                  Find a venue
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divider divide-y divide-[var(--line)]">
            {checkIns.map((checkIn) => {
              const open = checkIn.ended_at === null;
              const stay = duration(checkIn);
              const related = tablesAt(checkIn.location.id);
              const settledHere = related.filter((tab) => tab.status === "settled");
              const spentHere = settledHere.reduce(
                (total, tab) =>
                  total +
                  tab.shares.reduce(
                    (sum, share) =>
                      share.user_id === user.id && share.status === "paid"
                        ? sum + BigInt(share.amount)
                        : sum,
                    BigInt(0),
                  ),
                BigInt(0),
              );

              return (
                <li key={checkIn.id} className="flex gap-4 px-5 py-4">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] text-base font-semibold"
                    style={{
                      background: open ? "var(--accent-soft)" : "var(--surface-sunken)",
                      color: open ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {checkIn.location.restaurant.name.charAt(0)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[0.9375rem] font-semibold tracking-tight">
                        {checkIn.location.restaurant.name}
                      </p>
                      <Chip tone={open ? "accent" : "idle"} dot>
                        {open ? "Checked in now" : "Visit ended"}
                      </Chip>
                    </div>
                    <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">
                      {checkIn.location.name ?? checkIn.location.neighborhood.name} ·{" "}
                      {checkIn.location.neighborhood.name},{" "}
                      {checkIn.location.neighborhood.region}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-[var(--muted)]">
                      <LocalTime iso={checkIn.created_at} timeZone={checkIn.location.time_zone} />
                      {stay ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tnum">{stay} at the table</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <span>{checkIn.location.time_zone.replace("_", " ")}</span>
                    </p>

                    {related.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {related.slice(0, 3).map((tab) => (
                          <Link
                            key={tab.id}
                            href={`/tabs/${tab.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            <ReceiptIcon size={12} />
                            {tab.status === "settled"
                              ? `Settled ${formatFly(tab.total)} FLY`
                              : tab.status === "open"
                                ? "Table open"
                                : "Table closed"}
                            <ArrowRightIcon size={11} />
                          </Link>
                        ))}
                        {spentHere > BigInt(0) ? (
                          <span className="tnum text-[0.6875rem] text-[var(--muted)]">
                            You paid {formatFly(spentHere)} FLY here
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
