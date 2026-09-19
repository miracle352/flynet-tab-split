import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { errorResponse, paySeat } from "@/tabs/service";

/**
 * POST /api/tabs/{id}/pay: confirm the caller's own payment intent.
 * A member can only settle their own seat.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const tab = await paySeat(id, user, session.accessToken);
    return Response.json({ tab });
  } catch (error) {
    return errorResponse(error);
  }
}
