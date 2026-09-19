import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRICE_TICK_MS,
  bucketAt,
  flyPriceMicro,
  flyWeiFromUsdMicro,
  formatUsdCents,
  formatUsdFromFly,
  priceMicroAt,
  priceSeries,
  quoteAt,
  usdCentsFromFly,
} from "./fly.ts";
import { FLY_WEI } from "../money.ts";

describe("the FLY quote", () => {
  it("is a pure function of the tick, so server and client agree", () => {
    const moment = new Date("2026-09-19T12:00:00.000Z");
    assert.equal(flyPriceMicro(moment), flyPriceMicro(new Date(moment.getTime())));
    assert.equal(priceMicroAt(bucketAt(moment)), flyPriceMicro(moment));
  });

  it("advances as time moves", () => {
    const a = new Date("2026-09-19T12:00:00.000Z");
    const b = new Date(a.getTime() + PRICE_TICK_MS * 40);
    assert.notEqual(priceMicroAt(bucketAt(a)), priceMicroAt(bucketAt(b)));
  });

  it("stays inside a sane band, always positive", () => {
    for (let bucket = 0; bucket < 5_000; bucket += 7) {
      const price = priceMicroAt(bucket);
      assert.ok(price > 400_000, `price ${price} fell out of band`);
      assert.ok(price < 1_400_000, `price ${price} flew out of band`);
    }
  });

  it("returns a 24h high at or above the low", () => {
    const quote = quoteAt(new Date("2026-09-19T12:00:00.000Z"));
    assert.ok(quote.high24h >= quote.low24h);
    assert.ok(quote.priceMicro >= quote.low24h);
    assert.ok(quote.priceMicro <= quote.high24h);
    assert.ok(Number.isFinite(quote.change24hPct));
  });

  it("gives a sparkline series, oldest first", () => {
    const series = priceSeries(12, new Date("2026-09-19T12:00:00.000Z"));
    assert.equal(series.length, 12);
    assert.equal(series[11], flyPriceMicro(new Date("2026-09-19T12:00:00.000Z")));
  });
});

describe("currency conversion", () => {
  it("prices 1 FLY at the quote", () => {
    const priceMicro = 1_048_000; // $1.048
    assert.equal(usdCentsFromFly(FLY_WEI, priceMicro), 105n); // 104.8c rounds to 105
  });

  it("keeps whole dollars exact", () => {
    assert.equal(usdCentsFromFly(FLY_WEI * 3n, 1_000_000), 300n);
  });

  it("round-trips USD → FLY → USD", () => {
    const priceMicro = 1_234_567;
    const usdMicro = 50_000_000n; // $50
    const fly = flyWeiFromUsdMicro(usdMicro, priceMicro);
    const back = usdCentsFromFly(fly, priceMicro);
    // Integer truncation on the way in costs at most a cent.
    assert.ok(back >= 4_999n && back <= 5_000n, `got ${back} cents`);
  });

  it("formats cents as dollars with grouping", () => {
    assert.equal(formatUsdCents(123_456n), "$1,234.56");
    assert.equal(formatUsdCents(0n), "$0.00");
    assert.equal(formatUsdCents(-250n), "-$2.50");
  });

  it("formats FLY straight to dollars", () => {
    assert.equal(formatUsdFromFly(FLY_WEI * 2n, 1_000_000), "$2.00");
  });
});
