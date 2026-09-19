/**
 * FLY money helpers.
 *
 * On the wire every FLY amount is a stringified integer in wei
 * (1 FLY = 10^18 wei). Nothing here ever touches a float for money:
 * parse, split, and format all stay in BigInt.
 */

export const FLY_WEI = BigInt(10) ** BigInt(18);

/** FLY follows the same 18-decimal precision as its wei unit. */
const MAX_DECIMALS = 18;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Parse a human-entered amount ("42.5", "1,200") into wei. */
export function parseFlyToWei(input: string): bigint {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new MoneyError(`"${input}" is not a valid FLY amount`);
  }

  const [whole, fraction = ""] = cleaned.split(".");
  if (fraction.length > MAX_DECIMALS) {
    throw new MoneyError(`FLY supports at most ${MAX_DECIMALS} decimal places`);
  }

  return BigInt(whole) * FLY_WEI + BigInt(fraction.padEnd(MAX_DECIMALS, "0"));
}

/** Format wei for display. Trims trailing zeros. */
export function formatFly(value: string | bigint): string {
  const n = typeof value === "bigint" ? value : BigInt(value);
  const negative = n < BigInt(0);
  const abs = negative ? -n : n;
  const whole = abs / FLY_WEI;
  const fraction = abs % FLY_WEI;
  const sign = negative ? "-" : "";

  if (fraction === BigInt(0)) {
    return `${sign}${whole.toString()}`;
  }
  const fractionStr = fraction.toString().padStart(MAX_DECIMALS, "0").replace(/0+$/, "");
  return `${sign}${whole}.${fractionStr}`;
}

export function formatUsdCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// --- Generic decimal amounts (USDT rides the same 18-decimal unit) ---

/** Parse a human-entered amount into an 18-decimal integer. */
export function parseDecimalToWei(input: string): bigint {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new MoneyError(`"${input}" is not a valid amount`);
  }
  const [whole, fraction = ""] = cleaned.split(".");
  if (fraction.length > MAX_DECIMALS) {
    throw new MoneyError(`At most ${MAX_DECIMALS} decimal places are supported`);
  }
  return BigInt(whole) * FLY_WEI + BigInt(fraction.padEnd(MAX_DECIMALS, "0"));
}

/** Thousands separators for the whole part. */
function group(whole: bigint): string {
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format an 18-decimal integer for display, keeping at most
 * `maxFraction` decimals and never printing a trailing ".0".
 */
export function formatDecimal(
  value: string | bigint,
  maxFraction = 2,
): string {
  const n = typeof value === "bigint" ? value : BigInt(value);
  const negative = n < BigInt(0);
  const abs = negative ? -n : n;
  let whole = abs / FLY_WEI;
  const fractionDigits = abs % FLY_WEI;

  if (maxFraction <= 0 || fractionDigits === BigInt(0)) {
    return `${negative ? "-" : ""}${group(whole)}`;
  }

  const padded = fractionDigits.toString().padStart(MAX_DECIMALS, "0");
  let shown = BigInt(padded.slice(0, maxFraction));

  // Round the last shown digit up when the remainder is at least half,
  // and carry into the whole part when that pushes past the limit
  // (0.999 at two decimals is 1.00, not 0.100).
  const nextDigit = Number(padded[maxFraction] ?? "0");
  if (nextDigit >= 5) {
    shown += BigInt(1);
  }
  const limit = BigInt(10) ** BigInt(maxFraction);
  if (shown >= limit) {
    whole += shown / limit;
    shown %= limit;
  }

  const fractionText = shown
    .toString()
    .padStart(maxFraction, "0")
    .replace(/0+$/, "");
  if (fractionText === "") {
    return `${negative ? "-" : ""}${group(whole)}`;
  }
  return `${negative ? "-" : ""}${group(whole)}.${fractionText}`;
}

/** USDT is displayed to the cent, the way every stablecoin wallet does. */
export function formatUsdt(value: string | bigint): string {
  return formatDecimal(value, 2);
}

export function sumFlyWei(values: Iterable<bigint | string>): bigint {
  let total = BigInt(0);
  for (const value of values) {
    total += typeof value === "bigint" ? value : BigInt(value);
  }
  return total;
}

/**
 * Apply a tip percentage exactly. Percent may carry up to 2 decimals;
 * it is converted to integer basis points before any BigInt math.
 */
export function applyTipPercent(subtotal: bigint, percent: number): bigint {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new MoneyError("tip must be zero or more");
  }

  const scaled = percent * 100;
  const basisPoints = Math.round(scaled);
  if (Math.abs(scaled - basisPoints) > 1e-6) {
    throw new MoneyError("tip supports at most 2 decimal places");
  }

  return (subtotal * (BigInt(10_000) + BigInt(basisPoints))) / BigInt(10_000);
}
