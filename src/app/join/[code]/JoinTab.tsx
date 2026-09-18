"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatFly } from "@/money";

export function JoinTab({ tabId, amount }: { tabId: string; amount: string }) {
  const router = useRouter();
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
      router.push(`/tabs/${tabId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not take a seat");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={join}
        className="btn btn-primary self-start"
      >
        {pending ? "Taking a seat…" : `Take a seat — ${formatFly(amount)} FLY`}
      </button>
      <p className="text-xs text-[var(--muted)]">
        This creates a Flynet payment request for your share, payable to the
        venue. Nothing is charged until you confirm it.
      </p>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
