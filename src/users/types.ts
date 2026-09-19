import type { Wallet } from "@/types";

export interface ConnectedWallet {
  provider: string;
  address: string;
  connected_at: string;
}

export interface MemberBalances {
  /** FLY, in wei. */
  fly: string;
  /** USDT, in 18-decimal units. */
  usdt: string;
}

/** A person who can hold a balance and settle a share. */
export interface Member {
  id: string;
  object: "user";
  handle: string;
  first_name: string;
  last_name: string;
  email: string;
  /** scrypt hash, or null for a member who has not set one yet. */
  password_hash: string | null;
  /** Hue for the generated avatar, 0..359. */
  avatar_hue: number;
  wallets: Wallet[];
  balances: MemberBalances;
  connected_wallet: ConnectedWallet | null;
  created_at: string;
  last_seen_at: string;
}

/** Everything safe to send to the browser. */
export type PublicMember = Omit<Member, "password_hash">;

export function memberName(member: Pick<Member, "first_name" | "last_name">): string {
  return `${member.first_name} ${member.last_name}`.trim();
}

export function initials(member: Pick<Member, "first_name" | "last_name">): string {
  const first = member.first_name.trim().charAt(0);
  const last = member.last_name.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

export function toPublicMember(member: Member): PublicMember {
  const rest: PublicMember = { ...member };
  delete (rest as Partial<Member>).password_hash;
  return rest;
}
