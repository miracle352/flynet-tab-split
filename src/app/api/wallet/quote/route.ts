import { getCurrentUser } from "@/auth/currentUser";
import { MoneyError, parseDecimalToWei } from "@/money";
import { quoteSwap } from "@/wallet/service";
import type { Asset } from "@/ledger/store";

/** GET /api/wallet/quote?from=USDT&to=FLY&amount=50 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const from: Asset = params.get("from") === "FLY" ? "FLY" : "USDT";
  const to: Asset = from === "FLY" ? "USDT" : "FLY";
  const raw = params.get("amount") ?? "0";

  try {
    const quote = quoteSwap(from, to, parseDecimalToWei(raw));
    return Response.json({ quote }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof MoneyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
