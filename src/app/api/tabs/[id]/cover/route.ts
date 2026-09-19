import { getCurrentUser } from "@/auth/currentUser";
import { getSession } from "@/auth/session";
import { coverUnclaimedSeats, errorResponse } from "@/tabs/service";

/** POST /api/tabs/{id}/cover — host settles the seats nobody claimed. */
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
    const tab = await coverUnclaimedSeats(id, user, session.accessToken);
    return Response.json({ tab });
  } catch (error) {
    return errorResponse(error);
  }
}
