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
        className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)]/60 p-5 text-sm text-[var(--ink-soft)]"
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
          className="rounded-2xl border border-[var(--line)] bg-[var(--pending-soft)] p-4 text-sm text-[var(--ink-soft)]"
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
        className="btn btn-primary self-start"
      >
        {pending ? "Confirming…" : `Confirm & pay ${formatFly(owed)} FLY`}
      </button>

      <p className="text-xs text-[var(--muted)]">
        Pays {venueLabel} directly. Flynet emails you a receipt.
      </p>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
