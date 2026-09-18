import type { AccountBalance, Wallet } from "@/types";

/**
 * App-facing member identity. Shape is the merge of Flynet
 * `GET /users/me` + `GET /users/me/wallets`, so OAuth can fill the
 * same object later without changing callers of `useCurrentUser()`.
 */
export interface CurrentUser {
  id: string;
  object: "user";
  first_name: string;
  last_name: string;
  email: string;
  wallets: Wallet[];
  balance: AccountBalance;
}

/**
 * Cookie payload. Mock login sets `userId` and leaves `accessToken`
 * null. Real OAuth should set both from the token callback — that is
 * the only session-write that needs to change.
 */
export interface Session {
  userId: string;
  accessToken: string | null;
}

export const SESSION_COOKIE = "flynet_session";
