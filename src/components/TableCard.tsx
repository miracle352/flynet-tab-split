"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Chip, ProgressBar } from "./ui";
import { Countdown } from "./Countdown";
import { ArrowRightIcon, CheckIcon, ClockIcon, XIcon } from "./icons";
import { usePrice, useToast, useUser } from "./providers";
import { formatFly } from "@/money";
import { settledCount } from "@/tabs/types";
import type { Tab } from "@/tabs/types";

/**
 * One table, as a card.
 *
 * Handles its own cancel so the action works identically from the home
 * screen, the tables list and the live table view.
 */
export function TableCard({
  tab,
  dense = false,
}: {
  tab: Tab;
  dense?: boolean;
}) {
  const router = useRouter();
  const { user } = useUser();
  const { usd } = usePrice();
  const { push } = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const paid = settledCount(tab);
  const total = tab.shares.length;
  const isHost = user?.id === tab.host_user_id;
  const myShare = tab.shares.find((share) => share.user_id === user?.id);
  const claimed = tab.shares.filter((share) => share.user_id !== null);

  const statusChip =
    tab.status === "settled" ? (
      <Chip tone="accent" dot>
        Settled
      </Chip>
    ) : tab.status === "canceled" ? (
      <Chip tone="danger" dot>
        Canceled
      </Chip>
    ) : tab.status === "expired" ? (
      <Chip tone="idle" dot>
        Closed · idle
      </Chip>
    ) : paid === 0 ? (
      <Chip tone="pending" dot>
        Waiting on everyone
      </Chip>
    ) : (
      <Chip tone="pending" dot>
        {paid} of {total} paid
      </Chip>
    );

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/tabs/${tab.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not cancel the table");
      }
      push({
        title: "Table canceled",
        description: "Anything already paid has been returned to each person.",
        tone: "info",
      });
      setConfirming(false);
      router.refresh();
    } catch (error) {
      push({
        title: "Could not cancel",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <article className="card overflow-hidden">
      <div className={dense ? "px-4 py-3.5" : "px-5 py-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/tabs/${tab.id}`}
              className="group flex items-center gap-1.5 text-[0.9375rem] font-semibold tracking-tight"
            >
              <span className="truncate">{tab.venue_label}</span>
              <ArrowRightIcon
                size={15}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
              />
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-[var(--muted)]">
              <span className="tnum font-medium">{formatFly(tab.total)} FLY</span>
              <span aria-hidden="true">·</span>
              <span className="tnum">{usd(tab.total)}</span>
              {tab.tip_percent > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{tab.tip_percent}% tip</span>
                </>
              ) : null}
              {isHost ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>You are hosting</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {statusChip}
            {tab.status === "open" ? (
              <Countdown expiresAt={tab.expires_at} timeZone={tab.venue_time_zone} compact />
            ) : null}
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-3">
          <ProgressBar paid={paid} total={total} tone={paid === total ? "accent" : "pending"} />
          <span className="tnum shrink-0 text-[0.6875rem] text-[var(--muted)]">
            {paid}/{total}
          </span>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex -space-x-2">
              {claimed.slice(0, 5).map((share) => (
                <Avatar
                  key={share.seat}
                  name={share.display_name ?? "Guest"}
                  hue={(share.seat * 67 + 140) % 360}
                  size={26}
                  ring
                />
              ))}
              {claimed.length > 5 ? (
                <span className="flex size-[26px] items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[0.625rem] font-semibold text-[var(--muted)] ring-2 ring-[var(--surface)]">
                  +{claimed.length - 5}
                </span>
              ) : null}
              {claimed.length === 0 ? (
                <span className="text-[0.75rem] text-[var(--muted)]">No seats claimed yet</span>
              ) : null}
            </span>
            {myShare ? (
              <span className="tnum rounded-full bg-[var(--surface-sunken)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--ink-soft)]">
                Your share {formatFly(myShare.amount)} FLY
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {myShare && myShare.status === "pending" && tab.status === "open" ? (
              <Link href={`/tabs/${tab.id}`} className="btn btn-primary btn-sm">
                Pay share
              </Link>
            ) : null}
            {isHost && tab.status === "open" ? (
              confirming ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={cancel}
                    disabled={cancelling}
                    className="btn btn-danger btn-sm"
                  >
                    <XIcon size={14} />
                    {cancelling ? "Canceling…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={cancelling}
                    className="btn btn-quiet btn-sm"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="btn btn-outline btn-sm"
                >
                  <XIcon size={14} />
                  Cancel
                </button>
              )
            ) : null}
            {tab.status === "settled" ? (
              <span className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--accent)]">
                <CheckIcon size={15} />
                Done
              </span>
            ) : null}
            {tab.status === "expired" || tab.status === "canceled" ? (
              <span className="flex items-center gap-1.5 text-[0.75rem] text-[var(--muted)]">
                <ClockIcon size={14} />
                Closed
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
