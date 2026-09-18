"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  applyTipPercent,
  divideFlyWei,
  formatFly,
  parseFlyToWei,
  sumFlyWei,
} from "@/money";
import type { SplitMode } from "@/tabs/types";

const TIP_PRESETS = [18, 20, 22];

export function SplitForm({ venueLabel }: { venueLabel: string }) {
  const router = useRouter();
  const [subtotal, setSubtotal] = useState("");
  const [tipPercent, setTipPercent] = useState(20);
  const [splitMode, setSplitMode] = useState<SplitMode>("even");
  const [seats, setSeats] = useState(3);
  const [amounts, setAmounts] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      const sub = parseFlyToWei(subtotal);
      const total = applyTipPercent(sub, tipPercent);
      return { sub, total, valid: sub > BigInt(0) };
    } catch {
      return null;
    }
  }, [subtotal, tipPercent]);

  const evenShares = useMemo(() => {
    if (!parsed?.valid || splitMode !== "even" || seats < 1) {
      return null;
    }
    try {
      return divideFlyWei(parsed.total, seats);
    } catch {
      return null;
    }
  }, [parsed, splitMode, seats]);

  // Switching to custom prefills from the even split so there is
  // something sane to edit.
  function switchToCustom() {
    setSplitMode("custom");
    if (evenShares) {
      setAmounts(evenShares.map((share) => formatFly(share)));
    } else if (parsed?.valid) {
      setAmounts(Array.from({ length: seats }, () => "0"));
    }
  }

  const customTotal = useMemo(() => {
    if (splitMode !== "custom" || amounts.length === 0) {
      return null;
    }
    try {
      return sumFlyWei(amounts.map((amount) => parseFlyToWei(amount)));
    } catch {
      return null;
    }
  }, [splitMode, amounts]);

  const customBalanced =
    parsed?.valid && customTotal !== null && customTotal === parsed.total;

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal,
          tipPercent,
          splitMode,
          seats,
          amounts: splitMode === "custom" ? amounts : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not open the table");
      }
      const data = (await res.json()) as { tab: { id: string } };
      router.push(`/tabs/${data.tab.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the table");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Settling with</p>
        <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {venueLabel}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Anchored to your check-in. Each seat pays the venue directly in FLY.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Bill subtotal (FLY)</span>
          <input
            inputMode="decimal"
            value={subtotal}
            onChange={(event) => setSubtotal(event.target.value)}
            placeholder="186.40"
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Tip</span>
          <div className="flex flex-wrap gap-2">
            {TIP_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTipPercent(preset)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  tipPercent === preset
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                }`}
              >
                {preset}%
              </button>
            ))}
            <input
              inputMode="decimal"
              value={tipPercent}
              onChange={(event) => setTipPercent(Number(event.target.value) || 0)}
              aria-label="Custom tip percent"
              className="w-20 rounded-full border border-zinc-300 bg-transparent px-3 py-1.5 text-center text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Split</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSplitMode("even")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                splitMode === "even"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              Evenly
            </button>
            <button
              type="button"
              onClick={switchToCustom}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                splitMode === "custom"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              Custom amounts
            </button>
          </div>
        </div>

        {splitMode === "even" ? (
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">People at the table</span>
            <input
              type="number"
              min={1}
              max={20}
              value={seats}
              onChange={(event) => {
                const next = Math.max(1, Math.min(20, Number(event.target.value) || 1));
                setSeats(next);
              }}
              className="w-20 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-center text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            {amounts.map((amount, index) => (
              <label
                key={index}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-sm text-zinc-500">
                  {index === 0 ? "You" : `Person ${index + 1}`}
                </span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) =>
                    setAmounts((current) =>
                      current.map((value, i) => (i === index ? event.target.value : value)),
                    )
                  }
                  className="w-32 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-right font-mono text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAmounts((current) => [...current, "0"])}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Add person
              </button>
              {customTotal !== null && parsed?.valid ? (
                <span
                  className={`self-center text-xs ${
                    customBalanced ? "text-zinc-500" : "text-amber-600 dark:text-amber-500"
                  }`}
                >
                  {customBalanced
                    ? "Balanced"
                    : `${formatFly(parsed.total - customTotal)} FLY left to assign`}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {parsed?.valid ? (
        <dl className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd className="font-mono">{formatFly(parsed.sub)} FLY</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Tip ({tipPercent}%)</dt>
            <dd className="font-mono">{formatFly(parsed.total - parsed.sub)} FLY</dd>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-700">
            <dt>Total</dt>
            <dd className="font-mono">{formatFly(parsed.total)} FLY</dd>
          </div>
          {evenShares ? (
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <dt>Each of {seats}</dt>
              <dd className="font-mono">{formatFly(evenShares[0])} FLY</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <button
        type="button"
        disabled={pending || !parsed?.valid || (splitMode === "custom" && !customBalanced)}
        onClick={submit}
        className="self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Opening table…" : "Open the table"}
      </button>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
