"use client";

import Link from "next/link";
import { Sparkline } from "./ui";
import { ArrowDownIcon, SwapIcon, ArrowUpIcon, ReceiptIcon } from "./icons";
import { usePrice, useUser } from "./providers";
import { formatFly, formatUsdt } from "@/money";
import { usdCentsFromFly } from "@/price/fly";

/**
 * The balance card. Every number on it re-derives from the live quote,
 * so a price move re-prices the wallet without a refresh.
 */
export function WalletHero({ firstName }: { firstName: string }) {
  const { user, loading } = useUser();
  const { quote, change, up, priceMicro, usd } = usePrice();

  if (loading || !user) {
    return (
      <div className="hero p-6 sm:p-7">
        <div className="skeleton h-4 w-32" style={{ background: "rgb(255 255 255 / 0.18)" }} />
        <div className="skeleton mt-4 h-12 w-56" style={{ background: "rgb(255 255 255 / 0.18)" }} />
      </div>
    );
  }

  const flyWei = BigInt(user.balance.fly);
  const usdtWei = BigInt(user.balance.usdt);
  const flyUsdCents = usdCentsFromFly(flyWei, priceMicro);
  const usdtCents = usdtWei / BigInt(10) ** BigInt(16);
  const totalCents = flyUsdCents + usdtCents;

  const dollars = (cents: bigint) => {
    const negative = cents < 0n;
    const abs = negative ? -cents : cents;
    const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fraction = (abs % 100n).toString().padStart(2, "0");
    return `${negative ? "-" : ""}$${whole}.${fraction}`;
  };

  return (
    <section className="hero rise relative p-6 sm:p-7">
      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#c9f0e3]">
              Total balance
            </p>
            <p className="tnum mt-2 text-[2.6rem] font-semibold leading-none tracking-[-0.03em] sm:text-[3.1rem]">
              {dollars(totalCents)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[0.8125rem] text-[#d7f6ec]">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
                style={{
                  background: "rgb(255 255 255 / 0.16)",
                  color: up ? "#a9f5d8" : "#ffd0cb",
                }}
              >
                <span
                  className="live-dot size-1.5 rounded-full"
                  style={{ background: up ? "#8ff5d2" : "#ffb3ab" }}
                />
                {change} 24h
              </span>
              <span className="hidden sm:inline">
                FLY ${(quote.priceMicro / 1_000_000).toFixed(4)}
              </span>
            </p>
          </div>

          <div className="hidden rounded-2xl bg-[rgb(255_255_255/0.12)] p-3 sm:block">
            <Sparkline
              values={quote.series}
              width={128}
              height={44}
              up={up}
              area
              strokeWidth={1.8}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="hero-inset px-4 py-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#c9f0e3]">
              FLY
            </p>
            <p className="tnum mt-1.5 text-lg font-semibold">{formatFly(flyWei)}</p>
            <p className="tnum mt-0.5 text-[0.75rem] text-[#c9f0e3]">{usd(flyWei)}</p>
          </div>
          <div className="hero-inset px-4 py-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#c9f0e3]">
              USDT
            </p>
            <p className="tnum mt-1.5 text-lg font-semibold">{formatUsdt(usdtWei)}</p>
            <p className="tnum mt-0.5 text-[0.75rem] text-[#c9f0e3]">
              {dollars(usdtCents)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[0.8125rem] font-semibold text-[#044634] shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <ArrowDownIcon size={16} />
            Add funds
          </Link>
          <Link
            href="/wallet?tab=swap"
            className="inline-flex items-center gap-2 rounded-full border border-[rgb(255_255_255/0.35)] bg-[rgb(255_255_255/0.14)] px-4 py-2.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[rgb(255_255_255/0.22)]"
          >
            <SwapIcon size={16} />
            Swap
          </Link>
          <Link
            href="/split"
            className="inline-flex items-center gap-2 rounded-full border border-[rgb(255_255_255/0.35)] bg-[rgb(255_255_255/0.14)] px-4 py-2.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[rgb(255_255_255/0.22)]"
          >
            <ReceiptIcon size={16} />
            Split a bill
          </Link>
          <Link
            href="/activity"
            className="inline-flex items-center gap-2 rounded-full border border-[rgb(255_255_255/0.35)] bg-[rgb(255_255_255/0.14)] px-4 py-2.5 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[rgb(255_255_255/0.22)]"
          >
            <ArrowUpIcon size={16} />
            History
          </Link>
        </div>

        <p className="text-[0.75rem] text-[#c9f0e3]">
          Hi {firstName} — funds settle straight to the venue when your table pays.
        </p>
      </div>
    </section>
  );
}
