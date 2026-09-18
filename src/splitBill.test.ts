import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FLY_UNIT, splitBill } from "./splitBill.ts";

const sum = (shares: string[]) =>
  shares.reduce((acc, share) => acc + BigInt(share), BigInt(0));

describe("splitBill", () => {
  it("puts the remainder of an odd split on the first share", () => {
    assert.deepEqual(splitBill("10000000000000000000", 3), [
      "3333333333333333334",
      "3333333333333333333",
      "3333333333333333333",
    ]);
  });

  it("handles a tiny odd split", () => {
    assert.deepEqual(splitBill("10", 3), ["4", "3", "3"]);
  });

  it("leaves no remainder when the total divides cleanly", () => {
    assert.deepEqual(splitBill("100", 4), ["25", "25", "25", "25"]);
  });

  it("returns the whole total for a solo bill", () => {
    assert.deepEqual(splitBill(FLY_UNIT, 1), [FLY_UNIT]);
  });

  it("splits zero without inventing money", () => {
    assert.deepEqual(splitBill("0", 5), ["0", "0", "0", "0", "0"]);
  });

  it("still sums correctly when there is less than one wei per person", () => {
    const shares = splitBill("1", 1000);
    assert.equal(shares.length, 1000);
    assert.equal(shares[0], "1");
    assert.ok(shares.slice(1).every((share) => share === "0"));
    assert.equal(sum(shares), BigInt(1));
  });

  it("always sums back to exactly the total", () => {
    const cases: [string, number][] = [
      ["10000000000000000000", 3],
      ["223680000000000000000", 3],
      ["223680000000000000000", 7],
      ["1", 3],
      ["0", 9],
      ["999999999999999999999", 13],
    ];
    for (const [total, people] of cases) {
      assert.equal(sum(splitBill(total, people)), BigInt(total), `${total}/${people}`);
    }
  });

  it("never returns a negative share", () => {
    for (const share of splitBill("7", 4)) {
      assert.ok(BigInt(share) >= BigInt(0));
    }
  });

  it("matches the documented 1 FLY unit", () => {
    assert.equal(FLY_UNIT, "1000000000000000000");
    assert.deepEqual(splitBill(FLY_UNIT, 2), ["500000000000000000", "500000000000000000"]);
  });

  it("rejects bad input", () => {
    assert.throws(() => splitBill("10", 0));
    assert.throws(() => splitBill("10", -2));
    assert.throws(() => splitBill("10", 1.5));
    assert.throws(() => splitBill("abc", 2));
    assert.throws(() => splitBill("-10", 2));
    assert.throws(() => splitBill("10.5", 2));
  });
});
