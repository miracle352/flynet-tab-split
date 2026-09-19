import { getCurrentUser } from "@/auth/currentUser";
import { searchMembers } from "@/users/store";

/** GET /api/people/search?q=… — name, @handle or email. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const people = await searchMembers(query, { excludeId: user.id, limit: 8 });
  return Response.json({ people });
}
