"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Spinner } from "@/components/ui";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { usePrice, useToast, useUser } from "@/components/providers";
import { formatDecimal } from "@/money";

export function PayIntent({
  intentId,
  amount,
  balance,
  venueLabel,
  alreadyPaid,
  tabId,
  tableOpen,
}: {
  intentId: string;
  amount: string;
  balance: string;
  venueLabel: string;
  alreadyPaid: boolean;
  tabId: string;
  tableOpen: boolean;
}) {
  const router = useRouter();
  const { refresh } = useUser();
  const { usd } = usePrice();
  const { push } = useToast();
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
      await refresh();
      push({
        title: "Share settled",
        description: `${venueLabel} has your payment.`,
      });
      router.push(`/tabs/${body?.tab?.id ?? tabId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setPending(false);
    }
  }

  if (alreadyPaid) {
    return (
      <Card className="rise card-pad flex flex-col gap-3">
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--accent)]">
          <CheckIcon size={17} />
          This share is already settled
        </p>
        <p className="text-[0.8125rem] leading-5 text-[var(--muted)]">
          Nothing left to do here — it is in your transaction history.
        </p>
        <Link href={`/tabs/${tabId}`} className="btn btn-outline btn-sm self-start">
          See the table
          <ArrowRightIcon size={15} />
        </Link>
      </Card>
    );
  }

  if (!tableOpen) {
    return (
      <Card className="rise card-pad flex flex-col gap-3">
        <p className="text-[0.875rem] font-semibold">This table is closed</p>
        <p className="text-[0.8125rem] leading-5 text-[var(--muted)]">
          It settled, was canceled, or went idle before everyone paid. Anything
          you had already paid was returned to your wallet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rise card-pad flex flex-col gap-4">
      {short ? (
        <p role="alert" className="alert alert-pending">
          <span className="font-semibold">Not enough FLY.</span> You have{" "}
          <span className="tnum">{formatDecimal(have, 4)} FLY</span> but this
          share is <span className="tnum">{formatDecimal(owed, 4)} FLY</span> —{" "}
          <span className="tnum">{formatDecimal(owed - have, 4)} FLY</span> short.
          Fund your wallet with FLY, or deposit USDT and swap it at the live rate.
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || short}
        onClick={confirm}
        className="btn btn-primary btn-block btn-lg"
      >
        {pending ? <Spinner size={17} /> : <CheckIcon size={17} />}
        {pending ? "Settling…" : `Confirm & pay ${formatDecimal(owed, 4)} FLY`}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.75rem] text-[var(--muted)]">
          Pays {venueLabel} directly · {usd(amount)} at the live quote
        </p>
        {short ? (
          <Link href="/wallet" className="btn btn-outline btn-sm">
            Fund wallet
            <ArrowRightIcon size={15} />
          </Link>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
