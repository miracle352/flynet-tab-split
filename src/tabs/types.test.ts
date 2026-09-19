import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDLE_WINDOW_MINUTES,
  idleMsRemaining,
  isExpired,
  isFullyPaid,
  paidTotalWei,
  settledCount,
  unclaimedCount,
  unclaimedWei,
  awaitingClose,
  type Tab,
} from "./types.ts";

const WEI = BigInt(10) ** BigInt(18);

function tab(overrides: Partial<Tab> = {}): Tab {
  const createdAt = new Date("2026-09-19T18:00:00.000Z");
  const expiresAt = new Date(createdAt.getTime() + IDLE_WINDOW_MINUTES * 60_000);

  return {
    id: "tab-1",
    join_code: "ABC123",
    status: "open",
    host_user_id: "host",
    check_in_id: "check-in-1",
    location_id: "location-1",
    restaurant_id: "restaurant-1",
    venue_label: "FLYBAR - CLOVER",
    venue_time_zone: "America/New_York",
    subtotal: (WEI * 100n).toString(),
    tip_percent: 20,
    total: (WEI * 120n).toString(),
    merchant_id: "merchant-1",
    shares: [
      {
        seat: 0,
        user_id: "host",
        display_name: "Host",
        handle: "host",
        amount: (WEI * 60n).toString(),
        payment_intent_id: "intent-1",
        status: "paid",
        paid_at: "2026-09-19T18:20:00.000Z",
        refunded_at: null,
      },
      {
        seat: 1,
        user_id: "guest",
        display_name: "Guest",
        handle: "guest",
        amount: (WEI * 60n).toString(),
        payment_intent_id: "intent-2",
        status: "pending",
        paid_at: null,
        refunded_at: null,
      },
    ],
    created_at: createdAt.toISOString(),
    activity_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    settled_at: null,
    canceled_at: null,
    cancel_reason: null,
    ...overrides,
  };
}

describe("idle windows", () => {
  it("defaults to two hours when nothing is configured", () => {
    assert.equal(IDLE_WINDOW_MINUTES, 120);
  });

  it("counts down from the expiry moment", () => {
    const opened = tab();
    const anHourIn = new Date(Date.parse(opened.expires_at) - 60 * 60_000);
    assert.equal(idleMsRemaining(opened, anHourIn), 60 * 60_000);
    assert.equal(isExpired(opened, anHourIn), false);
  });

  it("expires once the window has passed", () => {
    const opened = tab();
    const after = new Date(Date.parse(opened.expires_at) + 1);
    assert.equal(idleMsRemaining(opened, after), 0);
    assert.equal(isExpired(opened, after), true);
  });

  it("never expires a table that already finished", () => {
    const settled = tab({ status: "settled" });
    const longAfter = new Date(Date.parse(settled.expires_at) + 86_400_000);
    assert.equal(isExpired(settled, longAfter), false);
  });
});

describe("share maths", () => {
  it("counts settled seats and what they paid", () => {
    const opened = tab();
    assert.equal(settledCount(opened), 1);
    assert.equal(isFullyPaid(opened), false);
    assert.equal(paidTotalWei(opened), WEI * 60n);
  });

  it("is fully paid when every seat has settled", () => {
    const done = tab();
    done.shares[1] = { ...done.shares[1], status: "paid" };
    assert.equal(isFullyPaid(done), true);
    assert.equal(paidTotalWei(done), WEI * 120n);
  });

  it("flags a table where seats were declared but never claimed", () => {
    const withEmptySeat = tab();
    withEmptySeat.shares.push({
      seat: 2,
      user_id: null,
      display_name: null,
      handle: null,
      amount: (WEI * 60n).toString(),
      payment_intent_id: null,
      status: "open_seat",
      paid_at: null,
      refunded_at: null,
    });
    withEmptySeat.shares[1] = { ...withEmptySeat.shares[1], status: "paid" };

    assert.equal(unclaimedCount(withEmptySeat), 1);
    assert.equal(unclaimedWei(withEmptySeat), WEI * 60n);
    // Not fully paid: an empty seat is money the venue has not received.
    assert.equal(isFullyPaid(withEmptySeat), false);
    // But everybody who sat down has settled, so the host can close it.
    assert.equal(awaitingClose(withEmptySeat), true);
    assert.equal(paidTotalWei(withEmptySeat), WEI * 120n);
  });

  it("is not paid when nobody has taken a seat at all", () => {
    const empty = tab();
    empty.shares = empty.shares.map((share) => ({
      ...share,
      user_id: null,
      status: "open_seat" as const,
    }));
    assert.equal(isFullyPaid(empty), false);
  });
});
