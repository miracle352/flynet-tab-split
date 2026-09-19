"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Card, CardHead, Chip, KeyValue, Note, ProgressBar, Spinner } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { TimeAgo } from "@/components/TimeAgo";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  GiftIcon,
  LinkIcon,
  SparkIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import { usePrice, useToast, useUser } from "@/components/providers";
import { formatDecimal, formatFly } from "@/money";
import { awaitingClose, paidTotalWei, settledCount, unclaimedCount, unclaimedWei } from "@/tabs/types";
import type { Challenge } from "@/types";
import type { Tab } from "@/tabs/types";

const POLL_MS = 2_500;

export function TabStatus({
  tabId,
  initialTab,
  challenges,
  balance,
}: {
  tabId: string;
  initialTab: Tab;
  challenges: Challenge[];
  balance: string;
}) {
  const router = useRouter();
  const { user, refresh } = useUser();
  const { usd } = usePrice();
  const { push } = useToast();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [covering, setCovering] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshTab = useCallback(async () => {
    try {
      const res = await fetch(`/api/tabs/${tabId}`, { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { tab: Tab };
      setTab(data.tab);
    } catch {
      // A missed poll is not worth surfacing; the next tick retries.
    }
  }, [tabId]);

  // No webhooks here, so the live board polls.
  useEffect(() => {
    let stopped = false;
    async function tick() {
      if (stopped) {
        return;
      }
      await refreshTab();
      if (!stopped) {
        timer.current = setTimeout(tick, POLL_MS);
      }
    }
    timer.current = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [refreshTab]);

  const paid = settledCount(tab);
  const total = tab.shares.length;
  const paidTotal = paidTotalWei(tab);
  const settled = tab.status === "settled";
  const closed = tab.status === "canceled" || tab.status === "expired";
  const myShare = tab.shares.find((share) => share.user_id === user?.id);
  const isHost = user?.id === tab.host_user_id;
  const joinUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/join/${tab.join_code}`;
  const have = BigInt(balance);
  const short = myShare ? have < BigInt(myShare.amount) : false;

  async function pay() {
    setError(null);
    setPaying(true);
    try {
      const res = await fetch(`/api/tabs/${tabId}/pay`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string; tab?: Tab } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Payment failed");
      }
      if (body?.tab) {
        setTab(body.tab);
      }
      await refresh();
      await refreshTab();
      push({ title: "Share settled", description: "The venue has your payment." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  async function cancel() {
    setError(null);
    setCancelling(true);
    try {
      const res = await fetch(`/api/tabs/${tabId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; tab?: Tab } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not cancel the table");
      }
      if (body?.tab) {
        setTab(body.tab);
      }
      setConfirmCancel(false);
      push({
        title: "Table canceled",
        description: "Anything already paid has been returned.",
        tone: "info",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the table");
    } finally {
      setCancelling(false);
    }
  }

  async function cover() {
    setError(null);
    setCovering(true);
    try {
      const res = await fetch(`/api/tabs/${tabId}/cover`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string; tab?: Tab } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not cover the empty seats");
      }
      if (body?.tab) {
        setTab(body.tab);
      }
      await refresh();
      await refreshTab();
      push({ title: "Empty seats covered", description: "The venue has the full check." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cover the empty seats");
    } finally {
      setCovering(false);
    }
  }

  async function close() {
    setError(null);
    setClosing(true);
    try {
      const res = await fetch(`/api/tabs/${tabId}/close`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string; tab?: Tab } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not close the table");
      }
      if (body?.tab) {
        setTab(body.tab);
      }
      push({
        title: "Table closed",
        description: "Settled with the shares that were actually paid.",
        tone: "info",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close the table");
    } finally {
      setClosing(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  const tipAmount = tab.total && tab.subtotal ? BigInt(tab.total) - BigInt(tab.subtotal) : BigInt(0);

  return (
    <div className="flex flex-col gap-5">
      {/* Outcome banners */}
      {settled ? (
        <Card className="rise overflow-hidden border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]">
          <div className="flex flex-col gap-3 px-5 py-6">
            <span className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--accent)]">
              <span className="flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-[0.6875rem] font-bold text-[var(--accent-ink)]">
                ✓
              </span>
              Table settled
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">
              {formatDecimal(paidTotal, 2)} FLY collected
            </h2>
            <p className="text-[0.875rem] leading-6 text-[var(--ink-soft)]">
              {paid === total
                ? `All ${total} ${total === 1 ? "share" : "shares"} paid to ${tab.venue_label}.`
                : `${paid} of ${total} seats paid to ${tab.venue_label} (${
                    total - paid
                  } ${total - paid === 1 ? "seat was" : "seats were"} never claimed.)`}{" "}
              Everyone keeps a receipt in their history.
            </p>

            {challenges.length > 0 ? (
              <div className="mt-1 flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3">
                <p className="eyebrow flex items-center gap-1.5">
                  <GiftIcon size={13} />
                  Rewards at this venue
                </p>
                {challenges.map((challenge) => (
                  <p key={challenge.id} className="text-[0.8125rem] leading-5 text-[var(--ink-soft)]">
                    <span className="font-semibold text-[var(--ink)]">{challenge.title}</span>:{" "}
                    {challenge.description}{" "}
                    <span className="tnum font-semibold text-[var(--accent)]">
                      +{formatFly(challenge.fly_reward.value)} FLY
                    </span>
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-1 flex flex-wrap gap-2">
              <Link href="/" className="btn btn-primary">
                Back to wallet
              </Link>
              <Link href="/activity" className="btn btn-outline">
                See it in history
                <ArrowRightIcon size={15} />
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {closed ? (
        <Card className="rise overflow-hidden">
          <div className="flex flex-col gap-3 px-5 py-5">
            <span className="flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--muted)]">
              <ClockIcon size={16} />
              {tab.status === "canceled" ? "Table canceled" : "Table closed"}
            </span>
            <p className="text-[0.875rem] leading-6 text-[var(--ink-soft)]">
              {tab.cancel_reason ??
                "This table is no longer active. Anything that had already been paid was returned to the person who paid it."}
            </p>
            <Link href="/split" className="btn btn-outline self-start">
              Open a new table
            </Link>
          </div>
        </Card>
      ) : null}

      {/* The table */}
      <Card className="rise overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0">
            <p className="eyebrow">{tab.venue_label}</p>
            <h1 className="display mt-1.5">
              {formatDecimal(tab.total, 2)} FLY
            </h1>
            <p className="tnum mt-1.5 text-[0.8125rem] text-[var(--muted)]">
              {usd(tab.total)} · {paid} of {total} paid
              {tab.tip_percent > 0 ? ` · ${tab.tip_percent}% tip` : ""}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {tab.status === "open" ? (
              <Countdown expiresAt={tab.expires_at} timeZone={tab.venue_time_zone} />
            ) : null}
            <Chip tone={settled ? "accent" : closed ? "idle" : "pending"} dot>
              {settled ? "Settled" : closed ? "Closed" : "In progress"}
            </Chip>
          </div>
        </div>

        <div className="px-5 pb-5">
          <ProgressBar paid={paid} total={total} tone={settled ? "accent" : "pending"} />
        </div>

        <dl className="hairline grid grid-cols-2 divide-x divide-[var(--line)] sm:grid-cols-4">
          <div className="px-5 py-3.5">
            <dt className="eyebrow">Subtotal</dt>
            <dd className="tnum mt-1 text-sm font-semibold">{formatDecimal(tab.subtotal, 2)}</dd>
          </div>
          <div className="px-5 py-3.5">
            <dt className="eyebrow">Tip</dt>
            <dd className="tnum mt-1 text-sm font-semibold">{formatDecimal(tipAmount, 2)}</dd>
          </div>
          <div className="px-5 py-3.5">
            <dt className="eyebrow">Seats</dt>
            <dd className="tnum mt-1 text-sm font-semibold">{total}</dd>
          </div>
          <div className="px-5 py-3.5">
            <dt className="eyebrow">Opened</dt>
            <dd className="mt-1 text-sm font-semibold">
              <TimeAgo iso={tab.created_at} />
            </dd>
          </div>
        </dl>
      </Card>

      {/* Who the bill is split with */}
      <Card className="rise overflow-hidden">
        <CardHead
          title="Split with"
          hint="Everyone with a seat, and where their share stands"
          icon={<SparkIcon size={17} />}
        />
        <ul className="divider divide-y divide-[var(--line)]">
          {tab.shares.map((share) => {
            const isMe = share.user_id === user?.id;
            return (
              <li key={share.seat} className="row">
                {share.user_id ? (
                  <Avatar
                    name={share.display_name ?? "Member"}
                    hue={(share.seat * 67 + 140) % 360}
                    size={38}
                  />
                ) : (
                  <span className="flex size-[38px] items-center justify-center rounded-full border border-dashed border-[var(--line-strong)] text-[var(--muted)]">
                    <LinkIcon size={16} />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 truncate text-[0.875rem] font-medium">
                    {share.display_name ?? "Open seat"}
                    {share.user_id === tab.host_user_id ? (
                      <span className="chip chip-idle">host</span>
                    ) : null}
                    {isMe ? <span className="chip chip-accent">you</span> : null}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                    {share.handle ? `@${share.handle} · ` : ""}
                    {share.status === "paid" ? (
                      <>
                        settled <TimeAgo iso={share.paid_at} />
                      </>
                    ) : share.user_id ? (
                      "awaiting payment"
                    ) : (
                      "waiting for somebody to join"
                    )}
                    {share.refunded_at ? " · refunded" : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tnum text-[0.875rem] font-semibold">
                    {formatDecimal(share.amount, 4)} FLY
                  </p>
                  <p className="tnum mt-0.5 text-[0.6875rem] text-[var(--muted)]">
                    {usd(share.amount)}
                  </p>
                </div>

                <span className="shrink-0">
                  {share.status === "paid" ? (
                    <Chip tone="accent" dot>
                      Paid
                    </Chip>
                  ) : share.status === "pending" ? (
                    <Chip tone="pending" dot>
                      Awaiting
                    </Chip>
                  ) : (
                    <Chip tone="idle" dot>
                      Open
                    </Chip>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Empty seats: everybody seated has paid, the check is not covered */}
      {awaitingClose(tab) ? (
        <Card className="rise overflow-hidden">
          <CardHead
            title="Empty seats left"
            hint={`${unclaimedCount(tab)} ${
              unclaimedCount(tab) === 1 ? "seat was" : "seats were"
            } declared but never claimed`}
            icon={<ClockIcon size={17} />}
          />
          <div className="divider flex flex-col gap-4 px-5 py-5">
            <p className="text-[0.875rem] leading-6 text-[var(--ink-soft)]">
              Everybody who sat down has paid. The{" "}
              <span className="tnum font-semibold">
                {formatDecimal(unclaimedWei(tab), 2)} FLY
              </span>{" "}
              on the empty {unclaimedCount(tab) === 1 ? "seat" : "seats"} has not
              reached the venue. Cover it yourself, or close the table with what
              was collected.
            </p>

            {isHost ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={cover}
                  disabled={covering}
                  className="btn btn-primary"
                >
                  {covering ? <Spinner size={16} /> : <CheckIcon size={16} />}
                  {covering
                    ? "Covering…"
                    : `Cover the empty ${unclaimedCount(tab) === 1 ? "seat" : "seats"}`}
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={closing}
                  className="btn btn-outline"
                >
                  {closing ? <Spinner size={16} /> : null}
                  Close with {formatDecimal(paidTotal, 2)} FLY
                </button>
              </div>
            ) : (
              <Note>
                Everybody at the table has paid. The host decides whether to cover
                the empty seats or close the table with what was collected.
              </Note>
            )}

            {error ? (
              <p role="alert" className="alert alert-danger">
                {error}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Your action */}
      {myShare && myShare.status === "pending" && tab.status === "open" ? (
        <Card className="rise overflow-hidden">
          <CardHead
            title="Your share"
            hint={`Pays ${tab.venue_label} directly`}
            icon={<WalletIcon size={17} />}
          />
          <div className="divider flex flex-col gap-4 px-5 py-5">
            <dl className="flex flex-col">
              <KeyValue label="Amount owed" strong>
                {formatDecimal(myShare.amount, 4)} FLY ({usd(myShare.amount)})
              </KeyValue>
              <KeyValue label="Your balance">
                {formatDecimal(balance, 4)} FLY ({usd(balance)})
              </KeyValue>
            </dl>

            {short ? (
              <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--pending)_30%,var(--line))] bg-[var(--pending-soft)] px-4 py-3.5">
                <p className="text-[0.8125rem] leading-5 text-[var(--pending)]">
                  You are {formatDecimal(BigInt(myShare.amount) - have, 4)} FLY short. Fund your
                  wallet with FLY, or deposit USDT and swap it; the table stays
                  open while you do.
                </p>
                <Link href="/wallet" className="btn btn-primary btn-sm self-start">
                  Fund wallet
                  <ArrowRightIcon size={15} />
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              onClick={pay}
              disabled={paying || short}
              className="btn btn-primary btn-block btn-lg"
            >
              {paying ? <Spinner size={17} /> : <CheckIcon size={17} />}
              {paying ? "Settling…" : `Pay ${formatDecimal(myShare.amount, 4)} FLY`}
            </button>
            {error ? (
              <p role="alert" className="alert alert-danger">
                {error}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Invite + host controls */}
      {tab.status === "open" ? (
        <Card className="rise overflow-hidden">
          <CardHead
            title="Invite the table"
            hint="Anyone with this link signs in and claims an open seat"
            icon={<LinkIcon size={17} />}
          />
          <div className="divider flex flex-col gap-4 px-5 py-5">
            <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--line-strong)] bg-[var(--surface-sunken)] px-3.5 py-3">
              <span className="min-w-0 flex-1 truncate font-mono text-[0.75rem] text-[var(--ink-soft)]">
                {joinUrl}
              </span>
              <button type="button" onClick={copyLink} className="btn btn-outline btn-sm">
                <CopyIcon size={14} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[0.8125rem] text-[var(--muted)]">Table code</span>
              <span className="tnum rounded-[var(--radius)] border border-[var(--line)] px-3 py-1.5 font-mono text-sm font-semibold tracking-[0.2em]">
                {tab.join_code}
              </span>
            </div>

            {isHost ? (
              <div className="hairline flex flex-wrap items-center justify-between gap-3 pt-4">
                <div>
                  <p className="text-[0.875rem] font-semibold">Host controls</p>
                  <p className="mt-0.5 text-[0.75rem] leading-5 text-[var(--muted)]">
                    Canceling closes the table and returns anything already paid.
                  </p>
                </div>
                {confirmCancel ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancel}
                      disabled={cancelling}
                      className="btn btn-danger btn-sm"
                    >
                      {cancelling ? <Spinner size={14} /> : <XIcon size={14} />}
                      {cancelling ? "Canceling…" : "Yes, cancel it"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                      className="btn btn-quiet btn-sm"
                    >
                      Keep open
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="btn btn-outline btn-sm"
                  >
                    <XIcon size={14} />
                    Cancel table
                  </button>
                )}
              </div>
            ) : (
              <Note>
                Only {tab.shares.find((share) => share.user_id === tab.host_user_id)?.display_name ?? "the host"}{" "}
                can cancel this table. If it goes idle it closes on its own and
                refunds everyone.
              </Note>
            )}
          </div>
        </Card>
      ) : null}

      {settled ? null : (
        <button
          type="button"
          onClick={() => {
            void refreshTab();
            router.refresh();
          }}
          className="btn btn-quiet btn-sm self-center"
        >
          Refresh the board
        </button>
      )}
    </div>
  );
}
