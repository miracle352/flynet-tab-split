import { randomBytes } from "node:crypto";
import { deterministicHex } from "@/auth/passwords";
import { FLY_WEI, MoneyError } from "@/money";
import { recordEntry, type Asset } from "@/ledger/store";
import { flyPriceMicro, type PriceQuote, quoteAt } from "@/price/fly";
import { getMember, updateMember, adjustBalances } from "@/users/store";
import { memberName, type Member } from "@/users/types";

/**
 * Funding and swapping.
 *
 * Two assets move in this app: FLY (what tables settle in) and USDT
 * (what people arrive with). Everything here is integer math against the
 * live quote, and every balance change writes a ledger row.
 */

/** 0.30% — shown on the swap ticket before it is taken. */
export const SWAP_FEE_BPS = 30n;

export interface DepositAddress {
  asset: Asset;
  address: string;
  network: string;
}

export function depositAddresses(member: Member): Record<Asset, DepositAddress> {
  const fly = `fly1${deterministicHex(`${member.id}:fly-deposit`, 20)}`;
  const usdt = `T${deterministicHex(`${member.id}:usdt-deposit`, 20)}`.slice(0, 34);
  return {
    FLY: { asset: "FLY", address: fly, network: "Flynet" },
    USDT: { asset: "USDT", address: usdt, network: "Tether · TRC-20" },
  };
}

export interface DepositResult {
  member: Member;
  entry: Awaited<ReturnType<typeof recordEntry>>;
}

/**
 * Credits an incoming transfer.
 *
 * `source` only changes the wording on the ledger row: funds either
 * arrive at the member's own deposit address or are pulled from a
 * wallet they connected.
 */
export async function depositFunds(
  memberId: string,
  asset: Asset,
  amountWei: bigint,
  source: "address" | "wallet" = "address",
): Promise<DepositResult> {
  if (amountWei <= BigInt(0)) {
    throw new MoneyError("Enter an amount greater than zero");
  }
  const member = await getMember(memberId);
  if (!member) {
    throw new MoneyError("That account no longer exists");
  }

  const updated = await adjustBalances(
    memberId,
    asset === "FLY" ? { fly: amountWei } : { usdt: amountWei },
  );

  const entry = await recordEntry({
    member_id: memberId,
    kind: "deposit",
    direction: "in",
    asset,
    amount: amountWei,
    label: `Deposited ${asset}`,
    detail:
      source === "wallet"
        ? `Received from ${member.connected_wallet?.provider ?? "connected wallet"}`
        : `Received on your ${asset} deposit address`,
    counterparty: source === "wallet" ? member.connected_wallet?.address ?? null : null,
  });

  return { member: updated, entry };
}

export interface SwapQuote {
  quote: PriceQuote;
  from: Asset;
  to: Asset;
  /** Amount being sold, in 18-decimal units. */
  spend: string;
  /** Amount received, after fee, in 18-decimal units. */
  receive: string;
  feeAmount: string;
  feeBps: string;
  /** Rate shown on the ticket, e.g. "1 USDT = 0.9541 FLY". */
  rate: string;
  expiresAt: string;
}

const BPS_DENOMINATOR = 10_000n;

/**
 * Both assets ride the same 18-decimal unit, while the quote is priced
 * in microdollars — 10^12 of those units make one microdollar. Doing the
 * scaling inside the single fraction keeps the conversion exact instead
 * of truncating a microdollar on the way through.
 */
const UNITS_PER_MICRO = BigInt(10) ** BigInt(12);

export function quoteSwap(
  from: Asset,
  to: Asset,
  amountWei: bigint,
  at: Date = new Date(),
): SwapQuote {
  const quote = quoteAt(at);
  const priceUsdPerFly = flyPriceMicro(at);
  const priceMicro = BigInt(priceUsdPerFly);

  if (from === to) {
    throw new MoneyError("Pick two different assets");
  }

  // Sell-side fee, then convert what is left at the live quote.
  const fee = (amountWei * SWAP_FEE_BPS) / BPS_DENOMINATOR;
  const netInput = amountWei - fee;
  const receive =
    from === "USDT"
      ? (netInput * FLY_WEI) / (priceMicro * UNITS_PER_MICRO)
      : (netInput * priceMicro * UNITS_PER_MICRO) / FLY_WEI;

  return {
    quote,
    from,
    to,
    spend: amountWei.toString(),
    receive: receive.toString(),
    feeAmount: fee.toString(),
    feeBps: SWAP_FEE_BPS.toString(),
    rate:
      from === "USDT"
        ? `1 USDT ≈ ${(1_000_000 / priceUsdPerFly).toFixed(4)} FLY`
        : `1 FLY ≈ $${(priceUsdPerFly / 1_000_000).toFixed(4)}`,
    expiresAt: new Date(at.getTime() + 15_000).toISOString(),
  };
}

export interface SwapResult {
  member: Member;
  receive: bigint;
  entries: Awaited<ReturnType<typeof recordEntry>>[];
  quote: SwapQuote;
}

export async function executeSwap(
  memberId: string,
  from: Asset,
  to: Asset,
  amountWei: bigint,
): Promise<SwapResult> {
  if (from === to) {
    throw new MoneyError("Pick two different assets");
  }
  if (amountWei <= BigInt(0)) {
    throw new MoneyError("Enter an amount greater than zero");
  }

  const member = await getMember(memberId);
  if (!member) {
    throw new MoneyError("That account no longer exists");
  }

  const available = BigInt(from === "FLY" ? member.balances.fly : member.balances.usdt);
  if (available < amountWei) {
    throw new MoneyError(
      `Not enough ${from} in your wallet for that swap`,
    );
  }

  const swapQuote = quoteSwap(from, to, amountWei);
  const receive = BigInt(swapQuote.receive);
  if (receive <= BigInt(0)) {
    throw new MoneyError("That amount is too small to swap");
  }

  const updated = await adjustBalances(
    memberId,
    from === "FLY" ? { fly: -amountWei, usdt: receive } : { usdt: -amountWei, fly: receive },
  );

  const spent = await recordEntry({
    member_id: memberId,
    kind: from === "USDT" ? "buy_fly" : "sell_fly",
    direction: "out",
    asset: from,
    amount: amountWei,
    label: from === "USDT" ? "Bought FLY with USDT" : "Sold FLY for USDT",
    detail: `Swapped at 1 FLY ≈ $${(swapQuote.quote.priceMicro / 1_000_000).toFixed(4)}`,
    counterparty: "Flynet swap desk",
  });

  const received = await recordEntry({
    member_id: memberId,
    kind: from === "USDT" ? "buy_fly" : "sell_fly",
    direction: "in",
    asset: to,
    amount: receive,
    label: `Received ${to}`,
    detail: `Proceeds of the ${from} → ${to} swap`,
    counterparty: "Flynet swap desk",
  });

  return { member: updated, receive, entries: [spent, received], quote: swapQuote };
}

// --- Wallet connection ---

export const WALLET_PROVIDERS = [
  { id: "metamask", name: "MetaMask", blurb: "Browser extension & mobile" },
  { id: "coinbase", name: "Coinbase Wallet", blurb: "Extension, mobile & smart wallet" },
  { id: "rabby", name: "Rabby", blurb: "Multi-chain extension" },
  { id: "phantom", name: "Phantom", blurb: "Solana & EVM" },
] as const;

export type WalletProviderId = (typeof WALLET_PROVIDERS)[number]["id"];

/** Simulates an installed wallet answering a connection request. */
export async function connectExternalWallet(
  memberId: string,
  provider: string,
): Promise<Member> {
  const known = WALLET_PROVIDERS.find((option) => option.id === provider);
  const name = known?.name ?? provider;
  const address = `0x${deterministicHex(`${memberId}:${provider}`, 20)}`;
  const mixed = `0x${address
    .slice(2)
    .replace(/./g, (char, index) => (index % 3 === 0 ? char.toUpperCase() : char))}`;

  const updated = await updateMember(memberId, (member) => ({
    ...member,
    connected_wallet: {
      provider: name,
      address: mixed,
      connected_at: new Date().toISOString(),
    },
  }));

  if (!updated) {
    throw new MoneyError("That account no longer exists");
  }
  return updated;
}

export async function disconnectWallet(memberId: string): Promise<Member | null> {
  return updateMember(memberId, (member) => ({ ...member, connected_wallet: null }));
}

const RECOVERY_WORDS = [
  "anchor", "meadow", "quartz", "velvet", "harbor", "willow", "copper", "summit",
  "lantern", "cobalt", "ferrous", "garnet", "jasper", "kelp", "lumen", "nimbus",
  "onyx", "prism", "quiver", "ripple", "saffron", "timber", "umber", "vortex",
  "walnut", "xenon", "yarrow", "zephyr", "basalt", "cedar", "dune", "ember",
  "flint", "grove", "hollow", "ivory", "jetty", "kiln", "loft", "moss",
  "nook", "orbit", "pebble", "quill", "ridge", "stone", "thicket", "urchin",
  "vale", "wharf", "yonder", "zonal", "amber", "brine", "clove", "dusk",
  "fable", "glade", "hearth", "inlet", "juniper", "knoll", "lagoon", "marsh",
];

export interface CreatedWallet {
  member: Member;
  address: string;
  recoveryPhrase: string[];
}

/**
 * Creates a self-custody wallet for a member who arrived without one.
 *
 * The recovery phrase is generated here and shown exactly once — it is
 * never written to the store, which is what a real custodian would do.
 */
export async function createSelfCustodyWallet(
  memberId: string,
): Promise<CreatedWallet> {
  const entropy = randomBytes(16);
  const phrase = Array.from({ length: 12 }, (_, index) => {
    const byte = entropy[index % entropy.length]! ^ entropy[(index * 7) % entropy.length]!;
    return RECOVERY_WORDS[(byte + index * 13) % RECOVERY_WORDS.length]!;
  });

  const address = `0x${deterministicHex(
    `${memberId}:self-custody:${entropy.toString("hex")}`,
    20,
  )}`;
  const mixed = `0x${address
    .slice(2)
    .replace(/./g, (char, index) => (index % 3 === 0 ? char.toUpperCase() : char))}`;

  const updated = await updateMember(memberId, (member) => ({
    ...member,
    connected_wallet: {
      provider: "Flynet Wallet",
      address: mixed,
      connected_at: new Date().toISOString(),
    },
  }));

  if (!updated) {
    throw new MoneyError("That account no longer exists");
  }

  return { member: updated, address: mixed, recoveryPhrase: phrase };
}

/** Human label for a counterparty on the ledger. */
export function counterpartyLabel(member: Member): string {
  return `${memberName(member)} (@${member.handle})`;
}
