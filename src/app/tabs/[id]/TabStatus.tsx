"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatFly } from "@/money";
import type { Tab, TabShare } from "@/tabs/types";
import type { Challenge } from "@/types";

const POLL_MS = 2500;

function StatusPill({ share }: { share: TabShare }) {
  if (share.status === "paid") {
    return (
      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
        Paid
      </span>
    );
  }
  if (share.status === "pending") {
    return (
      <span className="rounded-full bg-[var(--pending-soft)] px-2.5 py-1 text-xs font-medium text-[var(--pending)]">
        Awaiting payment
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
      Open seat
    </span>
  );
}

export function TabStatus({
  tabId,
  currentUserId,
  initialTab,
  challenges,
}: {
  tabId: string;
  currentUserId: string;
  initialTab: Tab | null;
  challenges: Challenge[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab | null>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
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

  // No webhooks in Flynet v1, so the live view polls.
  useEffect(() => {
    let stopped = false;

    async function tick() {
      if (stopped) {
        return;
      }
      await refresh();
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
  }, [refresh]);

  if (!tab) {
    return <p className="text-sm text-[var(--muted)]">Loading table…</p>;
  }

  const paidCount = tab.shares.filter((share) => share.status === "paid").length;
  const settled = tab.status === "settled";
  const myShare = tab.shares.find((share) => share.user_id === currentUserId);
  const joinUrl = `${typeof window === "undefined" ? "" : window.location.origin}/join/${tab.join_code}`;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {settled ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)]/60 p-6/30"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--bg)]"
            >
              ✓
            </span>
            Table settled
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {formatFly(tab.total)} FLY collected
          </h2>
          <p className="text-sm text-[var(--ink-soft)]">
            All {tab.shares.length} shares paid to {tab.venue_label}. Flynet has
            emailed everyone a receipt.
          </p>
          {challenges.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2 border-t border-[var(--line)] pt-3">
              {challenges.map((challenge) => (
                <li key={challenge.id} className="text-sm text-[var(--ink-soft)]">
                  <span className="font-medium">{challenge.title}</span> —{" "}
                  {challenge.description}{" "}
                  <span className="font-mono text-[var(--accent)]">
                    +{formatFly(challenge.fly_reward.value)} FLY
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-2 self-start rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="card">
          <p className="text-sm text-[var(--muted)]">Invite the table</p>
          <p className="mt-2 font-mono text-xs break-all text-[var(--ink-soft)]">
            {joinUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-sunken)]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <span className="self-center text-sm text-[var(--muted)]">
              Code <span className="font-mono font-semibold">{tab.join_code}</span>
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--ink)]">
            {tab.venue_label}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {paidCount} of {tab.shares.length} paid · {formatFly(tab.total)} FLY
            total{tab.tip_percent > 0 ? ` · ${tab.tip_percent}% tip` : ""}
          </p>
        </div>

        <ul className="divide-y divide-[var(--line)]">
          {tab.shares.map((share) => (
            <li
              key={share.seat}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--ink)]">
                  {share.display_name ?? "Empty seat"}
                  {share.user_id === tab.host_user_id ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">host</span>
                  ) : null}
                  {share.user_id === currentUserId ? (
                    <span className="ml-2 text-xs text-[var(--muted)]">you</span>
                  ) : null}
                </p>
                {share.paid_at ? (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    settled <span suppressHydrationWarning>{share.paid_at.slice(11, 16)} UTC</span>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm">{formatFly(share.amount)} FLY</span>
                {share.user_id === currentUserId &&
                share.status === "pending" &&
                share.payment_intent_id ? (
                  <Link
                    href={`/pay/${share.payment_intent_id}`}
                    className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] hover:opacity-90"
                  >
                    Pay
                  </Link>
                ) : null}
                <StatusPill share={share} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {myShare && myShare.status === "pending" ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={paying}
            onClick={pay}
            className="btn btn-primary self-start"
          >
            {paying ? "Confirming…" : `Pay ${formatFly(myShare.amount)} FLY`}
          </button>
          <p className="text-xs text-[var(--muted)]">
            Flynet will email you a receipt at flynet@blackbird.xyz.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
