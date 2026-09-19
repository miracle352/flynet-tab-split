import { getCurrentUser } from "@/auth/currentUser";
import { toCurrentUser } from "@/auth/types";
import { MoneyError, parseDecimalToWei } from "@/money";
import type { Asset } from "@/ledger/store";
import { MemberError } from "@/users/store";
import { depositFunds } from "@/wallet/service";

/** POST /api/wallet/deposit: credit an incoming FLY or USDT transfer. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { asset?: unknown; amount?: unknown; source?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const asset: Asset = body.asset === "USDT" ? "USDT" : "FLY";
  const source = body.source === "wallet" ? "wallet" : "address";

  try {
    const amount = parseDecimalToWei(String(body.amount ?? ""));
    const result = await depositFunds(user.id, asset, amount, source);
    return Response.json({
      user: toCurrentUser(result.member),
      entry: result.entry,
    });
  } catch (error) {
    if (error instanceof MoneyError || error instanceof MemberError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
