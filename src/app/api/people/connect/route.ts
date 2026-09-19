import { getCurrentUser } from "@/auth/currentUser";
import { MemberError, connect, getMember } from "@/users/store";

/** POST /api/people/connect — add somebody to your people graph. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { userId?: unknown; source?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const otherId = typeof body.userId === "string" ? body.userId : "";
  if (!otherId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const other = await getMember(otherId);
  if (!other) {
    return Response.json({ error: "That person is not on Flynet yet" }, { status: 404 });
  }

  try {
    const source = body.source === "invite" ? "invite" : body.source === "search" ? "search" : "table";
    await connect(user.id, other.id, source);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MemberError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
