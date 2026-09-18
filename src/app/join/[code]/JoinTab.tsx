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
        className="self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Taking a seat…" : `Take a seat — ${formatFly(amount)} FLY`}
      </button>
      <p className="text-xs text-zinc-500">
        This creates a Flynet payment request for your share, payable to the
        venue. Nothing is charged until you confirm it.
      </p>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
