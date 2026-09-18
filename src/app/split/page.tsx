import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { DEMO_USERS, displayName } from "@/auth/demoUsers";
import { getActiveCheckIn } from "@/checkInState";
import { checkIn } from "@/flynetClient";
import { SplitForm } from "./SplitForm";

export const metadata: Metadata = {
  title: "Split the bill · Flynet Tab Split",
};

export default async function SplitPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const active = await getActiveCheckIn();
  if (!active) {
    redirect("/restaurants");
  }

  // Read-only during render: cookie writes are only allowed in a route
  // handler or Server Action.
  let venueLabel = "Your table";
  try {
    const record = await checkIn(active.locationId);
    venueLabel = [
      record.location.restaurant.name,
      record.location.name ?? record.location.neighborhood.name,
    ]
      .filter(Boolean)
      .join(" — ");
  } catch {
    redirect("/restaurants");
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <main className="flex w-full max-w-lg flex-col gap-8">
        <header>
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Split the bill
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Everyone at the table pays their share straight to the venue in FLY
            — nobody fronts the cash.
          </p>
        </header>

        <SplitForm
          venueLabel={venueLabel}
          hostId={user.id}
          members={DEMO_USERS.map((member) => ({
            id: member.id,
            name: displayName(member),
            balance: member.balance.balance.value,
          }))}
        />

        <Link
          href="/restaurants"
          className="text-sm text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          Check in somewhere else
        </Link>
      </main>
    </div>
  );
}
