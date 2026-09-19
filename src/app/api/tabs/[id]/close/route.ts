import { getCurrentUser } from "@/auth/currentUser";
import { closeTab, errorResponse } from "@/tabs/service";

/** POST /api/tabs/{id}/close — host closes a table that has empty seats. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const tab = await closeTab(id, user.id);
    return Response.json({ tab });
  } catch (error) {
    return errorResponse(error);
  }
}
