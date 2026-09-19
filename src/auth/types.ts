import type { ConnectedWallet, Member, MemberBalances } from "@/users/types";
import type { Wallet } from "@/types";

/**
 * The signed-in person, as the app sees them.
 *
 * Deliberately a subset of the stored member: the password hash never
 * leaves the server, and balances ride along so the header and the
 * wallet screen render from one object.
 */
export interface CurrentUser {
  id: string;
  object: "user";
  handle: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_hue: number;
  wallets: Wallet[];
  balance: MemberBalances;
  connected_wallet: ConnectedWallet | null;
  created_at: string;
}

export function toCurrentUser(member: Member): CurrentUser {
  return {
    id: member.id,
    object: "user",
    handle: member.handle,
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    avatar_hue: member.avatar_hue,
    wallets: member.wallets,
    balance: member.balances,
    connected_wallet: member.connected_wallet,
    created_at: member.created_at,
  };
}

/**
 * Cookie payload. `userId` always points at a member record;
 * `accessToken` is only present for sessions that came through an
 * external identity provider.
 */
export interface Session {
  userId: string;
  accessToken: string | null;
}

export const SESSION_COOKIE = "flynet_session";
