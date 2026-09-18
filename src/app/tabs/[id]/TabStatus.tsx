"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatFly } from "@/money";
import type { Tab, TabShare } from "@/tabs/types";

const POLL_MS = 2500;

function StatusPill({ share }: { share: TabShare }) {
  if (share.status === "paid") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        Paid
      </span>
    );
  }
  if (share.status === "pending") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Awaiting payment
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      Open seat
    </span>
  );
}

export function TabStatus({
  tabId,
  currentUserId,
  initialTab,
}: {
  tabId: string;
  currentUserId: string;
  initialTab: Tab | null;
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
    return <p className="text-sm text-zinc-500">Loading table…</p>;
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
          className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-900 dark:bg-emerald-950/30"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
            >
              ✓
            </span>
            Table settled
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatFly(tab.total)} FLY collected
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All {tab.shares.length} shares paid to {tab.venue_label}. Flynet has
            emailed everyone a receipt.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-2 self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">Invite the table</p>
          <p className="mt-2 font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
            {joinUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <span className="self-center text-sm text-zinc-500">
              Code <span className="font-mono font-semibold">{tab.join_code}</span>
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {tab.venue_label}
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {paidCount} of {tab.shares.length} paid · {formatFly(tab.total)} FLY
            total{tab.tip_percent > 0 ? ` · ${tab.tip_percent}% tip` : ""}
          </p>
        </div>

        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {tab.shares.map((share) => (
            <li
              key={share.seat}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {share.display_name ?? "Empty seat"}
                  {share.user_id === tab.host_user_id ? (
                    <span className="ml-2 text-xs text-zinc-500">host</span>
                  ) : null}
                  {share.user_id === currentUserId ? (
                    <span className="ml-2 text-xs text-zinc-500">you</span>
                  ) : null}
                </p>
                {share.paid_at ? (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    settled <span suppressHydrationWarning>{share.paid_at.slice(11, 16)} UTC</span>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm">{formatFly(share.amount)} FLY</span>
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
            className="self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {paying ? "Confirming…" : `Pay ${formatFly(myShare.amount)} FLY`}
          </button>
          <p className="text-xs text-zinc-500">
            Flynet will email you a receipt at flynet@blackbird.xyz.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
