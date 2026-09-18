"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatFly } from "@/money";

export function PayIntent({
  intentId,
  amount,
  balance,
  venueLabel,
  alreadyPaid,
}: {
  intentId: string;
  amount: string;
  balance: string;
  venueLabel: string;
  alreadyPaid: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owed = BigInt(amount);
  const have = BigInt(balance);
  const short = have < owed;

  async function confirm() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/intents/${intentId}/confirm`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        tab?: { id: string };
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Payment failed");
      }
      if (body?.tab) {
        router.push(`/tabs/${body.tab.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setPending(false);
    }
  }

  if (alreadyPaid) {
    return (
      <p
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
      >
        This share is already paid. Nothing left to do here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {short ? (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span className="font-semibold">Not enough FLY.</span> You have{" "}
          {formatFly(have)} FLY but this share is {formatFly(owed)} FLY — you are{" "}
          {formatFly(owed - have)} FLY short. Top up your wallet and come back.
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || short}
        onClick={confirm}
        className="self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Confirming…" : `Confirm & pay ${formatFly(owed)} FLY`}
      </button>

      <p className="text-xs text-zinc-500">
        Pays {venueLabel} directly. Flynet emails you a receipt.
      </p>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
