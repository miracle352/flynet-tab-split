import { getCurrentUser } from "@/auth/currentUser";
import { toCurrentUser } from "@/auth/types";
import { MoneyError, parseDecimalToWei } from "@/money";
import type { Asset } from "@/ledger/store";
import { MemberError } from "@/users/store";
import { executeSwap } from "@/wallet/service";

/** POST /api/wallet/swap — buy FLY with USDT, or the other way round. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { from?: unknown; to?: unknown; amount?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const from: Asset = body.from === "FLY" ? "FLY" : "USDT";
  const to: Asset = from === "FLY" ? "USDT" : "FLY";

  try {
    const amount = parseDecimalToWei(String(body.amount ?? ""));
    const result = await executeSwap(user.id, from, to, amount);
    return Response.json({
      user: toCurrentUser(result.member),
      receive: result.receive.toString(),
      entries: result.entries,
      quote: result.quote.quote,
    });
  } catch (error) {
    if (error instanceof MoneyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof MemberError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
