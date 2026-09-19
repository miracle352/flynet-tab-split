"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Spinner } from "@/components/ui";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { useToast, useUser } from "@/components/providers";
import { formatDecimal } from "@/money";

export function JoinTab({
  tabId,
  amount,
  venueLabel,
}: {
  tabId: string;
  amount: string;
  venueLabel: string;
}) {
  const router = useRouter();
  const { refresh } = useUser();
  const { push } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/tabs/${tabId}/join`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not take a seat");
      }
      await refresh();
      push({
        title: "Seat claimed",
        description: `Your ${formatDecimal(amount, 4)} FLY share is ready to settle.`,
      });
      router.push(`/tabs/${tabId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not take a seat");
      setPending(false);
    }
  }

  return (
    <Card className="rise card-pad flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={join}
        className="btn btn-primary btn-block btn-lg"
      >
        {pending ? <Spinner size={17} /> : <CheckIcon size={17} />}
        {pending ? "Taking your seat…" : `Take a seat — ${formatDecimal(amount, 4)} FLY`}
      </button>

      <p className="flex items-start gap-2 text-[0.75rem] leading-5 text-[var(--muted)]">
        <ShieldIcon size={15} className="mt-0.5 shrink-0" />
        This creates a payment request for your share at {venueLabel}. Nothing is
        charged until you confirm it yourself.
      </p>

      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
