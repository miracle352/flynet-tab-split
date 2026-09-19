import { quoteAt } from "@/price/fly";

/**
 * GET /api/price — the live FLY quote.
 *
 * The wallet and every dollar figure on screen poll this, so a price
 * change shows up everywhere within one tick.
 */
export async function GET() {
  return Response.json(
    { quote: quoteAt() },
    { headers: { "cache-control": "no-store" } },
  );
}
