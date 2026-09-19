import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { TableCard } from "@/components/TableCard";
import { Card, CardHead, EmptyState } from "@/components/ui";
import { PlusIcon, ReceiptIcon } from "@/components/icons";
import { IDLE_WINDOW_MINUTES } from "@/tabs/types";
import { expireStaleTabs } from "@/tabs/service";

export const metadata: Metadata = {
  title: "Tables",
  description: "Every table you host or have a seat at.",
};

export default async function TablesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/tables");
  }

  const tabs = (await expireStaleTabs()).filter(
    (tab) =>
      tab.host_user_id === user.id ||
      tab.shares.some((share) => share.user_id === user.id),
  );

  const live = tabs.filter((tab) => tab.status === "open");
  const settled = tabs.filter((tab) => tab.status === "settled");
  const closed = tabs.filter((tab) => tab.status === "canceled" || tab.status === "expired");

  return (
    <div className="flex flex-col gap-7">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Tables</p>
          <h1 className="display mt-1.5">Your tables</h1>
          <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-[var(--muted)]">
            A table stays open while people are settling it. Leave one idle for{" "}
            {IDLE_WINDOW_MINUTES} minutes and it closes itself, returning anything
            already paid.
          </p>
        </div>
        <Link href="/split" className="btn btn-primary">
          <PlusIcon size={16} />
          Open a table
        </Link>
      </header>

      <Section title="Open now" hint={`${live.length} waiting on shares`} tabs={live} />
      <Section title="Settled" hint={`${settled.length} paid in full`} tabs={settled} />
      <Section
        title="Canceled or closed"
        hint={`${closed.length} no longer active`}
        tabs={closed}
      />
    </div>
  );
}

function Section({
  title,
  hint,
  tabs,
}: {
  title: string;
  hint: string;
  tabs: import("@/tabs/types").Tab[];
}) {
  if (tabs.length === 0 && title !== "Open now") {
    return null;
  }

  return (
    <Card className="rise overflow-hidden">
      <CardHead title={title} hint={hint} icon={<ReceiptIcon size={17} />} />
      {tabs.length === 0 ? (
        <div className="divider">
          <EmptyState
            title="Nothing open"
            body="Check in at a venue and open a table. You can pick people from your contacts or send an invite link."
            icon={<ReceiptIcon size={20} />}
            action={
              <Link href="/split" className="btn btn-primary btn-sm mt-1">
                Open a table
              </Link>
            }
          />
        </div>
      ) : (
        <div className="divider grid gap-3 p-4 lg:grid-cols-2">
          {tabs.map((tab) => (
            <TableCard key={tab.id} tab={tab} />
          ))}
        </div>
      )}
    </Card>
  );
}
