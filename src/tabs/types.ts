/**
 * A Tab is one shared bill anchored to a check-in.
 *
 * Flynet has no peer-to-peer transfer in v1 — money only moves from a
 * member's wallet to a merchant's — so a Tab does not reimburse whoever
 * fronted cash. Instead the table settles the check *with the venue*,
 * one payment intent per seat, before anyone pays.
 *
 * Seats are fixed when the tab opens. Adding a diner later would change
 * every share and invalidate intents that are already pending, so new
 * people claim one of the seats the host already declared.
 */

export type ShareStatus = "open_seat" | "pending" | "paid";
export type TabStatus = "open" | "settled" | "canceled";
export type SplitMode = "even" | "custom";

export interface TabShare {
  /** 0-based seat index. */
  seat: number;
  /** Null until someone joins and claims this seat. */
  user_id: string | null;
  display_name: string | null;
  /** FLY wei. */
  amount: string;
  payment_intent_id: string | null;
  status: ShareStatus;
  paid_at: string | null;
}

export interface Tab {
  id: string;
  /** Short code used in the invite link. */
  join_code: string;
  status: TabStatus;
  host_user_id: string;

  /** Proof the host was actually at this venue. */
  check_in_id: string;
  location_id: string;
  venue_label: string;

  /** FLY wei. */
  subtotal: string;
  tip_percent: number;
  /** FLY wei. Sum of every share, exactly. */
  total: string;

  /** Payee — the merchant receiving the table's FLY. */
  merchant_id: string;

  shares: TabShare[];
  created_at: string;
  settled_at: string | null;
}

export function settledCount(tab: Tab): number {
  return tab.shares.filter((share) => share.status === "paid").length;
}

export function claimedCount(tab: Tab): number {
  return tab.shares.filter((share) => share.user_id !== null).length;
}

export function isFullyPaid(tab: Tab): boolean {
  return tab.shares.every((share) => share.status === "paid");
}

export function shareForUser(tab: Tab, userId: string): TabShare | undefined {
  return tab.shares.find((share) => share.user_id === userId);
}
