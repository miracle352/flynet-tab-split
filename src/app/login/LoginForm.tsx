"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { displayName } from "@/auth/demoUsers";
import { formatFly, formatUsdCents } from "@/auth/formatFly";
import type { CurrentUser } from "@/auth/types";

export function LoginForm({ users }: { users: CurrentUser[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function logInAs(userId: string) {
    setError(null);
    setPendingId(userId);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Login failed");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setPendingId(null);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {users.map((user) => {
        const busy = pendingId === user.id;
        return (
          <button
            key={user.id}
            type="button"
            disabled={pendingId !== null}
            onClick={() => logInAs(user.id)}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-zinc-400 hover:shadow disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-500"
          >
            <span>
              <span className="block text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {displayName(user)}
              </span>
              <span className="mt-1 block font-mono text-xs text-zinc-500">
                {user.id}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {busy ? "Signing in…" : `${formatFly(user.balance.balance.value)} FLY`}
              </span>
              <span className="block text-xs text-zinc-500">
                {formatUsdCents(user.balance.balance_usd.value)}
              </span>
            </span>
          </button>
        );
      })}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
