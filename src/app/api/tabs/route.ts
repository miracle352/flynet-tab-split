import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { getActiveCheckIn } from "@/checkInState";
import { resolveMerchantId } from "@/flynetClient";
import { errorResponse, createTab, expireStaleTabs, type CreateTabInput } from "@/tabs/service";
import type { SplitMode } from "@/tabs/types";

/**
 * POST /api/tabs   open a table from the host's active check-in
 * GET  /api/tabs   tables the caller hosts or has a seat at
 *
 * The GET also clears tables that went idle, so a stale table disappears
 * from every client at the same moment and anything paid against it is
 * handed back.
 */

async function requireSession() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const user = await getCurrentUser();
  return user ? { session, user } : null;
}

export async function GET() {
  const auth = await requireSession();
  if (!auth) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const tabs = await expireStaleTabs();
  const mine = tabs.filter(
    (tab) =>
      tab.host_user_id === auth.user.id ||
      tab.shares.some((share) => share.user_id === auth.user.id),
  );

  return Response.json({ tabs: mine });
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Partial<CreateTabInput>;
  try {
    body = (await request.json()) as Partial<CreateTabInput>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const activeCheckIn = await getActiveCheckIn();
  if (!activeCheckIn) {
    return Response.json(
      { error: "Check in at a venue before opening a table" },
      { status: 409 },
    );
  }

  const splitMode: SplitMode = body.splitMode === "custom" ? "custom" : "even";

  try {
    const tab = await createTab(
      {
        subtotal: String(body.subtotal ?? ""),
        tipPercent: typeof body.tipPercent === "number" ? body.tipPercent : 0,
        splitMode,
        participantIds: Array.isArray(body.participantIds)
          ? body.participantIds.map((id) => String(id))
          : undefined,
        openSeats: typeof body.openSeats === "number" ? body.openSeats : 0,
        amounts: Array.isArray(body.amounts)
          ? body.amounts.map((amount) => String(amount))
          : undefined,
      },
      auth.user,
      activeCheckIn,
      auth.session.accessToken,
      resolveMerchantId(),
    );
    return Response.json({ tab }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
