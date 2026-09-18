import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { getActiveCheckIn } from "@/checkInState";
import { Card, CardHead, EmptyState, Note } from "@/components/ui";
import { listMyCheckIns } from "@/flynetClient";
import type { CheckIn } from "@/types";

export const metadata: Metadata = {
  title: "My visits",
};

function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function durationMinutes(checkIn: CheckIn): string | null {
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
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default async function VisitsPage() {
  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) {
    redirect("/login?next=/visits");
  }

  const active = await getActiveCheckIn();

  // GET /users/me/check_ins — the subject comes from the access token,
  // which is what makes these rows attributable to *you*.
  let checkIns: CheckIn[] = [];
  let failed = false;
  try {
    checkIns = (
      await listMyCheckIns(session.accessToken ?? undefined, active?.locationId)
    ).check_ins;
  } catch {
    failed = true;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="rise">
        <p className="eyebrow">Check-ins</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          My visits
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Your own check-in history, read from{" "}
          <code className="font-mono text-xs">/users/me/check_ins</code>.
        </p>
      </header>

      <Note>
        <strong className="font-semibold text-[var(--ink)]">
          Why this endpoint and not the public feed.
        </strong>{" "}
        Flynet&apos;s <code className="font-mono text-xs">GET /check_ins</code>{" "}
        feed is anonymized — records carry no user field, and its{" "}
        <code className="font-mono text-xs">user</code> filter was removed and is
        silently ignored. This screen reads the member-scoped feed instead, where
        the subject comes from the access token. That is what lets a bill be tied
        to a visit <em>you</em> actually made, rather than to a venue that merely
        exists.
      </Note>

      <Card className="rise">
        <CardHead
          title="Visit history"
          hint={
            failed
              ? "Could not load right now"
              : `${checkIns.length} ${checkIns.length === 1 ? "visit" : "visits"}`
          }
        />
        {checkIns.length === 0 ? (
          <div className="divider">
            <EmptyState
              title={failed ? "History unavailable" : "No visits yet"}
              body={
                failed
                  ? "The check-in feed could not be reached. Your splits still work — this screen is a record, not a gate."
                  : "Check in at a venue and it will show up here, attributable to your account."
              }
              action={
                <Link href="/restaurants" className="btn btn-primary mt-1">
                  Find a venue
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divider divide-y divide-[var(--line)]">
            {checkIns.map((checkIn) => {
              const open = checkIn.ended_at === null;
              const stay = durationMinutes(checkIn);
              return (
                <li key={checkIn.id} className="flex items-start gap-4 px-5 py-4">
                  <span
                    aria-hidden="true"
                    className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                      open
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "bg-[var(--surface-sunken)] text-[var(--muted)]"
                    }`}
                  >
                    {checkIn.location.restaurant.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {checkIn.location.restaurant.name}
                      <span className="ml-2 font-normal text-[var(--muted)]">
                        {checkIn.location.name ?? checkIn.location.neighborhood.name}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {checkIn.location.neighborhood.name},{" "}
                      {checkIn.location.neighborhood.region}
                    </p>
                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      <span suppressHydrationWarning>
                        {formatWhen(checkIn.created_at, checkIn.location.time_zone)}
                      </span>
                      {stay ? ` · ${stay}` : ""} ·{" "}
                      {checkIn.location.time_zone}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${open ? "chip-paid" : "chip-idle"}`}>
                    {open ? "Current" : "Ended"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
