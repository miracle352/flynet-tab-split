/**
 * The FLY reference price.
 *
 * Everything the UI shows in dollars is derived from this one number, so
 * there is a single exchange rate on screen instead of two that drift
 * apart. The quote advances on a fixed tick and is a pure function of
 * the tick index; the server and the browser compute the identical
 * value for the same moment, which is what keeps a server-rendered
 * price from fighting the live one on hydration.
 *
 * The price is carried in **microdollars** (1 USD = 1_000_000) as an
 * integer, so converting FLY to USD never touches a float.
 */

import { FLY_WEI } from "../money.ts";

/** One quote per tick. The wallet screen polls at this interval. */
export const PRICE_TICK_MS = 5_000;

const MICRO_PER_USD = 1_000_000;
const MICRO_PER_CENT = 10_000;

/** Deterministic 0..1 hash of an integer. Stable across processes. */
function unitNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
}

/** Smooth wander, so the series reads like a market and not a dice roll. */
function wave(bucket: number, period: number, amplitude: number): number {
  return Math.sin((bucket / period) * Math.PI * 2) * amplitude;
}

/** Quote for one tick, in microdollars per FLY. */
export function priceMicroAt(bucket: number): number {
  const drift =
    wave(bucket, 720, 62_000) + // ~1h swing
    wave(bucket, 173, 21_500) + // ~14min swing
    wave(bucket, 31, 7_400); // ~2.5min ripple
  const jitter = (unitNoise(bucket) - 0.5) * 5_200;
  const micro = 1_048_000 + drift + jitter;
  return Math.max(420_000, Math.round(micro));
}

export function bucketAt(date: Date = new Date()): number {
  return Math.floor(date.getTime() / PRICE_TICK_MS);
}

/** Current quote, microdollars per FLY. */
export function flyPriceMicro(date: Date = new Date()): number {
  return priceMicroAt(bucketAt(date));
}

export function flyPriceUsd(date: Date = new Date()): number {
  return flyPriceMicro(date) / MICRO_PER_USD;
}

/** The last `count` quotes, oldest first: feeds the sparkline. */
export function priceSeries(count = 48, date: Date = new Date()): number[] {
  const now = bucketAt(date);
  return Array.from({ length: count }, (_, index) =>
    priceMicroAt(now - (count - 1 - index)),
  );
}

export interface PriceQuote {
  /** Microdollars per FLY. */
  priceMicro: number;
  /** USD per FLY, for display only. */
  priceUsd: number;
  /** Percent change against the same quote 24h earlier. */
  change24hPct: number;
  /** High/low of the trailing 24h window. */
  high24h: number;
  low24h: number;
  /** Tick index the quote belongs to. */
  bucket: number;
  /** When the quote was struck. */
  at: string;
  series: number[];
}

const BUCKETS_PER_DAY = Math.round(86_400_000 / PRICE_TICK_MS);

export function quoteAt(date: Date = new Date()): PriceQuote {
  const bucket = bucketAt(date);
  const now = priceMicroAt(bucket);
  const then = priceMicroAt(bucket - BUCKETS_PER_DAY);
  const day = Array.from({ length: 288 }, (_, index) =>
    priceMicroAt(bucket - index),
  );

  return {
    priceMicro: now,
    priceUsd: now / MICRO_PER_USD,
    change24hPct: ((now - then) / then) * 100,
    high24h: Math.max(...day),
    low24h: Math.min(...day),
    bucket,
    at: new Date(bucket * PRICE_TICK_MS).toISOString(),
    series: priceSeries(60, date),
  };
}

// --- Currency conversion (all integer math) ---

/** FLY (wei) → USD cents, rounded half up. */
export function usdCentsFromFly(
  flyWei: string | bigint,
  priceMicro: number,
): bigint {
  const micro = (BigInt(flyWei) * BigInt(priceMicro)) / FLY_WEI;
  return (micro + BigInt(MICRO_PER_CENT / 2)) / BigInt(MICRO_PER_CENT);
}

/** USD (microdollars) → FLY (wei). */
export function flyWeiFromUsdMicro(
  usdMicro: string | bigint,
  priceMicro: number,
): bigint {
  return (BigInt(usdMicro) * FLY_WEI) / BigInt(priceMicro);
}

/** FLY (wei) → USD microdollars. Used by the swap desk. */
export function usdMicroFromFly(flyWei: string | bigint, priceMicro: number): bigint {
  return (BigInt(flyWei) * BigInt(priceMicro)) / FLY_WEI;
}

export function formatPriceUsd(priceMicro: number): string {
  return formatUsdCents(BigInt(Math.round(priceMicro / MICRO_PER_CENT)));
}

export function formatUsdCents(cents: bigint | number): string {
  const value = typeof cents === "bigint" ? cents : BigInt(Math.round(cents));
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${fraction}`;
}

/** FLY → formatted USD in one call. */
export function formatUsdFromFly(
  flyWei: string | bigint,
  priceMicro: number,
): string {
  return formatUsdCents(usdCentsFromFly(flyWei, priceMicro));
}

export function formatPercent(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
