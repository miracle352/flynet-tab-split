import { getCurrentUser } from "@/auth/currentUser";
import { toCurrentUser } from "@/auth/types";
import { MoneyError } from "@/money";
import { createSelfCustodyWallet } from "@/wallet/service";

/**
 * POST /api/wallet/create: issue a wallet for somebody who arrived
 * without one. The recovery phrase is returned exactly once.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const created = await createSelfCustodyWallet(user.id);
    return Response.json(
      {
        user: toCurrentUser(created.member),
        address: created.address,
        recoveryPhrase: created.recoveryPhrase,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MoneyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
