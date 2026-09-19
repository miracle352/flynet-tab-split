import { deterministicHex, hashPassword } from "@/auth/passwords";
import { FLY_WEI } from "@/money";
import type { Wallet } from "@/types";
import { mutateJson, readJson, writeJson } from "@/lib/jsonStore";
import { seedMembers } from "./seed";
import { memberName, type Member, type PublicMember, toPublicMember } from "./types";

/**
 * Member directory.
 *
 * Everyone who can hold a balance or settle a share lives here. The
 * file is seeded on first read so a fresh checkout has a populated
 * people graph to search, and every later member is a real sign-up.
 */

const FILE = "members";

export class MemberError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "MemberError";
    this.status = status;
  }
}

function slug(value: string): string {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return base || "member";
}

function uniqueHandle(wanted: string, taken: Set<string>): string {
  let candidate = wanted;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${wanted}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/** Reads the roster, seeding it once when the store is empty. */
async function roster(): Promise<Member[]> {
  const existing = await readJson<Member[]>(FILE, []);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }
  const seeded = seedMembers();
  await writeJson(FILE, seeded);
  return seeded;
}

export async function listMembers(): Promise<Member[]> {
  return roster();
}

export async function getMember(id: string): Promise<Member | null> {
  const members = await roster();
  return members.find((member) => member.id === id) ?? null;
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const wanted = email.trim().toLowerCase();
  const members = await roster();
  return members.find((member) => member.email.toLowerCase() === wanted) ?? null;
}

export async function getMembersByIds(ids: string[]): Promise<Member[]> {
  const members = await roster();
  const wanted = new Set(ids);
  return members.filter((member) => wanted.has(member.id));
}

export interface NewMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  handle?: string;
  /** Opening FLY credit, in wei. */
  startingFly?: bigint;
  startingUsdt?: bigint;
}

function walletsFor(memberId: string): Wallet[] {
  const now = new Date().toISOString();
  const mixed = (hex: string) =>
    `0x${hex.replace(/./g, (char, index) =>
      index % 3 === 0 ? char.toUpperCase() : char,
    )}`;

  return [
    {
      id: `${memberId.slice(0, 8)}-0000-4000-8000-000000000001`,
      object: "user_wallet",
      wallet_type: "MEMBERSHIP",
      address: mixed(deterministicHex(`${memberId}:membership`, 20)),
      created_at: now,
      updated_at: now,
    },
    {
      id: `${memberId.slice(0, 8)}-0000-4000-8000-000000000002`,
      object: "user_wallet",
      wallet_type: "SPENDING",
      address: mixed(deterministicHex(`${memberId}:spending`, 20)),
      created_at: now,
      updated_at: now,
    },
  ];
}

export async function createMember(input: NewMemberInput): Promise<Member> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();

  if (!firstName || !lastName) {
    throw new MemberError("Enter your full name");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new MemberError("Enter a valid email address");
  }

  return mutateJson<Member[]>(FILE, [], (current) => {
    const members = current.length > 0 ? current : seedMembers();
    if (members.some((member) => member.email.toLowerCase() === email)) {
      throw new MemberError("An account already uses that email", 409);
    }

    const id = crypto.randomUUID();
    const taken = new Set(members.map((member) => member.handle));
    const handle = uniqueHandle(
      input.handle?.trim() ? slug(input.handle) : slug(firstName),
      taken,
    );
    const now = new Date().toISOString();

    const member: Member = {
      id,
      object: "user",
      handle,
      first_name: firstName,
      last_name: lastName,
      email,
      password_hash: hashPassword(input.password),
      avatar_hue: Number(`0x${deterministicHex(id, 2).slice(0, 3)}`) % 360,
      wallets: walletsFor(id),
      balances: {
        fly: (input.startingFly ?? BigInt(0)).toString(),
        usdt: (input.startingUsdt ?? BigInt(0)).toString(),
      },
      connected_wallet: null,
      created_at: now,
      last_seen_at: now,
    };

    members.push(member);
    return members;
  }).then(async (members) => {
    const created = members.find((member) => member.email === input.email.trim().toLowerCase());
    if (!created) {
      throw new MemberError("Could not create the account", 500);
    }
    return created;
  });
}

export async function updateMember(
  id: string,
  mutate: (member: Member) => Member,
): Promise<Member | null> {
  let updated: Member | null = null;
  await mutateJson<Member[]>(FILE, [], (current) => {
    const members = current.length > 0 ? current : seedMembers();
    const index = members.findIndex((member) => member.id === id);
    if (index === -1) {
      return members;
    }
    updated = mutate(members[index]);
    members[index] = updated;
    return members;
  });
  return updated;
}

export interface BalanceDelta {
  fly?: bigint;
  usdt?: bigint;
}

/** Moves balances, refusing to let either asset go negative. */
export async function adjustBalances(
  id: string,
  delta: BalanceDelta,
): Promise<Member> {
  const flyDelta = delta.fly ?? BigInt(0);
  const usdtDelta = delta.usdt ?? BigInt(0);

  const updated = await updateMember(id, (member) => {
    const fly = BigInt(member.balances.fly) + flyDelta;
    const usdt = BigInt(member.balances.usdt) + usdtDelta;
    if (fly < BigInt(0)) {
      throw new MemberError("Not enough FLY for that", 402);
    }
    if (usdt < BigInt(0)) {
      throw new MemberError("Not enough USDT for that", 402);
    }
    return {
      ...member,
      balances: { fly: fly.toString(), usdt: usdt.toString() },
      last_seen_at: new Date().toISOString(),
    };
  });

  if (!updated) {
    throw new MemberError("That account no longer exists", 404);
  }
  return updated;
}

export async function touchMember(id: string): Promise<void> {
  await updateMember(id, (member) => ({
    ...member,
    last_seen_at: new Date().toISOString(),
  }));
}

// --- Social graph ---

const CONNECTIONS_FILE = "connections";

export interface Connection {
  member_id: string;
  other_id: string;
  source: "search" | "table" | "invite";
  created_at: string;
}

export interface ConnectionEdge extends Connection {
  member: PublicMember;
}

async function allConnections(): Promise<Connection[]> {
  return readJson<Connection[]>(CONNECTIONS_FILE, []);
}

/** Records a two-way edge. Repeating it is a no-op. */
export async function connect(
  a: string,
  b: string,
  source: Connection["source"] = "table",
): Promise<void> {
  if (a === b) {
    return;
  }
  await mutateJson<Connection[]>(CONNECTIONS_FILE, [], (current) => {
    const now = new Date().toISOString();
    const next = [...current];
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const exists = next.some(
        (edge) => edge.member_id === from && edge.other_id === to,
      );
      if (!exists) {
        next.push({ member_id: from, other_id: to, source, created_at: now });
      }
    }
    return next;
  });
}

export async function connectionsFor(memberId: string): Promise<ConnectionEdge[]> {
  const [edges, members] = await Promise.all([allConnections(), roster()]);
  const byId = new Map(members.map((member) => [member.id, member]));

  return edges
    .filter((edge) => edge.member_id === memberId)
    .map((edge) => {
      const member = byId.get(edge.other_id);
      return member ? { ...edge, member: toPublicMember(member) } : null;
    })
    .filter((edge): edge is ConnectionEdge => edge !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * People search. Matches name, handle and email, and ranks an exact
 * handle hit above a partial name match so typing "@amara" lands on one
 * person instead of a list.
 */
export async function searchMembers(
  query: string,
  options: { excludeId?: string; limit?: number } = {},
): Promise<PublicMember[]> {
  const needle = query.trim().toLowerCase().replace(/^@/, "");
  const members = await roster();
  const limit = options.limit ?? 8;

  if (!needle) {
    return members
      .filter((member) => member.id !== options.excludeId)
      .slice(0, limit)
      .map(toPublicMember);
  }

  const scored = members
    .filter((member) => member.id !== options.excludeId)
    .map((member) => {
      const name = memberName(member).toLowerCase();
      const handle = member.handle.toLowerCase();
      const email = member.email.toLowerCase();
      let score = -1;
      if (handle === needle) score = 100;
      else if (email === needle) score = 95;
      else if (handle.startsWith(needle)) score = 80;
      else if (name.startsWith(needle)) score = 70;
      else if (name.includes(needle)) score = 50;
      else if (handle.includes(needle)) score = 40;
      else if (email.includes(needle)) score = 30;
      return { member, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || memberName(a.member).localeCompare(memberName(b.member)));

  return scored.slice(0, limit).map((entry) => toPublicMember(entry.member));
}

/** Convenience for callers that only need the display shape. */
export async function publicMember(id: string): Promise<PublicMember | null> {
  const member = await getMember(id);
  return member ? toPublicMember(member) : null;
}

export const ZERO = BigInt(0);
export const ONE_FLY = FLY_WEI;
