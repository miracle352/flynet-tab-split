import { randomInt } from "node:crypto";
import {
  FlynetClientError,
  checkIn,
  confirmPaymentIntent,
  createPaymentIntent,
  getWalletBalance,
} from "@/flynetClient";
import { displayName, findDemoUser } from "@/auth/demoUsers";
import type { CurrentUser } from "@/auth/types";
import type { ActiveCheckIn } from "@/checkInState";
import { MoneyError, applyTipPercent, formatFly, parseFlyToWei, sumFlyWei } from "@/money";
import { splitBill } from "@/splitBill";
import { insertTab, updateTab } from "./store";
import type { SplitMode, Tab, TabShare } from "./types";
import { isFullyPaid } from "./types";

/**
 * Tab lifecycle. Routes stay thin; everything that touches Flynet or
 * share math lives here so it can be reasoned about in one place.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export class TabError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TabError";
    this.status = status;
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
  /** Demo members the host picked, host included. */
  participantIds?: string[];
  /** Custom split: one grand-total share per seat, host first. */
  amounts?: string[];
  /** Extra seats left open for people who join by link. */
  openSeats?: number;
}

/** Shares of the grand total, in wei, one per seat. */
function computeShares(input: CreateTabInput, grandTotal: bigint, seats: number): bigint[] {
  if (input.splitMode === "custom") {
    if (!Array.isArray(input.amounts) || input.amounts.length === 0) {
      throw new TabError("amounts is required for a custom split");
    }
    if (input.amounts.length !== seats) {
      throw new TabError("You need one amount per seat");
    }
    const shares = input.amounts.map((amount) => parseFlyToWei(amount));
    if (sumFlyWei(shares) !== grandTotal) {
      throw new TabError("The custom amounts must add up to the total exactly");
    }
    return shares;
  }

  return splitBill(grandTotal.toString(), seats).map(BigInt);
}

/**
 * Balance check before asking Flynet to move anything.
 *
 * v1 is FLY-only: if the member is short, `confirm` fails with 400
 * `payment0030` and there is no card fallback. Checking first turns a
 * raw error into "you are X FLY short".
 */
export async function assertAffordable(
  amountWei: string,
  user: CurrentUser,
  accessToken: string | null,
): Promise<bigint> {
  const wallets = await getWalletBalance(accessToken ?? undefined, user.id);
  const available = BigInt(wallets.balance.balance.value);
  const owed = BigInt(amountWei);

  if (available < owed) {
    throw new TabError(
      `Not enough FLY. You have ${formatFly(available)} but this share is ` +
        `${formatFly(owed)} — ${formatFly(owed - available)} short.`,
      402,
    );
  }
  return available;
}

export async function balanceFor(
  user: CurrentUser,
  accessToken: string | null,
): Promise<bigint> {
  const wallets = await getWalletBalance(accessToken ?? undefined, user.id);
  return BigInt(wallets.balance.balance.value);
}

/** Creates one pending Flynet payment intent for a seat. */
async function openSeatIntent(
  tab: Tab,
  amountWei: string,
  payerId: string,
  accessToken: string | null,
): Promise<string> {
  const intent = await createPaymentIntent(
    {
      customer_user_id: payerId,
      amount: { value: amountWei, currency: "FLY" },
      description: `${tab.venue_label} — table share`,
      // Keyed per (tab, member) so retries never double-charge.
      idempotency_key: `${tab.id}:${payerId}`,
      flynet_merchant_id: tab.merchant_id,
      metadata: {
        tab_id: tab.id,
        check_in_id: tab.check_in_id,
        location_id: tab.location_id,
        payer_user_id: payerId,
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

  // Host always sits first; picked members follow; then open seats.
  const picked = (input.participantIds ?? [])
    .map((id) => findDemoUser(id))
    .filter((user): user is CurrentUser => user !== undefined);
  const people = [host, ...picked.filter((user) => user.id !== host.id)];
  const openSeats = Math.max(0, input.openSeats ?? 0);
  const seatCount = people.length + openSeats;
  if (seatCount < 1) {
    throw new TabError("Pick at least one person");
  }

  const shares = computeShares(input, total, seatCount);

  const now = new Date().toISOString();
  const tab: Tab = {
    id: crypto.randomUUID(),
    join_code: joinCode(),
    status: "open",
    host_user_id: host.id,
    check_in_id: record.id,
    location_id: record.location.id,
    restaurant_id: record.location.restaurant.id,
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

  // One payment intent per named person, up front.
  for (const person of people) {
    const share = tab.shares[person === host ? 0 : people.indexOf(person)];
    share.user_id = person.id;
    share.display_name = displayName(person);
    share.payment_intent_id = await openSeatIntent(
      tab,
      share.amount,
      person.id,
      accessToken,
    );
    share.status = "pending";
  }

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

  const intentId = await openSeatIntent(
    existing,
    seat.amount,
    member.id,
    accessToken,
  );
  const claim: TabShare = {
    ...seat,
    user_id: member.id,
    display_name: displayName(member),
    payment_intent_id: intentId,
    status: "pending",
  };

  const updated = await updateTab(tabId, (tab) => ({
    ...tab,
    shares: tab.shares.map((share) => (share.seat === claim.seat ? claim : share)),
  }));
  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}

/** Confirms a payment intent after checking the payer can cover it. */
export async function paySeat(
  tabId: string,
  member: CurrentUser,
  accessToken: string | null,
  seatIndex?: number,
): Promise<Tab> {
  const tab = await updateTab(tabId, (current) => current);
  if (!tab) {
    throw new TabError("That table no longer exists", 404);
  }
  const share = tab.shares.find(
    (candidate) =>
      candidate.user_id === member.id &&
      (seatIndex === undefined || candidate.seat === seatIndex),
  );
  if (!share) {
    throw new TabError("You do not have a seat at this table", 403);
  }
  if (share.status === "paid") {
    return tab;
  }
  if (!share.payment_intent_id) {
    throw new TabError("No payment request found for your seat", 409);
  }

  await assertAffordable(share.amount, member, accessToken);
  await confirmPaymentIntent(share.payment_intent_id, member.id, accessToken ?? undefined);

  const paidAt = new Date().toISOString();
  const updated = await updateTab(tabId, (current) => {
    const shares = current.shares.map((candidate) =>
      candidate.seat === share.seat
        ? { ...candidate, status: "paid" as const, paid_at: paidAt }
        : candidate,
    );
    const next = { ...current, shares };
    return isFullyPaid(next)
      ? { ...next, status: "settled" as const, settled_at: paidAt }
      : next;
  });
  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}
