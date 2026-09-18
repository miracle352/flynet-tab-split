import { FlynetClientError, checkIn } from "@/flynetClient";
import { getSession } from "@/auth/session";
import { clearActiveCheckIn, setActiveCheckIn } from "@/checkInState";

/**
 * POST   /api/check-ins  { locationId } → { check_in }
 * DELETE /api/check-ins                 → clears the active check-in
 *
 * `checkIn()` is a get-or-create: Flynet has no partner endpoint to
 * create a check-in, so this returns the venue's current check-in and
 * re-calling it is safe.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  let locationId: unknown;
  try {
    const body = (await request.json()) as { locationId?: unknown };
    locationId = body.locationId;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof locationId !== "string" || locationId.length === 0) {
    return Response.json({ error: "locationId is required" }, { status: 400 });
  }

  try {
    const record = await checkIn(locationId);
    await setActiveCheckIn({
      locationId: record.location.id,
      checkInId: record.id,
    });
    return Response.json({ check_in: record });
  } catch (error) {
    if (error instanceof FlynetClientError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  await clearActiveCheckIn();
  return Response.json({ ok: true });
}
