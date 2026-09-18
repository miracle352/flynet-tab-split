import { getCurrentUser } from "@/auth/currentUser";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ user });
}
