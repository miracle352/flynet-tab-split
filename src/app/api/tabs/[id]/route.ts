import { getCurrentUser } from "@/auth/currentUser";
import { getTab } from "@/tabs/store";

/** GET /api/tabs/{id}: the live status view polls this. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const tab = await getTab(id);
  if (!tab) {
    return Response.json({ error: "Table not found" }, { status: 404 });
  }

  const involved =
    tab.host_user_id === user.id ||
    tab.shares.some((share) => share.user_id === user.id);
  if (!involved) {
    return Response.json({ error: "Not your table" }, { status: 403 });
  }

  return Response.json({ tab });
}
