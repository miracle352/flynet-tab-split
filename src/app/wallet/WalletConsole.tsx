"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Card, CardHead, Chip, CopyField, KeyValue, Sheet, Spinner } from "@/components/ui";
import { QrPattern } from "@/components/QrPattern";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PlusIcon,
  QrIcon,
  ShieldIcon,
  SwapIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import { usePrice, useToast, useUser } from "@/components/providers";
import {
  FLY_WEI,
  formatDecimal,
  formatFly,
  formatUsdt,
  parseDecimalToWei,
} from "@/money";
import { memberName } from "@/users/types";
import { formatUsdCents, usdCentsFromFly } from "@/price/fly";
import type { DepositAddress } from "@/wallet/service";

const FEE_BPS = 30n;
const PRESETS = ["25", "50", "100", "250"];

export type WalletTab = "fund" | "swap" | "wallet";

const PROVIDERS = [
  { id: "metamask", name: "MetaMask", blurb: "Browser extension & mobile" },
  { id: "coinbase", name: "Coinbase Wallet", blurb: "Extension, mobile & smart wallet" },
  { id: "rabby", name: "Rabby", blurb: "Multi-chain extension" },
  { id: "phantom", name: "Phantom", blurb: "Solana & EVM" },
];

export function WalletConsole({
  initialTab,
  addresses,
}: {
  initialTab: WalletTab;
  addresses: Record<"FLY" | "USDT", DepositAddress>;
}) {
  const router = useRouter();
  const { user, apply, refresh } = useUser();
  const { priceMicro, usd, dollars, quote, change, up } = usePrice();

  /** Both assets priced in USD at the current quote. */
  function totalUsd(flyWei: bigint, usdtWei: bigint): string {
    const cents =
      usdCentsFromFly(flyWei, priceMicro) + usdtWei / BigInt(10) ** BigInt(16);
    return formatUsdCents(cents);
  }
  const { push } = useToast();

  const [tab, setTab] = useState<WalletTab>(initialTab);
  const [asset, setAsset] = useState<"FLY" | "USDT">("FLY");
  const [amount, setAmount] = useState("100");
  const [source, setSource] = useState<"address" | "wallet">("address");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [swapFrom, setSwapFrom] = useState<"USDT" | "FLY">("USDT");
  const [swapAmount, setSwapAmount] = useState("50");
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const [providerSheet, setProviderSheet] = useState(false);
  const [created, setCreated] = useState<{ address: string; phrase: string[] } | null>(null);

  // A deposit reads like a real transfer: broadcast, then confirmed.
  useEffect(() => {
    if (!confirming) {
      return;
    }
    const timer = setTimeout(() => setConfirming(false), 2_400);
    return () => clearTimeout(timer);
  }, [confirming]);

  const amountWei = useMemo(() => {
    try {
      const parsed = parseDecimalToWei(amount);
      return parsed > BigInt(0) ? parsed : null;
    } catch {
      return null;
    }
  }, [amount]);

  const swapWei = useMemo(() => {
    try {
      const parsed = parseDecimalToWei(swapAmount);
      return parsed > BigInt(0) ? parsed : null;
    } catch {
      return null;
    }
  }, [swapAmount]);

  const swapPreview = useMemo(() => {
    if (!swapWei) {
      return null;
    }
    const fee = (swapWei * FEE_BPS) / BigInt(10_000);
    const net = swapWei - fee;
    const price = BigInt(priceMicro);
    // Both assets ride the 18-decimal unit; the quote is in microdollars,
    // and 10^12 units make one microdollar.
    const unitsPerMicro = BigInt(10) ** BigInt(12);
    const receive =
      swapFrom === "USDT"
        ? (net * FLY_WEI) / (price * unitsPerMicro)
        : (net * price * unitsPerMicro) / FLY_WEI;
    return { fee, receive };
  }, [swapWei, swapFrom, priceMicro]);

  if (!user) {
    return (
      <div className="flex flex-col gap-3">
        <div className="skeleton h-40 w-full rounded-[var(--radius-lg)]" />
        <div className="skeleton h-64 w-full rounded-[var(--radius-lg)]" />
      </div>
    );
  }

  const flyWei = BigInt(user.balance.fly);
  const usdtWei = BigInt(user.balance.usdt);
  const connected = user.connected_wallet;
  const name = memberName(user);

  async function deposit() {
    if (!amountWei) {
      setError("Enter an amount to deposit");
      return;
    }
    setError(null);
    setConfirming(true);
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, amount, source }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        user?: Parameters<typeof apply>[0];
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not complete the deposit");
      }
      if (body?.user) {
        apply(body.user);
      } else {
        await refresh();
      }
      push({
        title: `${asset} deposit confirmed`,
        description: `${asset === "USDT" ? formatUsdt(amountWei) : formatFly(amountWei)} ${asset} is now spendable.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete the deposit");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  async function swap() {
    if (!swapWei) {
      setSwapError("Enter an amount to swap");
      return;
    }
    setSwapError(null);
    setSwapBusy(true);
    try {
      const res = await fetch("/api/wallet/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: swapFrom, amount: swapAmount }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        user?: Parameters<typeof apply>[0];
        receive?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not complete the swap");
      }
      if (body?.user) {
        apply(body.user);
      }
      push({
        title: "Swap settled",
        description: `You received ${formatDecimal(body?.receive ?? "0", 4)} ${
          swapFrom === "USDT" ? "FLY" : "USDT"
        }.`,
      });
    } catch (err) {
      setSwapError(err instanceof Error ? err.message : "Could not complete the swap");
    } finally {
      setSwapBusy(false);
    }
  }

  async function connect(providerId: string, providerName: string) {
    setProviderSheet(false);
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        user?: Parameters<typeof apply>[0];
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not connect that wallet");
      }
      if (body?.user) {
        apply(body.user);
      }
      push({ title: `${providerName} connected`, description: "You can now pull funds from it." });
    } catch (err) {
      push({
        title: "Could not connect",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function createWallet() {
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/create", { method: "POST" });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        user?: Parameters<typeof apply>[0];
        address?: string;
        recoveryPhrase?: string[];
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not create the wallet");
      }
      if (body?.user) {
        apply(body.user);
      }
      setCreated({
        address: body?.address ?? "",
        phrase: body?.recoveryPhrase ?? [],
      });
    } catch (err) {
      push({
        title: "Could not create wallet",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/connect", { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        user?: Parameters<typeof apply>[0];
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not disconnect that wallet");
      }
      if (body?.user) {
        apply(body.user);
      }
      push({ title: "Wallet disconnected", tone: "info" });
      router.refresh();
    } catch (err) {
      push({
        title: "Could not disconnect",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const availableForSwap =
    swapFrom === "USDT" ? BigInt(user.balance.usdt) : BigInt(user.balance.fly);
  const shortForSwap = swapWei !== null && swapWei > availableForSwap;

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="segmented w-full sm:w-auto" role="tablist" aria-label="Wallet">
        {(
          [
            { id: "fund", label: "Add funds" },
            { id: "swap", label: "Swap" },
            { id: "wallet", label: "Wallet" },
          ] as { id: WalletTab; label: string }[]
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className="flex-1 sm:flex-none"
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Live quote strip */}
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="icon-tile size-10" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <SwapIcon size={18} />
          </span>
          <div>
            <p className="eyebrow">FLY / USD</p>
            <p className="tnum text-lg font-semibold tracking-tight">
              ${(quote.priceMicro / 1_000_000).toFixed(4)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem]">
          <span
            className="tnum font-semibold"
            style={{ color: up ? "var(--accent)" : "var(--danger)" }}
          >
            {change} <span className="font-normal text-[var(--muted)]">24h</span>
          </span>
          <span className="tnum text-[var(--muted)]">
            High ${(quote.high24h / 1_000_000).toFixed(4)}
          </span>
          <span className="tnum text-[var(--muted)]">
            Low ${(quote.low24h / 1_000_000).toFixed(4)}
          </span>
          <span className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="live-dot size-1.5 rounded-full bg-[var(--accent)]" />
            Updating live
          </span>
        </div>
      </Card>

      {/* --- Add funds --- */}
      {tab === "fund" ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden">
            <CardHead
              title="Add funds"
              hint="Deposit FLY or USDT — both are spendable at the table"
              icon={<ArrowDownIcon size={17} />}
            />
            <div className="divider flex flex-col gap-5 px-5 py-5">
              <div className="segmented w-full" role="tablist" aria-label="Asset to deposit">
                {(["FLY", "USDT"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={asset === option}
                    onClick={() => setAsset(option)}
                    className="flex-1"
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <span className="field-label">Amount</span>
                <div className="relative">
                  <input
                    className="input input-lg tnum pr-16"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted)]">
                    {asset}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`btn btn-sm ${
                        amount === preset ? "btn-ink" : "btn-outline"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                {amountWei ? (
                  <p className="field-hint">
                    Worth{" "}
                    <span className="tnum font-medium text-[var(--ink-soft)]">
                      {asset === "USDT" ? dollars(amountWei) : usd(amountWei)}
                    </span>{" "}
                    at the current quote.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <span className="field-label">From</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSource("address")}
                    className={`flex items-start gap-3 rounded-[var(--radius)] border px-3.5 py-3 text-left transition-colors ${
                      source === "address"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] hover:bg-[var(--surface-sunken)]"
                    }`}
                  >
                    <QrIcon size={18} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-[0.8125rem] font-semibold">
                        My {asset} address
                      </span>
                      <span className="mt-0.5 block text-[0.75rem] leading-4 text-[var(--muted)]">
                        Send from any exchange or wallet
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!connected}
                    onClick={() => setSource("wallet")}
                    className={`flex items-start gap-3 rounded-[var(--radius)] border px-3.5 py-3 text-left transition-colors disabled:opacity-50 ${
                      source === "wallet"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] hover:bg-[var(--surface-sunken)]"
                    }`}
                  >
                    <WalletIcon size={18} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="block text-[0.8125rem] font-semibold">
                        {connected ? connected.provider : "Connect a wallet"}
                      </span>
                      <span className="mt-0.5 block text-[0.75rem] leading-4 text-[var(--muted)]">
                        {connected
                          ? "Pull straight from your connected wallet"
                          : "Connect MetaMask, Coinbase or create one"}
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {error ? (
                <p role="alert" className="alert alert-danger">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={deposit}
                disabled={busy || !amountWei}
                className="btn btn-primary btn-block btn-lg"
              >
                {busy || confirming ? <Spinner size={17} /> : <ArrowDownIcon size={17} />}
                {confirming
                  ? "Confirming deposit…"
                  : busy
                    ? "Working…"
                    : `Deposit ${amountWei ? formatDecimal(amountWei, 2) : ""} ${asset}`}
              </button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHead
              title={`Your ${asset} deposit address`}
              hint={`On the ${addresses[asset].network} network`}
              icon={<QrIcon size={17} />}
            />
            <div className="divider flex flex-col items-center gap-4 px-5 py-6">
              <QrPattern value={addresses[asset].address} size={148} />
              <p className="text-center text-[0.75rem] leading-5 text-[var(--muted)]">
                Send only {asset} to this address. Transfers confirm after 3
                network confirmations.
              </p>
              <div className="w-full">
                <CopyField value={addresses[asset].address} label="Address" />
              </div>
              <div className="w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3">
                <KeyValue label="Network">{addresses[asset].network}</KeyValue>
                <KeyValue label="Minimum">0.01 {asset}</KeyValue>
                <KeyValue label="Arrives in">Under a minute</KeyValue>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* --- Swap --- */}
      {tab === "swap" ? (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden">
            <CardHead
              title={swapFrom === "USDT" ? "Buy FLY with USDT" : "Sell FLY for USDT"}
              hint="Priced off the live quote, settled instantly"
              icon={<SwapIcon size={17} />}
            />
            <div className="divider flex flex-col gap-4 px-5 py-5">
              <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5">
                <span className="field-label">You pay</span>
                <div className="flex items-center gap-3">
                  <input
                    className="input tnum flex-1 border-0 bg-transparent !px-0 !py-1 text-xl font-semibold focus:!shadow-none"
                    inputMode="decimal"
                    value={swapAmount}
                    onChange={(event) => setSwapAmount(event.target.value)}
                  />
                  <span className="flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-xs)]">
                    {swapFrom}
                  </span>
                </div>
                <span className="tnum field-hint">
                  Balance {swapFrom === "USDT" ? formatUsdt(usdtWei) : formatFly(flyWei)} {swapFrom}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSwapFrom(swapFrom === "USDT" ? "FLY" : "USDT");
                  setSwapAmount("50");
                }}
                className="btn btn-outline btn-sm self-center"
              >
                <SwapIcon size={15} />
                Flip direction
              </button>

              <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--line)] p-3.5">
                <span className="field-label">You receive</span>
                <div className="flex items-center gap-3">
                  <span className="tnum flex-1 text-xl font-semibold">
                    {swapPreview
                      ? formatDecimal(swapPreview.receive, swapFrom === "USDT" ? 4 : 2)
                      : "0"}
                  </span>
                  <span className="rounded-full bg-[var(--surface-sunken)] px-3 py-1.5 text-sm font-semibold">
                    {swapFrom === "USDT" ? "FLY" : "USDT"}
                  </span>
                </div>
              </div>

              <dl className="flex flex-col gap-1 rounded-[var(--radius)] bg-[var(--surface-sunken)] px-4 py-3 text-[0.8125rem]">
                <KeyValue label="Rate">
                  1 FLY ≈ ${(priceMicro / 1_000_000).toFixed(4)}
                </KeyValue>
                <KeyValue label="Network fee (0.30%)">
                  {swapPreview ? formatDecimal(swapPreview.fee, 4) : "0"} {swapFrom}
                </KeyValue>
                <KeyValue label="Slippage">Max 0.5%</KeyValue>
              </dl>

              {shortForSwap ? (
                <p className="alert alert-pending">
                  Not enough {swapFrom} for that amount. Add funds first, or lower
                  the amount.
                </p>
              ) : null}
              {swapError ? (
                <p role="alert" className="alert alert-danger">
                  {swapError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={swap}
                disabled={swapBusy || !swapWei || shortForSwap}
                className="btn btn-primary btn-block btn-lg"
              >
                {swapBusy ? <Spinner size={17} /> : <SwapIcon size={17} />}
                {swapBusy ? "Settling…" : "Review & swap"}
              </button>
              <p className="text-center text-[0.75rem] text-[var(--muted)]">
                Swaps settle against the quote at the moment you confirm.
              </p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHead
              title="Funding the swap"
              hint={
                connected
                  ? `${connected.provider} is connected`
                  : "Connect or create a wallet to pull USDT in"
              }
              icon={<WalletIcon size={17} />}
            />
            <div className="divider flex flex-col gap-4 px-5 py-5">
              <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] px-4 py-3">
                <Avatar name={name} hue={user.avatar_hue} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-semibold">{name}</p>
                  <p className="truncate text-[0.75rem] text-[var(--muted)]">@{user.handle}</p>
                </div>
                <Chip tone="accent">Wallet ready</Chip>
              </div>

              {connected ? (
                <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3">
                  <p className="eyebrow">Connected wallet</p>
                  <p className="mt-1.5 text-[0.875rem] font-semibold">{connected.provider}</p>
                  <p className="mt-1 truncate font-mono text-[0.75rem] text-[var(--muted)]">
                    {connected.address}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] px-4 py-4">
                  <p className="text-[0.8125rem] leading-5 text-[var(--ink-soft)]">
                    No external wallet connected yet. Connect one you already use,
                    or create a self-custody wallet in a few seconds.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProviderSheet(true)}
                      className="btn btn-outline btn-sm"
                    >
                      Connect a wallet
                    </button>
                    <button
                      type="button"
                      onClick={createWallet}
                      disabled={busy}
                      className="btn btn-ink btn-sm"
                    >
                      <PlusIcon size={15} />
                      Create a wallet
                    </button>
                  </div>
                </div>
              )}

              <dl className="flex flex-col">
                <KeyValue label="FLY balance">{formatFly(flyWei)}</KeyValue>
                <KeyValue label="USDT balance">{formatUsdt(usdtWei)}</KeyValue>
                <KeyValue label="Combined" strong>
                  {totalUsd(flyWei, usdtWei)}
                </KeyValue>
              </dl>
            </div>
          </Card>
        </div>
      ) : null}

      {/* --- Wallet --- */}
      {tab === "wallet" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHead
              title="Wallet"
              hint={connected ? connected.provider : "No external wallet connected"}
              icon={<WalletIcon size={17} />}
              action={
                connected ? (
                  <button
                    type="button"
                    onClick={disconnect}
                    disabled={busy}
                    className="btn btn-outline btn-sm"
                  >
                    <XIcon size={14} />
                    Disconnect
                  </button>
                ) : null
              }
            />
            <div className="divider flex flex-col gap-4 px-5 py-5">
              {connected ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="icon-tile size-10" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      <ShieldIcon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.875rem] font-semibold">{connected.provider}</p>
                      <p className="truncate font-mono text-[0.75rem] text-[var(--muted)]">
                        {connected.address}
                      </p>
                    </div>
                  </div>
                  <CopyField value={connected.address} label="Wallet address" />
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[0.8125rem] leading-6 text-[var(--ink-soft)]">
                    A connected wallet lets you pull FLY or USDT in from somewhere
                    you already hold it. If you arrived without one, create a
                    self-custody wallet — it takes seconds and you keep the keys.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProviderSheet(true)}
                      className="btn btn-outline btn-sm"
                    >
                      Connect a wallet
                    </button>
                    <button
                      type="button"
                      onClick={createWallet}
                      disabled={busy}
                      className="btn btn-ink btn-sm"
                    >
                      <PlusIcon size={15} />
                      Create a wallet
                    </button>
                  </div>
                </div>
              )}

              <div className="hairline pt-4">
                <p className="eyebrow mb-2">Balances</p>
                <dl className="flex flex-col">
                  <KeyValue label="FLY">
                    {formatFly(flyWei)} <span className="text-[var(--muted)]">({usd(flyWei)})</span>
                  </KeyValue>
                  <KeyValue label="USDT">
                    {formatUsdt(usdtWei)}{" "}
                    <span className="text-[var(--muted)]">({dollars(usdtWei)})</span>
                  </KeyValue>
                  <KeyValue label="Total" strong>
                    {totalUsd(flyWei, usdtWei)}
                  </KeyValue>
                </dl>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHead
              title="Deposit addresses"
              hint="One per asset — send only the matching token"
              icon={<ArrowUpIcon size={17} />}
            />
            <div className="divider flex flex-col gap-5 px-5 py-5">
              {(["FLY", "USDT"] as const).map((key) => (
                <div key={key} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.875rem] font-semibold">{key}</p>
                    <Chip tone="idle">{addresses[key].network}</Chip>
                  </div>
                  <div className="flex items-center gap-3">
                    <QrPattern value={addresses[key].address} size={72} />
                    <div className="min-w-0 flex-1">
                      <CopyField value={addresses[key].address} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {/* Connect sheet */}
      <Sheet
        open={providerSheet}
        onClose={() => setProviderSheet(false)}
        title="Connect a wallet"
        hint="Pick the wallet you already use. Nothing is charged by connecting."
      >
        <ul className="flex flex-col gap-2">
          {PROVIDERS.map((provider) => (
            <li key={provider.id}>
              <button
                type="button"
                onClick={() => connect(provider.id, provider.name)}
                className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <span className="icon-tile size-9">{provider.name.charAt(0)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-semibold">{provider.name}</span>
                  <span className="mt-0.5 block text-[0.75rem] text-[var(--muted)]">
                    {provider.blurb}
                  </span>
                </span>
                <CheckIcon size={16} className="text-[var(--muted)]" />
              </button>
            </li>
          ))}
        </ul>

        <div className="hairline mt-5 pt-4">
          <p className="text-[0.8125rem] leading-5 text-[var(--ink-soft)]">
            Don&apos;t have one of these? Create a self-custody wallet instead —
            you get an address and a recovery key you keep yourself.
          </p>
          <button
            type="button"
            onClick={() => {
              setProviderSheet(false);
              void createWallet();
            }}
            disabled={busy}
            className="btn btn-ink btn-block mt-3"
          >
            <PlusIcon size={16} />
            Create a wallet
          </button>
        </div>
      </Sheet>

      {/* Recovery phrase, shown exactly once */}
      <Sheet
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Your recovery key"
        hint="Write these words down. They are shown once and never stored."
      >
        {created ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {created.phrase.map((word, index) => (
                <span
                  key={`${word}-${index}`}
                  className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-sunken)] px-2 py-2 text-center text-[0.75rem] font-medium"
                >
                  <span className="mr-1 text-[var(--muted)]">{index + 1}.</span>
                  {word}
                </span>
              ))}
            </div>
            <CopyField value={created.address} label="Wallet address" />
            <p className="alert alert-pending">
              Anyone with these words controls this wallet. Store them offline —
              there is no way to recover them later.
            </p>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="btn btn-primary btn-block"
            >
              I have saved my recovery key
            </button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
