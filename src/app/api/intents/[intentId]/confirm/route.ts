import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { errorResponse, paySeat } from "@/tabs/service";
import { findByIntentId } from "@/tabs/store";

/**
 * POST /api/intents/{intentId}/confirm
 *
 * Confirms the specific payment request the member opened. The seat is
 * resolved from the intent, and `paySeat` re-checks that the caller
 * actually owns it and can afford it.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await params;

  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const found = await findByIntentId(intentId);
  if (!found) {
    return Response.json({ error: "Payment request not found" }, { status: 404 });
  }

  try {
    const tab = await paySeat(found.tab.id, user, session.accessToken, found.share.seat);
    return Response.json({ tab, intentId });
  } catch (error) {
    return errorResponse(error);
  }
}
