"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { applyTipPercent, formatFly, parseFlyToWei, sumFlyWei } from "@/money";
import { splitBill } from "@/splitBill";
import type { SplitMode } from "@/tabs/types";

const TIP_PRESETS = [18, 20, 22];

export interface MemberOption {
  id: string;
  name: string;
  balance: string;
}

export function SplitForm({
  venueLabel,
  members,
  hostId,
}: {
  venueLabel: string;
  members: MemberOption[];
  hostId: string;
}) {
  const router = useRouter();
  const [subtotal, setSubtotal] = useState("");
  const [tipPercent, setTipPercent] = useState(20);
  const [splitMode, setSplitMode] = useState<SplitMode>("even");
  const [selected, setSelected] = useState<string[]>([hostId]);
  const [openSeats, setOpenSeats] = useState(0);
  const [amounts, setAmounts] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      const sub = parseFlyToWei(subtotal);
      return { sub, total: applyTipPercent(sub, tipPercent), valid: sub > BigInt(0) };
    } catch {
      return null;
    }
  }, [subtotal, tipPercent]);

  const seatCount = selected.length + openSeats;

  const evenShares = useMemo(() => {
    if (!parsed?.valid || seatCount < 1) {
      return null;
    }
    try {
      return splitBill(parsed.total.toString(), seatCount).map(BigInt);
    } catch {
      return null;
    }
  }, [parsed, seatCount]);

  function toggle(id: string) {
    if (id === hostId) {
      return; // the host is always at their own table
    }
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function switchToCustom() {
    setSplitMode("custom");
    setAmounts(
      evenShares
        ? evenShares.map((share) => formatFly(share))
        : Array.from({ length: seatCount }, () => "0"),
    );
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
    parsed?.valid &&
    customTotal !== null &&
    customTotal === parsed.total &&
    amounts.length === seatCount;

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
          participantIds: selected,
          openSeats,
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
      <div className="card">
        <p className="text-sm text-[var(--muted)]">Settling with</p>
        <p className="mt-1 text-base font-semibold text-[var(--ink)]">
          {venueLabel}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Anchored to your check-in. Each seat pays the venue directly in FLY.
        </p>
      </div>

      <div className="flex flex-col gap-5 card">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Bill subtotal (FLY)</span>
          <input
            inputMode="decimal"
            value={subtotal}
            onChange={(event) => setSubtotal(event.target.value)}
            placeholder="186.40"
            className="rounded-xl border border-[var(--line-strong)] bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[var(--line-strong)]"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Tip</span>
          <div className="flex flex-wrap items-center gap-2">
            {TIP_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTipPercent(preset)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  tipPercent === preset
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                    : "border-[var(--line-strong)] hover:bg-[var(--surface-sunken)]"
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
              className="w-20 input !rounded-full !px-3 !py-1.5 text-center"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Who is splitting it?</legend>
          <div className="flex flex-col gap-2">
            {members.map((member) => {
              const isHost = member.id === hostId;
              const on = selected.includes(member.id);
              return (
                <label
                  key={member.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                    on
                      ? "border-[var(--ink)]"
                      : "border-[var(--line)]"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={isHost}
                      onChange={() => toggle(member.id)}
                      className="size-4"
                    />
                    {member.name}
                    {isHost ? <span className="text-xs text-[var(--muted)]">you</span> : null}
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)]">
                    {formatFly(member.balance)} FLY
                  </span>
                </label>
              );
            })}
          </div>
          <label className="mt-1 flex items-center justify-between gap-4 text-sm">
            <span className="text-[var(--muted)]">Extra seats for link invites</span>
            <input
              type="number"
              min={0}
              max={10}
              value={openSeats}
              onChange={(event) =>
                setOpenSeats(Math.max(0, Math.min(10, Number(event.target.value) || 0)))
              }
              className="w-20 input text-center"
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            Flynet has no friends API, so picked members are chosen here. Anyone
            else joins with the invite link instead.
          </p>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Split</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSplitMode("even")}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                splitMode === "even"
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                  : "border-[var(--line-strong)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              Evenly
            </button>
            <button
              type="button"
              onClick={switchToCustom}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                splitMode === "custom"
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--bg)]"
                  : "border-[var(--line-strong)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              Custom amounts
            </button>
          </div>
        </div>

        {splitMode === "custom" ? (
          <div className="flex flex-col gap-2">
            {amounts.map((amount, index) => (
              <label key={index} className="flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--muted)]">Seat {index + 1}</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) =>
                    setAmounts((current) =>
                      current.map((value, i) => (i === index ? event.target.value : value)),
                    )
                  }
                  className="w-32 input"
                />
              </label>
            ))}
            {customTotal !== null && parsed?.valid ? (
              <span
                className={`text-xs ${
                  customBalanced ? "text-[var(--muted)]" : "text-[var(--pending)]"
                }`}
              >
                {customBalanced
                  ? "Balanced"
                  : `${formatFly(parsed.total - customTotal)} FLY left to assign`}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {parsed?.valid ? (
        <dl className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-sunken)] p-5 text-sm/50">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Subtotal</dt>
            <dd className="font-mono">{formatFly(parsed.sub)} FLY</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Tip ({tipPercent}%)</dt>
            <dd className="font-mono">{formatFly(parsed.total - parsed.sub)} FLY</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--line)] pt-2 font-semibold">
            <dt>Total</dt>
            <dd className="font-mono">{formatFly(parsed.total)} FLY</dd>
          </div>
          {evenShares ? (
            <div className="flex justify-between text-[var(--ink-soft)]">
              <dt>Each of {seatCount}</dt>
              <dd className="font-mono">{formatFly(evenShares[0])} FLY</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <button
        type="button"
        disabled={pending || !parsed?.valid || seatCount < 1 || (splitMode === "custom" && !customBalanced)}
        onClick={submit}
        className="btn btn-primary self-start"
      >
        {pending ? "Opening table…" : `Request ${seatCount} ${seatCount === 1 ? "payment" : "payments"}`}
      </button>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
