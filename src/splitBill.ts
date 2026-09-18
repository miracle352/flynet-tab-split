/**
 * splitBill — split a FLY total evenly, remainder on the first share.
 *
 * FLY amounts are strings in the smallest unit (wei), 18 decimals:
 *   1 FLY === "1000000000000000000"
 *
 * All arithmetic is BigInt. Floats would silently lose wei: 0.1 + 0.2
 * is 0.30000000000000004 as a double, which is real money at this scale.
 *
 * Pure: no I/O, no clock, no randomness. Same inputs, same output.
 *
 * ---------------------------------------------------------------------
 * Test cases (verified by src/splitBill.test.ts):
 *
 *   splitBill("10000000000000000000", 3)        // 10 FLY, 3 people
 *     -> ["3333333333333333334",
 *         "3333333333333333333",
 *         "3333333333333333333"]
 *     10 FLY does not divide by 3. Each share is 3.333... FLY, and the
 *     leftover 1 wei lands on the first share. Sum is exactly 10 FLY.
 *
 *   splitBill("10", 3)                          // 10 wei, 3 people
 *     -> ["4", "3", "3"]                        // sum 10
 *
 *   splitBill("100", 4)                         // divides cleanly
 *     -> ["25", "25", "25", "25"]               // no remainder anywhere
 *
 *   splitBill("1000000000000000000", 1)         // solo bill
 *     -> ["1000000000000000000"]
 *
 *   splitBill("0", 5)
 *     -> ["0", "0", "0", "0", "0"]
 *
 *   splitBill("1", 1000)                        // 1 wei across 1000 people
 *     -> ["1", "0", "0", ...]                   // still sums to 1
 *
 *   splitBill("10", 0)   -> throws
 *   splitBill("10", -2)  -> throws
 *   splitBill("10", 1.5) -> throws
 *   splitBill("abc", 2)  -> throws
 * ---------------------------------------------------------------------
 */

export class SplitBillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitBillError";
  }
}

/** 1 FLY expressed in wei. */
export const FLY_UNIT = "1000000000000000000";

export function splitBill(totalAmountFly: string, numPeople: number): string[] {
  if (typeof totalAmountFly !== "string" || !/^\d+$/.test(totalAmountFly)) {
    throw new SplitBillError(
      `totalAmountFly must be a string of wei digits, got "${totalAmountFly}"`,
    );
  }
  if (!Number.isInteger(numPeople) || numPeople <= 0) {
    throw new SplitBillError(
      `numPeople must be a positive whole number, got ${numPeople}`,
    );
  }

  const total = BigInt(totalAmountFly);
  const people = BigInt(numPeople);

  const base = total / people;
  const remainder = total % people;

  const shares: bigint[] = new Array(numPeople).fill(base);
  // Whatever does not divide evenly goes to the first share.
  shares[0] += remainder;

  return shares.map((share) => share.toString());
}
