import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitBill } from "./splitBill.ts";
import {
  FLY_WEI,
  applyTipPercent,
  formatFly,
  parseFlyToWei,
  sumFlyWei,
} from "./money.ts";

const wei = (n: bigint) => n * FLY_WEI;

describe("parseFlyToWei", () => {
  it("parses whole amounts", () => {
    assert.equal(parseFlyToWei("42"), wei(42n));
  });

  it("parses decimals without float drift", () => {
    // 0.1 + 0.2 is 0.30000000000000004 as a float; wei math must not drift.
    assert.equal(parseFlyToWei("0.1") + parseFlyToWei("0.2"), parseFlyToWei("0.3"));
  });

  it("parses grouped thousands", () => {
    assert.equal(parseFlyToWei("1,200.50"), wei(1200n) + wei(1n) / 2n);
  });

  it("rejects junk", () => {
    for (const bad of ["", "abc", "12.3.4", "-", "1e3", "NaN"]) {
      assert.throws(() => parseFlyToWei(bad), `${bad} should throw`);
    }
  });
});

describe("formatFly", () => {
  it("round-trips", () => {
    for (const s of ["0", "1", "12", "500.25", "0.000000000000000001"]) {
      assert.equal(formatFly(parseFlyToWei(s)), s);
    }
  });

  it("trims trailing zeros", () => {
    assert.equal(formatFly(parseFlyToWei("12.500")), "12.5");
  });
});

describe("applyTipPercent", () => {
  it("applies whole percents", () => {
    assert.equal(applyTipPercent(wei(100n), 20), wei(120n));
  });

  it("applies fractional percents", () => {
    assert.equal(applyTipPercent(wei(100n), 18.5), wei(118n) + wei(1n) / 2n);
  });

  it("truncates sub-wei remainders rather than inventing money", () => {
    // 1 wei + 10% = 1.1 wei -> floors to 1 wei.
    assert.equal(applyTipPercent(BigInt(1), 10), BigInt(1));
  });

  it("rejects negative tips", () => {
    assert.throws(() => applyTipPercent(wei(1n), -1));
  });
});

describe("split end-to-end", () => {
  it("keeps a realistic bill exact across the table", () => {
    const subtotal = parseFlyToWei("186.40");
    const total = applyTipPercent(subtotal, 20);
    const shares = splitBill(total.toString(), 5).map(BigInt);
    assert.equal(sumFlyWei(shares), total);
    assert.equal(formatFly(total), "223.68");
  });
});
