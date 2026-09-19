import { getCurrentUser } from "@/auth/currentUser";
import { ledgerFor, summarise } from "@/ledger/store";

/** GET /api/ledger: the signed-in member's movement history. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "50");
  const entries = await ledgerFor(user.id, Number.isFinite(limit) ? limit : 50);
  const totals = summarise(entries);

  return Response.json({
    entries,
    // BigInts are not JSON serialisable; the client formats them anyway.
    totals: {
      received_fly: totals.receivedFly.toString(),
      spent_fly: totals.spentFly.toString(),
      funded_usdt: totals.fundedUsdt.toString(),
      swapped_usdt: totals.swappedUsdt.toString(),
      table_count: totals.tableCount,
    },
  });
}
