/**
 * A Tab is one shared bill anchored to a check-in.
 *
 * Money only ever moves from a member's wallet to the venue's, so a Tab
 * does not reimburse whoever fronted cash. Instead the table settles the
 * check *with the venue*, one payment intent per seat, before anybody
 * pays in full.
 *
 * Seats are fixed when the tab opens, because adding a diner later would change
 * every share and invalidate intents that are already pending; new
 * people claim one of the seats the host already declared.
 *
 * A tab is also *live*: it goes quiet when the table leaves, and a quiet
 * tab expires rather than lingering in everyone's list forever.
 */

export type ShareStatus = "open_seat" | "pending" | "paid";
export type TabStatus = "open" | "settled" | "canceled" | "expired";
export type SplitMode = "even" | "custom";

export interface TabShare {
  /** 0-based seat index. */
  seat: number;
  /** Null until someone joins and claims this seat. */
  user_id: string | null;
  display_name: string | null;
  handle: string | null;
  /** FLY wei. */
  amount: string;
  payment_intent_id: string | null;
  status: ShareStatus;
  paid_at: string | null;
  /** Set when a paid share is handed back after a cancel or expiry. */
  refunded_at: string | null;
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
  restaurant_id: string;
  venue_label: string;
  /** The venue's own time zone; countdowns are shown in local time. */
  venue_time_zone: string;

  /** FLY wei. */
  subtotal: string;
  tip_percent: number;
  /** FLY wei. Sum of every share, exactly. */
  total: string;

  /** Payee: the merchant receiving the table's FLY. */
  merchant_id: string;

  shares: TabShare[];
  created_at: string;
  /** Bumped on every join, payment and edit. Idle is measured from here. */
  activity_at: string;
  /** When an idle table drops off the list and refunds anything paid. */
  expires_at: string;
  settled_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
}

/** How long a table may sit untouched before it clears itself. */
export const IDLE_WINDOW_MINUTES = (() => {
  const configured = Number(process.env.TAB_IDLE_MINUTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 120;
})();

export function settledCount(tab: Tab): number {
  return tab.shares.filter((share) => share.status === "paid").length;
}

export function claimedCount(tab: Tab): number {
  return tab.shares.filter((share) => share.user_id !== null).length;
}

/** Every declared seat has a person behind it and has settled. */
export function isFullyPaid(tab: Tab): boolean {
  return tab.shares.every((share) => share.status === "paid");
}

/** Everybody who took a seat has paid. */
export function claimedAllPaid(tab: Tab): boolean {
  const claimed = tab.shares.filter((share) => share.user_id !== null);
  return claimed.length > 0 && claimed.every((share) => share.status === "paid");
}

/** Seats the host declared that nobody ever claimed. */
export function unclaimedCount(tab: Tab): number {
  return tab.shares.filter((share) => share.user_id === null).length;
}

/** FLY sitting on seats nobody claimed. */
export function unclaimedWei(tab: Tab): bigint {
  return tab.shares.reduce(
    (total, share) => (share.user_id === null ? total + BigInt(share.amount) : total),
    BigInt(0),
  );
}

/**
 * Everybody seated has paid, but seats were declared that nobody took.
 *
 * The table does not settle by itself here; that money was never
 * collected, so the host either covers the empty seats or closes the
 * table with what the venue actually received.
 */
export function awaitingClose(tab: Tab): boolean {
  return tab.status === "open" && claimedAllPaid(tab) && unclaimedCount(tab) > 0;
}

export function shareForUser(tab: Tab, userId: string): TabShare | undefined {
  return tab.shares.find((share) => share.user_id === userId);
}

export function paidTotalWei(tab: Tab): bigint {
  return tab.shares.reduce(
    (total, share) => (share.status === "paid" ? total + BigInt(share.amount) : total),
    BigInt(0),
  );
}

/** Milliseconds of quiet time left before the table clears itself. */
export function idleMsRemaining(tab: Tab, now: Date = new Date()): number {
  if (tab.status !== "open") {
    return 0;
  }
  return Math.max(0, Date.parse(tab.expires_at) - now.getTime());
}

export function isExpired(tab: Tab, now: Date = new Date()): boolean {
  return tab.status === "open" && idleMsRemaining(tab, now) <= 0;
}
