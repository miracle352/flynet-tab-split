import { getCurrentUser } from "@/auth/currentUser";
import { cancelTab, errorResponse } from "@/tabs/service";

/** POST /api/tabs/{id}/cancel: host cancels the table; paid shares refund. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let reason: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    reason = typeof body.reason === "string" ? body.reason : undefined;
  } catch {
    reason = undefined;
  }

  try {
    const tab = await cancelTab(id, user.id, reason);
    return Response.json({ tab });
  } catch (error) {
    return errorResponse(error);
  }
}
