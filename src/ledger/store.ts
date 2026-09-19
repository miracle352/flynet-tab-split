import { deterministicHex } from "@/auth/passwords";
import { mutateJson } from "@/lib/jsonStore";
import { usdCentsFromFly } from "@/price/fly";
import { flyPriceMicro } from "@/price/fly";
import { FLY_WEI } from "@/money";

/**
 * The member-facing ledger.
 *
 * One row per balance movement, written at the same moment the balance
 * moves, so the history screen is a record of what actually happened
 * rather than something reconstructed from other tables.
 */

export type Asset = "FLY" | "USDT";

export type LedgerKind =
  | "deposit"
  | "buy_fly"
  | "sell_fly"
  | "table_share"
  | "refund"
  | "reward";

export type LedgerStatus = "pending" | "completed" | "failed";

export interface LedgerEntry {
  id: string;
  member_id: string;
  kind: LedgerKind;
  direction: "in" | "out";
  asset: Asset;
  /** Absolute amount, in 18-decimal units. */
  amount: string;
  /** USD value at the moment of settlement, in cents. */
  usd_cents: number;
  label: string;
  detail: string | null;
  venue_label: string | null;
  tab_id: string | null;
  counterparty: string | null;
  tx_hash: string;
  status: LedgerStatus;
  created_at: string;
}

const FILE = "ledger";

export interface NewEntryInput {
  member_id: string;
  kind: LedgerKind;
  direction: "in" | "out";
  asset: Asset;
  amount: bigint | string;
  label: string;
  detail?: string | null;
  venue_label?: string | null;
  tab_id?: string | null;
  counterparty?: string | null;
  status?: LedgerStatus;
  created_at?: string;
  /** Overrides the USD snapshot, used for USDT, which is its own dollar. */
  usd_cents?: number;
}

function txHash(seed: string): string {
  return `0x${deterministicHex(seed, 32)}`;
}

export async function recordEntry(input: NewEntryInput): Promise<LedgerEntry> {
  const id = crypto.randomUUID();
  const createdAt = input.created_at ?? new Date().toISOString();
  const amount =
    typeof input.amount === "bigint" ? input.amount : BigInt(input.amount);

  // A USDT is a dollar, so it prices at 1:1; FLY prices at the quote
  // that was live when the movement settled.
  const usdCents =
    input.usd_cents ??
    Number(
      usdCentsFromFly(
        amount,
        input.asset === "USDT" ? 1_000_000 : flyPriceMicro(new Date(createdAt)),
      ),
    );

  const entry: LedgerEntry = {
    id,
    member_id: input.member_id,
    kind: input.kind,
    direction: input.direction,
    asset: input.asset,
    amount: amount.toString(),
    usd_cents: usdCents,
    label: input.label,
    detail: input.detail ?? null,
    venue_label: input.venue_label ?? null,
    tab_id: input.tab_id ?? null,
    counterparty: input.counterparty ?? null,
    tx_hash: txHash(`${id}:${input.member_id}:${input.kind}`),
    status: input.status ?? "completed",
    created_at: createdAt,
  };

  await mutateJson<LedgerEntry[]>(FILE, [], (entries) => [entry, ...entries]);
  return entry;
}

export async function updateEntryStatus(
  id: string,
  status: LedgerStatus,
): Promise<void> {
  await mutateJson<LedgerEntry[]>(FILE, [], (entries) =>
    entries.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
  );
}

export async function ledgerFor(
  memberId: string,
  limit = 50,
): Promise<LedgerEntry[]> {
  const entries = await mutateJson<LedgerEntry[]>(FILE, [], (current) => current);
  return entries
    .filter((entry) => entry.member_id === memberId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/** Everything, newest first, used by the venue-side rollup. */
export async function allEntries(): Promise<LedgerEntry[]> {
  return mutateJson<LedgerEntry[]>(FILE, [], (current) => current);
}

export interface LedgerTotals {
  receivedFly: bigint;
  spentFly: bigint;
  fundedUsdt: bigint;
  swappedUsdt: bigint;
  tableCount: number;
}

export function summarise(entries: LedgerEntry[]): LedgerTotals {
  let receivedFly = BigInt(0);
  let spentFly = BigInt(0);
  let fundedUsdt = BigInt(0);
  let swappedUsdt = BigInt(0);
  const tables = new Set<string>();

  for (const entry of entries) {
    if (entry.status !== "completed") {
      continue;
    }
    const amount = BigInt(entry.amount);

    // USDT movements are tallied in USDT, never folded into the FLY
    // columns: one column per asset, or the totals stop adding up.
    if (entry.asset === "USDT") {
      if (entry.kind === "deposit") {
        fundedUsdt += amount / FLY_WEI;
      } else if (entry.direction === "out") {
        swappedUsdt += amount / FLY_WEI;
      }
      continue;
    }

    if (entry.kind === "table_share") {
      spentFly += amount;
      if (entry.tab_id) {
        tables.add(entry.tab_id);
      }
      continue;
    }
    if (entry.direction === "in") {
      receivedFly += amount;
    } else {
      spentFly += amount;
    }
  }

  return { receivedFly, spentFly, fundedUsdt, swappedUsdt, tableCount: tables.size };
}
