import { getCurrentUser } from "@/auth/currentUser";
import { toCurrentUser } from "@/auth/types";
import { MoneyError } from "@/money";
import { MemberError } from "@/users/store";
import {
  WALLET_PROVIDERS,
  connectExternalWallet,
  disconnectWallet,
} from "@/wallet/service";

/** POST /api/wallet/connect — link an installed wallet. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { provider?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const provider = typeof body.provider === "string" ? body.provider : "";
  if (!WALLET_PROVIDERS.some((option) => option.id === provider)) {
    return Response.json({ error: "Choose a wallet to connect" }, { status: 400 });
  }

  try {
    const member = await connectExternalWallet(user.id, provider);
    return Response.json({ user: toCurrentUser(member) });
  } catch (error) {
    if (error instanceof MemberError || error instanceof MoneyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

/** DELETE /api/wallet/connect — unlink the external wallet. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const member = await disconnectWallet(user.id);
  if (!member) {
    return Response.json({ error: "That account no longer exists" }, { status: 404 });
  }
  return Response.json({ user: toCurrentUser(member) });
}
