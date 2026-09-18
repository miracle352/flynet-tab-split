import { findDemoUser } from "@/auth/demoUsers";
import { setSession } from "@/auth/session";

export async function POST(request: Request) {
  let userId: unknown;
  try {
    const body = (await request.json()) as { userId?: unknown };
    userId = body.userId;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof userId !== "string") {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const user = findDemoUser(userId);
  if (!user) {
    return Response.json({ error: "Unknown demo user" }, { status: 404 });
  }

  await setSession({ userId: user.id, accessToken: null });
  return Response.json({ user });
}
