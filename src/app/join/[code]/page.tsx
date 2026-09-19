import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { Avatar, Card, CardHead, Chip, KeyValue, Note } from "@/components/ui";
import { ArrowRightIcon, LinkIcon } from "@/components/icons";
import { formatDecimal } from "@/money";
import { getTabByCode } from "@/tabs/store";
import { JoinTab } from "./JoinTab";

export const metadata: Metadata = {
  title: "Join the table",
  description: "Claim your seat and settle your share of the table.",
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  const tab = await getTabByCode(code);
  if (!tab) {
    notFound();
  }

  // Already seated — straight to the live board.
  const existingSeat = tab.shares.find((share) => share.user_id === user.id);
  if (existingSeat) {
    redirect(`/tabs/${tab.id}`);
  }

  const freeSeat = tab.shares.find((share) => share.user_id === null);
  const claimed = tab.shares.filter((share) => share.user_id !== null);
  const host = tab.shares.find((share) => share.user_id === tab.host_user_id);
  const closed = tab.status !== "open";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <header className="rise flex flex-col items-center gap-3 pt-4 text-center">
        <span
          className="icon-tile size-14"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <LinkIcon size={24} />
        </span>
        <div>
          <h1 className="display">You&apos;re invited to the table</h1>
          <p className="mt-2 text-[0.875rem] leading-6 text-[var(--muted)]">
            {host?.display_name ?? "Somebody"} opened a table at {tab.venue_label}.
            Take a seat and your share becomes a payment request you confirm
            yourself.
          </p>
        </div>
      </header>

      <Card className="rise overflow-hidden">
        <CardHead
          title={tab.venue_label}
          hint={`Table code ${tab.join_code}`}
          action={
            closed ? (
              <Chip tone="idle" dot>
                {tab.status === "settled" ? "Settled" : "Closed"}
              </Chip>
            ) : (
              <Chip tone="pending" dot>
                Waiting on seats
              </Chip>
            )
          }
        />
        <dl className="divider flex flex-col px-5 py-4">
          <KeyValue label="Table total">
            {formatDecimal(tab.total, 2)} FLY
          </KeyValue>
          <KeyValue label="Seats claimed">
            {claimed.length} of {tab.shares.length}
          </KeyValue>
          <KeyValue label="Your share" strong>
            {freeSeat ? `${formatDecimal(freeSeat.amount, 4)} FLY` : "—"}
          </KeyValue>
        </dl>

        {claimed.length > 0 ? (
          <div className="hairline px-5 py-4">
            <p className="eyebrow mb-3">Already at the table</p>
            <ul className="flex flex-wrap gap-2">
              {claimed.map((share) => (
                <li key={share.seat} className="flex items-center gap-2 rounded-full border border-[var(--line)] py-1 pl-1 pr-3">
                  <Avatar
                    name={share.display_name ?? "Member"}
                    hue={(share.seat * 67 + 140) % 360}
                    size={26}
                  />
                  <span className="text-[0.75rem] font-medium">{share.display_name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {closed ? (
        <Card className="rise card-pad flex flex-col gap-3">
          <p className="text-[0.875rem] font-semibold">
            {tab.status === "settled"
              ? "This table has already settled."
              : tab.status === "canceled"
                ? "The host canceled this table."
                : "This table closed before everyone paid."}
          </p>
          <Link href="/split" className="btn btn-primary btn-sm self-start">
            Open your own table
            <ArrowRightIcon size={15} />
          </Link>
        </Card>
      ) : freeSeat ? (
        <JoinTab tabId={tab.id} amount={freeSeat.amount} venueLabel={tab.venue_label} />
      ) : (
        <Card className="rise card-pad">
          <Note>Every seat at this table is taken. Ask the host to add another.</Note>
        </Card>
      )}
    </div>
  );
}
