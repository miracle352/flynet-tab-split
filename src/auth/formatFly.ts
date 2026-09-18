const WEI = BigInt(10) ** BigInt(18);

/** Format a FLY wei string for display. Never uses floats. */
export function formatFly(value: string): string {
  const n = BigInt(value);
  const whole = n / WEI;
  const frac = n % WEI;
  if (frac === BigInt(0)) {
    return whole.toString();
  }
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function formatUsdCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
