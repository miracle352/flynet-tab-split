"use client";

import { useRouter } from "next/navigation";
import { displayName } from "@/auth/demoUsers";
import { formatFly, formatUsdCents } from "@/auth/formatFly";
import { useCurrentUser } from "@/auth/useCurrentUser";

export function HomeClient() {
  const router = useRouter();
  const { user, loading, logout } = useCurrentUser();

  if (loading) {
    return (
      <p className="text-sm text-zinc-500" role="status">
        Loading session…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="text-sm text-zinc-500">
        No session.{" "}
        <a className="underline" href="/login">
          Log in
        </a>
      </p>
    );
  }

  const spending = user.wallets.find((wallet) => wallet.wallet_type === "SPENDING");

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div>
        <p className="text-sm text-zinc-500">Logged in as</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {displayName(user)}
        </h1>
        <p className="mt-2 font-mono text-xs text-zinc-500">{user.id}</p>
      </div>
      <dl className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex justify-between gap-4">
          <dt className="text-sm text-zinc-500">FLY balance</dt>
          <dd className="text-sm font-medium">
            {formatFly(user.balance.balance.value)} FLY
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-sm text-zinc-500">USD equivalent</dt>
          <dd className="text-sm font-medium">
            {formatUsdCents(user.balance.balance_usd.value)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-sm text-zinc-500">Spending wallet</dt>
          <dd className="truncate font-mono text-xs">
            {spending?.address ?? "—"}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/login");
          router.refresh();
        }}
        className="self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Log out
      </button>
    </div>
  );
}
