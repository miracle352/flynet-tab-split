"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LogoMark } from "@/components/Logo";
import { Spinner } from "@/components/ui";
import { ArrowRightIcon, CheckIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { useUser } from "@/components/providers";
import { usePrice } from "@/components/providers";
import { formatFly, formatUsdt } from "@/money";
import type { CurrentUser } from "@/auth/types";

type Mode = "signin" | "signup";

const PERKS = [
  {
    icon: <SparkIcon size={18} />,
    title: "Fund with FLY or USDT",
    body: "Deposit either asset, swap between them at the live rate, and settle in FLY.",
  },
  {
    icon: <ShieldIcon size={18} />,
    title: "Every payer is real",
    body: "People you pick, or people who arrive by invite, sign in with their own wallet.",
  },
  {
    icon: <CheckIcon size={18} />,
    title: "One tap at the table",
    body: "Each seat pays the venue directly — no Venmo chain, no fronting the cash.",
  },
];

export function AuthForm({
  next,
  oauthEnabled,
  initialUser,
}: {
  next?: string;
  oauthEnabled: boolean;
  initialUser: CurrentUser | null;
}) {
  const router = useRouter();
  const { apply } = useUser();
  const { quote } = usePrice();

  const [mode, setMode] = useState<Mode>("signin");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
    const payload =
      mode === "signin"
        ? { email, password }
        : { firstName, lastName, handle: handle || undefined, email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        user?: CurrentUser;
      } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? "Something went wrong. Try again.");
      }

      apply(body?.user ?? initialUser);
      router.push(next ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const priceUsd = (quote.priceMicro / 1_000_000).toFixed(4);

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(150deg,var(--hero-from),var(--hero-via)_48%,var(--hero-to))] p-12 text-[#eafff7] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-24 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.22),transparent_62%)]"
        />
        <div className="relative">
          <span className="flex items-center gap-3">
            <LogoMark size={40} />
            <span className="flex flex-col leading-none">
              <span className="text-lg font-semibold tracking-tight">FlyTab</span>
              <span className="mt-1 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-[#c9f5e6]">
                Split the check
              </span>
            </span>
          </span>

          <h1 className="mt-14 max-w-lg text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.03em]">
            Split the check at the table. Settle it in FLY.
          </h1>
          <p className="mt-5 max-w-md text-[0.9375rem] leading-7 text-[#d7f6ec]">
            Check in, open a table, and every seat pays the venue directly. No
            one fronts the bill, nobody chases anyone on the way home.
          </p>

          <ul className="mt-10 flex max-w-md flex-col gap-5">
            {PERKS.map((perk) => (
              <li key={perk.title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(255_255_255/0.16)]">
                  {perk.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{perk.title}</span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-5 text-[#c9f0e3]">
                    {perk.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-3 rounded-2xl border border-[rgb(255_255_255/0.22)] bg-[rgb(255_255_255/0.12)] px-4 py-3 backdrop-blur">
          <span className="live-dot size-2 rounded-full bg-[#8ff5d2]" />
          <span className="text-[0.8125rem]">
            FLY is trading at{" "}
            <span className="tnum font-semibold">${priceUsd}</span> right now
          </span>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <span className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark size={38} />
            <span className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-tight">FlyTab</span>
              <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                Split the check
              </span>
            </span>
          </span>

          <div className="segmented mb-7 w-full" role="tablist" aria-label="Sign in or create an account">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className="flex-1"
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className="flex-1"
            >
              Create account
            </button>
          </div>

          <h2 className="display">
            {mode === "signin" ? "Welcome back" : "Create your wallet"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {mode === "signin"
              ? "Sign in to see your balance, your tables and the people you split with."
              : "Two minutes and you can check in, hold FLY or USDT, and settle your share."}
          </p>

          {oauthEnabled ? (
            <a
              href={`/api/auth/oauth/start${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              className="btn btn-ink btn-block btn-lg mt-7"
            >
              Continue with FlyTab
            </a>
          ) : null}

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
            {mode === "signup" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="field-label">First name</span>
                  <input
                    className="input"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="field-label">Last name</span>
                  <input
                    className="input"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </label>
              </div>
            ) : null}

            {mode === "signup" ? (
              <label className="flex flex-col gap-1.5">
                <span className="field-label">
                  Handle <span className="font-normal text-[var(--muted)]">optional</span>
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
                    @
                  </span>
                  <input
                    className="input pl-7"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="yourname"
                    autoComplete="nickname"
                  />
                </div>
                <span className="field-hint">How your table finds you when they split a bill.</span>
              </label>
            ) : null}

            <label className="flex flex-col gap-1.5">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="field-label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
              {mode === "signup" ? (
                <span className="field-hint">At least 8 characters.</span>
              ) : null}
            </label>

            {error ? (
              <p role="alert" className="alert alert-danger">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="btn btn-primary btn-block btn-lg mt-1">
              {busy ? <Spinner size={17} /> : null}
              {busy
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating your wallet…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              {!busy ? <ArrowRightIcon size={17} /> : null}
            </button>
          </form>

          {mode === "signup" ? (
            <p className="mt-6 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3 text-[0.8125rem] leading-5 text-[var(--ink-soft)]">
              New wallets open with{" "}
              <span className="tnum font-semibold">{formatFly(BigInt(120) * BigInt(10) ** BigInt(18))} FLY</span>{" "}
              and{" "}
              <span className="tnum font-semibold">{formatUsdt(BigInt(50) * BigInt(10) ** BigInt(18))} USDT</span>{" "}
              so you can settle your first table straight away.
            </p>
          ) : null}

          <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]">
            By continuing you agree that shares are settled directly with the
            venue in FLY.
          </p>
        </div>
      </main>
    </div>
  );
}
