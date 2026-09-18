import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { getActiveCheckIn } from "@/checkInState";
import { resolveMerchantId } from "@/flynetClient";
import { errorResponse, createTab, type CreateTabInput } from "@/tabs/service";
import { tabsInvolving } from "@/tabs/store";
import type { SplitMode } from "@/tabs/types";

/**
 * POST /api/tabs   open a table from the host's active check-in
 * GET  /api/tabs   tabs the caller hosts or has a seat at
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
  return Response.json({ tabs: await tabsInvolving(auth.user.id) });
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
