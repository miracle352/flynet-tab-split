import { verifyPassword, MIN_PASSWORD_LENGTH } from "@/auth/passwords";
import { setSession } from "@/auth/session";
import { toCurrentUser } from "@/auth/types";
import { getMemberByEmail } from "@/users/store";

/** POST /api/auth/login: email + password. */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return Response.json(
      { error: "Enter your email and password" },
      { status: 400 },
    );
  }

  const member = await getMemberByEmail(email);
  // Same message either way, so the form cannot be used to enumerate accounts.
  if (!member || !verifyPassword(password, member.password_hash)) {
    return Response.json(
      { error: "That email and password do not match" },
      { status: 401 },
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json({ error: "Password is too short" }, { status: 400 });
  }

  await setSession({ userId: member.id, accessToken: null });
  return Response.json({ user: toCurrentUser(member) });
}
