import { randomInt } from "node:crypto";
import {
  FlynetClientError,
  cancelPaymentIntent,
  checkIn,
  confirmPaymentIntent,
  createPaymentIntent,
  getWalletBalance,
} from "@/flynetClient";
import { recordEntry } from "@/ledger/store";
import { MoneyError, formatFly, parseFlyToWei, sumFlyWei, applyTipPercent } from "@/money";
import { splitBill } from "@/splitBill";
import { connect, getMember, getMembersByIds, adjustBalances } from "@/users/store";
import { memberName } from "@/users/types";
import type { CurrentUser } from "@/auth/types";
import type { ActiveCheckIn } from "@/checkInState";
import { insertTab, listTabs, updateTab } from "./store";
import {
  IDLE_WINDOW_MINUTES,
  isExpired,
  isFullyPaid,
  unclaimedWei,
  type SplitMode,
  type Tab,
  type TabShare,
} from "./types";

/**
 * Tab lifecycle: open → seats claimed → shares paid → settled.
 *
 * Two exits short-circuit that: the host can cancel, and a table left
 * idle past the window clears itself. Both hand back anything already
 * paid, because a bill that is not settled must not keep anybody's FLY.
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
  /** People the host picked, host included. */
  participantIds?: string[];
  /** Custom split: one grand-total share per seat, host first. */
  amounts?: string[];
  /** Extra seats left open for people who join by link. */
  openSeats?: number;
}

/** Shares of the grand total, in wei, one per seat. */
function computeShares(
  input: CreateTabInput,
  grandTotal: bigint,
  seats: number,
): bigint[] {
  if (input.splitMode === "custom") {
    if (!Array.isArray(input.amounts) || input.amounts.length === 0) {
      throw new TabError("Enter an amount for every seat");
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

/** FLY the member can actually spend right now. */
export async function availableFly(
  member: CurrentUser,
  accessToken: string | null,
): Promise<bigint> {
  if (accessToken) {
    const wallets = await getWalletBalance(accessToken);
    return BigInt(wallets.balance.balance.value);
  }
  const stored = await getMember(member.id);
  return BigInt(stored?.balances.fly ?? member.balance.fly);
}

export async function balanceFor(
  user: CurrentUser,
  accessToken: string | null,
): Promise<bigint> {
  return availableFly(user, accessToken);
}

/** Pre-flight balance check, so "you are short" beats an opaque failure. */
export async function assertAffordable(
  amountWei: string,
  user: CurrentUser,
  accessToken: string | null,
): Promise<bigint> {
  const available = await availableFly(user, accessToken);
  const owed = BigInt(amountWei);

  if (available < owed) {
    throw new TabError(
      `Not enough FLY. You have ${formatFly(available)} but this share is ` +
        `${formatFly(owed)} (${formatFly(owed - available)} short).`,
      402,
    );
  }
  return available;
}

/**
 * Creates one pending payment intent.
 *
 * Keyed per (tab, payer, purpose) so a retry never double-charges; the
 * purpose matters because a host can settle both their own seat and the
 * seats nobody claimed on the same table.
 */
async function openSeatIntent(
  tab: Tab,
  amountWei: string,
  payerId: string,
  accessToken: string | null,
  purpose = "seat",
): Promise<string> {
  const intent = await createPaymentIntent(
    {
      customer_user_id: payerId,
      amount: { value: amountWei, currency: "FLY" },
      description:
        purpose === "cover"
          ? `${tab.venue_label} - covering the empty seats`
          : `${tab.venue_label} - table share`,
      idempotency_key: `${tab.id}:${payerId}:${purpose}`,
      flynet_merchant_id: tab.merchant_id,
      expires_at: tab.expires_at,
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
    .join(" - ");

  const picked = await getMembersByIds(input.participantIds ?? []);
  const people = [
    { id: host.id, first_name: host.first_name, last_name: host.last_name, handle: host.handle },
    ...picked
      .filter((member) => member.id !== host.id)
      .map((member) => ({
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        handle: member.handle,
      })),
  ];

  const openSeats = Math.max(0, input.openSeats ?? 0);
  const seatCount = people.length + openSeats;
  if (seatCount < 1) {
    throw new TabError("Pick at least one person");
  }

  const shares = computeShares(input, total, seatCount);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + IDLE_WINDOW_MINUTES * 60_000).toISOString();

  const tab: Tab = {
    id: crypto.randomUUID(),
    join_code: joinCode(),
    status: "open",
    host_user_id: host.id,
    check_in_id: record.id,
    location_id: record.location.id,
    restaurant_id: record.location.restaurant.id,
    venue_label: venueLabel,
    venue_time_zone: record.location.time_zone,
    subtotal: subtotal.toString(),
    tip_percent: input.tipPercent,
    total: total.toString(),
    merchant_id: merchantId,
    shares: shares.map((amount, seat) => ({
      seat,
      user_id: null,
      display_name: null,
      handle: null,
      amount: amount.toString(),
      payment_intent_id: null,
      status: "open_seat",
      paid_at: null,
      refunded_at: null,
    })),
    created_at: now,
    activity_at: now,
    expires_at: expiresAt,
    settled_at: null,
    canceled_at: null,
    cancel_reason: null,
  };

  // One payment request per named person, up front. The host always
  // takes the first seat.
  for (const [index, person] of people.entries()) {
    const share = tab.shares[index];
    if (!share) {
      continue;
    }
    share.user_id = person.id;
    share.display_name = memberName(person);
    share.handle = person.handle;
    share.payment_intent_id = await openSeatIntent(
      tab,
      share.amount,
      person.id,
      accessToken,
    );
    share.status = "pending";

    if (person.id !== host.id) {
      await connect(host.id, person.id, "table");
    }
  }

  return insertTab(tab);
}

/** A diner claims the lowest free seat and gets a payment request. */
export async function joinTab(
  tabId: string,
  member: CurrentUser,
  accessToken: string | null,
): Promise<Tab> {
  const existing = await updateTab(tabId, (tab) => tab);
  if (!existing) {
    throw new TabError("That table no longer exists", 404);
  }
  if (existing.status === "settled") {
    throw new TabError("That table has already settled", 409);
  }
  if (existing.status === "canceled") {
    throw new TabError("That table was canceled by its host", 409);
  }
  if (isExpired(existing)) {
    throw new TabError("That table closed because it went idle", 410);
  }
  if (existing.shares.some((share) => share.user_id === member.id)) {
    throw new TabError("You already have a seat at this table", 409);
  }
  const seat = existing.shares.find((share) => share.user_id === null);
  if (!seat) {
    throw new TabError("Every seat at this table is taken", 409);
  }

  const intentId = await openSeatIntent(existing, seat.amount, member.id, accessToken);
  const claim: TabShare = {
    ...seat,
    user_id: member.id,
    display_name: memberName(member),
    handle: member.handle,
    payment_intent_id: intentId,
    status: "pending",
  };

  await connect(existing.host_user_id, member.id, "invite");

  const updated = await updateTab(tabId, (tab) => ({
    ...tab,
    activity_at: new Date().toISOString(),
    shares: tab.shares.map((share) => (share.seat === claim.seat ? claim : share)),
  }));
  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}

/** Confirms a payment request after checking the payer can cover it. */
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
  if (tab.status === "canceled") {
    throw new TabError("That table was canceled; nothing left to pay", 409);
  }
  if (isExpired(tab)) {
    throw new TabError("That table closed because it went idle", 410);
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

  // Without a provider token this app holds the balance, so the debit
  // happens here. With one, the provider moved the FLY already.
  if (!accessToken) {
    await adjustBalances(member.id, { fly: -BigInt(share.amount) });
  }

  await recordEntry({
    member_id: member.id,
    kind: "table_share",
    direction: "out",
    asset: "FLY",
    amount: share.amount,
    label: `Table at ${tab.venue_label}`,
    detail:
      tab.tip_percent > 0
        ? `Your share, including ${tab.tip_percent}% tip`
        : "Your share of the table",
    venue_label: tab.venue_label,
    tab_id: tab.id,
    counterparty: tab.venue_label,
    created_at: paidAt,
  });

  const updated = await updateTab(tabId, (current) => {
    const shares = current.shares.map((candidate) =>
      candidate.seat === share.seat
        ? { ...candidate, status: "paid" as const, paid_at: paidAt }
        : candidate,
    );
    const next: Tab = { ...current, shares, activity_at: paidAt };
    return isFullyPaid(next)
      ? { ...next, status: "settled" as const, settled_at: paidAt }
      : next;
  });
  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}

/** Hands back every share that was already paid. */
async function refundPaidShares(tab: Tab, reason: string): Promise<Tab> {
  const refundedAt = new Date().toISOString();

  for (const share of tab.shares) {
    if (share.status !== "paid" || !share.user_id || share.refunded_at) {
      continue;
    }
    await adjustBalances(share.user_id, { fly: BigInt(share.amount) });
    await recordEntry({
      member_id: share.user_id,
      kind: "refund",
      direction: "in",
      asset: "FLY",
      amount: share.amount,
      label: `Refund: ${tab.venue_label}`,
      detail: reason,
      venue_label: tab.venue_label,
      tab_id: tab.id,
      counterparty: tab.venue_label,
      created_at: refundedAt,
    });
  }

  const updated = await updateTab(tab.id, (current) => ({
    ...current,
    shares: current.shares.map((share) =>
      share.status === "paid" && !share.refunded_at
        ? { ...share, refunded_at: refundedAt }
        : share,
    ),
  }));

  return updated ?? tab;
}

/** Host-only cancel. Anything already paid goes straight back. */
export async function cancelTab(
  tabId: string,
  hostId: string,
  reason?: string,
): Promise<Tab> {
  const tab = await updateTab(tabId, (current) => current);
  if (!tab) {
    throw new TabError("That table no longer exists", 404);
  }
  if (tab.host_user_id !== hostId) {
    throw new TabError("Only the host can cancel this table", 403);
  }
  if (tab.status === "canceled") {
    return tab;
  }
  if (tab.status === "settled") {
    throw new TabError("That table already settled", 409);
  }

  const canceledAt = new Date().toISOString();

  for (const share of tab.shares) {
    if (share.payment_intent_id && share.status === "pending") {
      try {
        await cancelPaymentIntent(share.payment_intent_id);
      } catch {
        // A request that is already gone is not worth failing the cancel.
      }
    }
  }

  const stamped = await updateTab(tabId, (current) => ({
    ...current,
    status: "canceled" as const,
    canceled_at: canceledAt,
    cancel_reason: reason?.trim() || null,
    activity_at: canceledAt,
  }));
  if (!stamped) {
    throw new TabError("That table no longer exists", 404);
  }

  return refundPaidShares(stamped, "The host canceled this table");
}

/**
 * The host covers seats that were declared but never claimed.
 *
 * The check is for the whole table, so if nobody takes a seat the venue
 * is short unless the host settles the remainder themselves.
 */
export async function coverUnclaimedSeats(
  tabId: string,
  host: CurrentUser,
  accessToken: string | null,
): Promise<Tab> {
  const tab = await updateTab(tabId, (current) => current);
  if (!tab) {
    throw new TabError("That table no longer exists", 404);
  }
  if (tab.host_user_id !== host.id) {
    throw new TabError("Only the host can cover the empty seats", 403);
  }
  if (tab.status !== "open") {
    throw new TabError("That table is no longer open", 409);
  }

  const empty = tab.shares.filter((share) => share.user_id === null);
  if (empty.length === 0) {
    throw new TabError("Every seat is claimed", 409);
  }

  const amount = unclaimedWei(tab);
  await assertAffordable(amount.toString(), host, accessToken);

  const intentId = await openSeatIntent(
    tab,
    amount.toString(),
    host.id,
    accessToken,
    "cover",
  );
  await confirmPaymentIntent(intentId, host.id, accessToken ?? undefined);

  const paidAt = new Date().toISOString();
  if (!accessToken) {
    await adjustBalances(host.id, { fly: -amount });
  }

  await recordEntry({
    member_id: host.id,
    kind: "table_share",
    direction: "out",
    asset: "FLY",
    amount,
    label: `Covered ${empty.length} empty ${empty.length === 1 ? "seat" : "seats"} at ${tab.venue_label}`,
    detail: "Seats that were declared but never claimed",
    venue_label: tab.venue_label,
    tab_id: tab.id,
    counterparty: tab.venue_label,
    created_at: paidAt,
  });

  const updated = await updateTab(tabId, (current) => {
    const shares = current.shares.map((share) =>
      share.user_id === null
        ? {
            ...share,
            user_id: host.id,
            display_name: `${memberName(host)} (covered)`,
            handle: host.handle,
            payment_intent_id: intentId,
            status: "paid" as const,
            paid_at: paidAt,
          }
        : share,
    );
    const next: Tab = { ...current, shares, activity_at: paidAt };
    return isFullyPaid(next)
      ? { ...next, status: "settled" as const, settled_at: paidAt }
      : next;
  });

  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}

/**
 * The host closes a table that still has empty seats.
 *
 * Settles with what was actually collected: the venue receives the paid
 * shares and the settled screen states the shortfall plainly, rather
 * than pretending the whole check landed.
 */
export async function closeTab(tabId: string, hostId: string): Promise<Tab> {
  const tab = await updateTab(tabId, (current) => current);
  if (!tab) {
    throw new TabError("That table no longer exists", 404);
  }
  if (tab.host_user_id !== hostId) {
    throw new TabError("Only the host can close this table", 403);
  }
  if (tab.status !== "open") {
    throw new TabError("That table is no longer open", 409);
  }

  const closedAt = new Date().toISOString();
  const updated = await updateTab(tabId, (current) => ({
    ...current,
    status: "settled" as const,
    settled_at: closedAt,
    activity_at: closedAt,
  }));

  if (!updated) {
    throw new TabError("That table no longer exists", 404);
  }
  return updated;
}

/**
 * Clears tables that went quiet.
 *
 * Runs on every read of the table list, so an idle table disappears the
 * moment anybody looks, and whatever was paid against it is returned.
 */
export async function expireStaleTabs(): Promise<Tab[]> {
  const tabs = await listTabs();
  const stale = tabs.filter((tab) => isExpired(tab));

  for (const tab of stale) {
    const stamped = await updateTab(tab.id, (current) => ({
      ...current,
      status: "expired" as const,
      canceled_at: new Date().toISOString(),
      cancel_reason: "Closed automatically after going idle",
    }));
    if (stamped) {
      await refundPaidShares(stamped, "The table closed before everyone paid");
    }
  }

  return listTabs();
}

/** What the people screen shows for a table's split roster. */
export interface SplitPerson {
  user_id: string;
  display_name: string;
  handle: string | null;
  amount: string;
  status: TabShare["status"];
  paid_at: string | null;
  is_host: boolean;
}

export function splitRoster(tab: Tab): SplitPerson[] {
  return tab.shares
    .filter((share) => share.user_id !== null)
    .map((share) => ({
      user_id: share.user_id as string,
      display_name: share.display_name ?? "Member",
      handle: share.handle,
      amount: share.amount,
      status: share.status,
      paid_at: share.paid_at,
      is_host: share.user_id === tab.host_user_id,
    }));
}

