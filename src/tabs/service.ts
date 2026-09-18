import { randomInt } from "node:crypto";
import { FlynetClientError, checkIn, confirmPaymentIntent, createPaymentIntent } from "@/flynetClient";
import { displayName } from "@/auth/demoUsers";
import type { CurrentUser } from "@/auth/types";
import type { ActiveCheckIn } from "@/checkInState";
import { MoneyError, applyTipPercent, divideFlyWei, parseFlyToWei, sumFlyWei } from "@/money";
import { insertTab, updateTab } from "./store";
import type { SplitMode, Tab, TabShare } from "./types";
import { isFullyPaid } from "./types";

/**
 * Tab lifecycle. Routes stay thin; everything that touches Flynet or
 * share math lives here so it can be reasoned about in one place.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export class TabError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "TabError";
  }
}

function joinCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join("");
}

export function errorResponse(error: unknown): Response {
  if (error instanceof TabError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof MoneyError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof FlynetClientError) {
    const body = error.body as { error?: { code?: string; message?: string } } | null;
    if (body?.error?.code === "payment0030") {
      return Response.json(
        { error: "Not enough FLY in this wallet to cover the share." },
        { status: 402 },
      );
    }
    return Response.json(
      { error: body?.error?.message ?? error.message },
      { status: error.status },
    );
  }
  throw error;
}

export interface CreateTabInput {
  subtotal: string;
  tipPercent: number;
  splitMode: SplitMode;
  /** Even split: how many people, host included. */
  seats?: number;
  /** Custom split: one grand-total share per seat, host first. */
  amounts?: string[];
}

/** Shares of the grand total, in wei, one per seat. */
function computeShares(input: CreateTabInput, grandTotal: bigint): bigint[] {
  if (input.splitMode === "even") {
    if (typeof input.seats !== "number") {
      throw new TabError("seats is required for an even split");
    }
    return divideFlyWei(grandTotal, input.seats);
  }

  if (!Array.isArray(input.amounts) || input.amounts.length === 0) {
    throw new TabError("amounts is required for a custom split");
  }
  const shares = input.amounts.map((amount) => parseFlyToWei(amount));
  const sum = sumFlyWei(shares);
  if (sum !== grandTotal) {
    throw new TabError("The custom amounts must add up to the total exactly");
  }
  return shares;
}

/** Creates one pending Flynet payment intent for a seat. */
async function openSeatIntent(
  tab: Tab,
  share: TabShare,
  payer: CurrentUser,
  accessToken: string | null,
): Promise<string> {
  const intent = await createPaymentIntent(
    {
      customer_user_id: payer.id,
      amount: { value: share.amount, currency: "FLY" },
      description: `${tab.venue_label} — table share`,
      // Keyed per (tab, member) so retries never double-charge.
      idempotency_key: `${tab.id}:${payer.id}`,
      flynet_merchant_id: tab.merchant_id,
      metadata: {
        tab_id: tab.id,
        check_in_id: tab.check_in_id,
        location_id: tab.location_id,
        seat: share.seat,
      },
    },
    accessToken ?? undefined,
  );
  return intent.id;
}

export async function createTab(
  input: CreateTabInput,
  host: CurrentUser,
  activeCheckIn: ActiveCheckIn,
  accessToken: string | null,
  merchantId: string,
): Promise<Tab> {
  const subtotal = parseFlyToWei(input.subtotal);
  if (subtotal <= BigInt(0)) {
    throw new TabError("Enter the bill total first");
  }
  const total = applyTipPercent(subtotal, input.tipPercent);

  // The check-in is what anchors this bill to a real visit.
  const record = await checkIn(activeCheckIn.locationId);
  const venueLabel = [
    record.location.restaurant.name,
    record.location.name ?? record.location.neighborhood.name,
  ]
    .filter(Boolean)
    .join(" — ");

  const shares = computeShares(input, total);

  const now = new Date().toISOString();
  const tab: Tab = {
    id: crypto.randomUUID(),
    join_code: joinCode(),
    status: "open",
    host_user_id: host.id,
    check_in_id: record.id,
    location_id: record.location.id,
    venue_label: venueLabel,
    subtotal: subtotal.toString(),
    tip_percent: input.tipPercent,
    total: total.toString(),
    merchant_id: merchantId,
    shares: shares.map((amount, seat) => ({
      seat,
      user_id: null,
      display_name: null,
      amount: amount.toString(),
      payment_intent_id: null,
      status: "open_seat",
      paid_at: null,
    })),
    created_at: now,
    settled_at: null,
  };

  // The host is at the table, so they take seat 0 immediately.
  const hostShare = tab.shares[0];
  hostShare.user_id = host.id;
  hostShare.display_name = displayName(host);
  hostShare.payment_intent_id = await openSeatIntent(tab, hostShare, host, accessToken);
  hostShare.status = "pending";

  return insertTab(tab);
}

/** A diner claims the lowest free seat and gets a payment intent. */
export async function joinTab(
  tabId: string,
  member: CurrentUser,
  accessToken: string | null,
): Promise<Tab> {
  const existing = await updateTab(tabId, (tab) => tab);
  if (!existing) {
    throw new TabError("That table no longer exists", 404);
  }
  if (existing.status !== "open") {
    throw new TabError("That table is already settled", 409);
  }
  if (existing.shares.some((share) => share.user_id === member.id)) {
    throw new TabError("You already have a seat at this table", 409);
  }
  const seat = existing.shares.find((share) => share.user_id === null);
  if (!seat) {
    throw new TabError("Every seat at this table is taken", 409);
  }

  const claim: TabShare = {
    ...seat,
    user_id: member.id,
    display_name: displayName(member),
  };
  claim.payment_intent_id = await openSeatIntent(existing, claim, member, accessToken);
  claim.status = "pending";

  const updated = await updateTab(tabId, (tab) => ({
    ...tab,
    shares: tab.shares.map((share) => (share.seat === claim.seat ? claim : share)),
  }));
  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}

/** Confirms the caller's own payment intent. */
export async function paySeat(
  tabId: string,
  member: CurrentUser,
  accessToken: string | null,
): Promise<Tab> {
  const tab = await updateTab(tabId, (current) => current);
  if (!tab) {
    throw new TabError("That table no longer exists", 404);
  }
  const share = tab.shares.find((candidate) => candidate.user_id === member.id);
  if (!share) {
    throw new TabError("You do not have a seat at this table", 403);
  }
  if (share.status === "paid") {
    return tab;
  }
  if (!share.payment_intent_id) {
    throw new TabError("No payment request found for your seat", 409);
  }

  await confirmPaymentIntent(share.payment_intent_id, member.id, accessToken ?? undefined);

  const paidAt = new Date().toISOString();
  const updated = await updateTab(tabId, (current) => {
    const shares = current.shares.map((candidate) =>
      candidate.seat === share.seat
        ? { ...candidate, status: "paid" as const, paid_at: paidAt }
        : candidate,
    );
    const next = { ...current, shares };
    return isFullyPaid(next) ? { ...next, status: "settled" as const, settled_at: paidAt } : next;
  });
  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}
