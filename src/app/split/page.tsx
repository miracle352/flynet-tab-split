import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getActiveCheckIn } from "@/checkInState";
import { Chip } from "@/components/ui";
import { ArrowRightIcon, PinIcon } from "@/components/icons";
import { checkIn } from "@/flynetClient";
import { getMembersByIds } from "@/users/store";
import { toPublicMember } from "@/users/types";
import { SplitForm } from "./SplitForm";

export const metadata: Metadata = {
  title: "Split the bill",
  description: "Open a table, pick who is splitting it, and settle each share in FLY.",
};

export default async function SplitPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/split");
  }

  const active = await getActiveCheckIn();
  if (!active) {
    redirect("/restaurants");
  }

  let venueLabel = "Your table";
  let venueNeighborhood = "";
  let timeZone = "UTC";
  try {
    const record = await checkIn(active.locationId);
    venueLabel = [
      record.location.restaurant.name,
      record.location.name ?? record.location.neighborhood.name,
    ]
      .filter(Boolean)
      .join(" - ");
    venueNeighborhood = `${record.location.neighborhood.name}, ${record.location.neighborhood.region}`;
    timeZone = record.location.time_zone;
  } catch {
    redirect("/restaurants");
  }

  const { with: withParam } = await searchParams;
  const wanted = (Array.isArray(withParam) ? withParam : [withParam]).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  const preselected = wanted.length > 0 ? await getMembersByIds(wanted) : [];

  return (
    <div className="flex flex-col gap-7">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Open a table</p>
          <h1 className="display mt-1.5">Split the bill</h1>
          <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-[var(--muted)]">
            Enter the check, pick who is sharing it, and every seat gets its own
            payment request in FLY. Nobody fronts the bill.
          </p>
        </div>
        <Link href="/how-it-works" className="btn btn-quiet btn-sm">
          How settlement works
          <ArrowRightIcon size={15} />
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <SplitForm
          venueLabel={venueLabel}
          venueNeighborhood={venueNeighborhood}
          timeZone={timeZone}
          hostId={user.id}
          preselected={preselected
            .filter((member) => member.id !== user.id)
            .map(toPublicMember)}
        />

        <aside className="flex flex-col gap-5">
          <div className="card card-pad rise flex flex-col gap-3">
            <span className="flex items-center gap-2">
              <span
                className="icon-tile size-9"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <PinIcon size={17} />
              </span>
              <span className="eyebrow">Settling with</span>
            </span>
            <p className="text-[0.9375rem] font-semibold tracking-tight">{venueLabel}</p>
            <p className="text-[0.8125rem] text-[var(--muted)]">{venueNeighborhood}</p>
            <Chip tone="accent" dot>
              Check-in active
            </Chip>
            <Link href="/restaurants" className="link mt-1 text-[0.8125rem]">
              Check in somewhere else
            </Link>
          </div>

          <div className="card card-pad rise flex flex-col gap-2.5">
            <p className="eyebrow">Before you open it</p>
            <ul className="flex flex-col gap-2 text-[0.8125rem] leading-5 text-[var(--ink-soft)]">
              <li>Seats are fixed when the table opens, so get the head count right.</li>
              <li>
                Leave extra seats and share the link; anyone who joins signs in
                first.
              </li>
              <li>
                A table left idle closes on its own and refunds anything already
                paid.
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
