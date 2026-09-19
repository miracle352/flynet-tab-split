import { createHash, randomBytes } from "node:crypto";

/**
 * FlyTab OAuth 2.0 + PKCE.
 *
 * This module only builds requests and parses responses — it never
 * touches cookies or Next.js APIs, so it can be unit tested.
 *
 * Configure with:
 *   FLYTAB_CLIENT_ID
 *   FLYTAB_CLIENT_SECRET
 *   FLYTAB_OAUTH_REDIRECT_URI
 *   FLYTAB_OAUTH_AUTHORIZE_URL   (authorization endpoint)
 *   FLYTAB_OAUTH_TOKEN_URL       (token endpoint)
 *   FLYTAB_OAUTH_SCOPES          (optional, space separated)
 */

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
}

/** Scopes this app needs: profile, wallets, check-ins, payments. */
export const DEFAULT_SCOPES =
  "read:profile read:wallets read:user_checkins payments";

export function getOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.FLYTAB_CLIENT_ID;
  const clientSecret = process.env.FLYTAB_CLIENT_SECRET;
  const redirectUri = process.env.FLYTAB_OAUTH_REDIRECT_URI;
  const authorizeUrl = process.env.FLYTAB_OAUTH_AUTHORIZE_URL;
  const tokenUrl = process.env.FLYTAB_OAUTH_TOKEN_URL;

  if (!clientId || !clientSecret || !redirectUri || !authorizeUrl || !tokenUrl) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl,
    tokenUrl,
    scopes: process.env.FLYTAB_OAUTH_SCOPES ?? DEFAULT_SCOPES,
  };
}

export function oauthEnabled(): boolean {
  return getOAuthConfig() !== null;
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 43-128 char high-entropy verifier, per RFC 7636. */
export function createCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

/** S256 challenge: BASE64URL(SHA256(verifier)). */
export function createCodeChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function createState(): string {
  return base64Url(randomBytes(24));
}

export function buildAuthorizeUrl(
  config: OAuthConfig,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export class OAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OAuthError";
    this.status = status;
  }
}

/** Exchanges the authorization code for tokens, presenting the verifier. */
export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const text = await res.text();
  let parsed: TokenResponse & { error?: string; error_description?: string };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new OAuthError(`Token endpoint returned ${res.status} with a non-JSON body`, 502);
  }

  if (!res.ok || !parsed.access_token) {
    throw new OAuthError(
      parsed.error_description ?? parsed.error ?? `Token exchange failed (${res.status})`,
      res.status >= 400 && res.status < 600 ? res.status : 502,
    );
  }

  return parsed;
}
