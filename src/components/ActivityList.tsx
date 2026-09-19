"use client";

import Link from "next/link";
import { EmptyState } from "./ui";
import { TimeAgo } from "./TimeAgo";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GiftIcon,
  ReceiptIcon,
  SwapIcon,
} from "./icons";
import { formatDecimal } from "@/money";
import type { LedgerEntry } from "@/ledger/store";

/**
 * Transaction history, grouped by day.
 *
 * Each row carries the USD value captured when it settled, so the
 * history reads like a statement rather than a live re-pricing.
 */

function iconFor(kind: LedgerEntry["kind"], direction: "in" | "out") {
  switch (kind) {
    case "deposit":
      return <ArrowDownIcon size={17} />;
    case "buy_fly":
    case "sell_fly":
      return <SwapIcon size={17} />;
    case "table_share":
      return <ReceiptIcon size={17} />;
    case "refund":
      return <ArrowUpIcon size={17} />;
    case "reward":
      return <GiftIcon size={17} />;
    default:
      return direction === "in" ? <ArrowDownIcon size={17} /> : <ArrowUpIcon size={17} />;
  }
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, yesterday)) {
    return "Yesterday";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(date);
}

function dollars(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${whole}.${(abs % 100).toString().padStart(2, "0")}`;
}

export function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const incoming = entry.direction === "in";
  const amount = formatDecimal(entry.amount, entry.asset === "USDT" ? 2 : 4);

  return (
    <li className="row row-hover">
      <span
        className="icon-tile size-10"
        style={{
          background: incoming ? "var(--accent-soft)" : "var(--surface-sunken)",
          color: incoming ? "var(--accent)" : "var(--ink-soft)",
        }}
      >
        {iconFor(entry.kind, entry.direction)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.875rem] font-medium">{entry.label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-[var(--muted)]">
          <TimeAgo iso={entry.created_at} />
          {entry.detail ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{entry.detail}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className="tnum text-[0.875rem] font-semibold"
          style={{ color: incoming ? "var(--accent)" : "var(--ink)" }}
        >
          {incoming ? "+" : "−"}
          {amount} {entry.asset}
        </p>
        <p className="tnum mt-0.5 text-[0.6875rem] text-[var(--muted)]">
          {dollars(entry.usd_cents)}
        </p>
      </div>
    </li>
  );
}

export function ActivityList({
  entries,
  emptyTitle = "No movements yet",
  emptyBody = "Fund your wallet or settle a table and it will show up here.",
}: {
  entries: LedgerEntry[];
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  const groups = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const key = dayLabel(entry.created_at);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return (
    <div className="flex flex-col">
      {[...groups.entries()].map(([label, rows]) => (
        <div key={label}>
          <p className="eyebrow border-y border-[var(--line)] bg-[var(--surface-sunken)] px-5 py-2 first:border-t-0">
            {label}
          </p>
          <ul className="divide-y divide-[var(--line)]">
            {rows.map((entry) => (
              <li key={entry.id} className="list-none">
                {entry.tab_id ? (
                  <Link href={`/tabs/${entry.tab_id}`} className="block">
                    <LedgerRow entry={entry} />
                  </Link>
                ) : (
                  <LedgerRow entry={entry} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
