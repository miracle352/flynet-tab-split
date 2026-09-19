import { MIN_PASSWORD_LENGTH } from "@/auth/passwords";
import { setSession } from "@/auth/session";
import { toCurrentUser } from "@/auth/types";
import { recordEntry } from "@/ledger/store";
import { FLY_WEI } from "@/money";
import { MemberError, createMember } from "@/users/store";

/** Opening credit so a brand-new member can settle a share immediately. */
const WELCOME_FLY = BigInt(120) * FLY_WEI;
const WELCOME_USDT = BigInt(50) * FLY_WEI;

/** POST /api/auth/signup — create an account and sign straight in. */
export async function POST(request: Request) {
  let body: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    password?: unknown;
    handle?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password` },
      { status: 400 },
    );
  }

  try {
    const member = await createMember({
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      email: String(body.email ?? ""),
      password,
      handle: typeof body.handle === "string" ? body.handle : undefined,
      startingFly: WELCOME_FLY,
      startingUsdt: WELCOME_USDT,
    });

    await recordEntry({
      member_id: member.id,
      kind: "reward",
      direction: "in",
      asset: "FLY",
      amount: WELCOME_FLY,
      label: "Welcome credit",
      detail: "Added when your wallet was created",
      counterparty: "Flynet",
    });
    await recordEntry({
      member_id: member.id,
      kind: "deposit",
      direction: "in",
      asset: "USDT",
      amount: WELCOME_USDT,
      label: "Welcome credit",
      detail: "Added when your wallet was created",
      counterparty: "Flynet",
    });

    await setSession({ userId: member.id, accessToken: null });
    return Response.json({ user: toCurrentUser(member) }, { status: 201 });
  } catch (error) {
    if (error instanceof MemberError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
