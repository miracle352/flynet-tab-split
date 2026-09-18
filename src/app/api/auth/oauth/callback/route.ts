import { cookies } from "next/headers";
import { getMyProfile } from "@/flynetClient";
import {
  exchangeCodeForToken,
  getOAuthConfig,
  OAuthError,
} from "@/auth/oauth";
import { setSession } from "@/auth/session";
import { OAUTH_STATE_COOKIE } from "../start/route";

/**
 * GET /api/auth/oauth/callback
 *
 * This is the only place the session is written for real OAuth, which
 * is what keeps the swap contained: every consumer downstream reads
 * `getCurrentUser()` / `useCurrentUser()` and never changes.
 */
export async function GET(request: Request) {
  const config = getOAuthConfig();
  if (!config) {
    return new Response("OAuth is not configured", { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const upstreamError = url.searchParams.get("error");

  if (upstreamError) {
    return Response.redirect(
      new URL(`/login?error=${encodeURIComponent(upstreamError)}`, request.url),
      302,
    );
  }
  if (!code || !state) {
    return Response.redirect(new URL("/login?error=missing_code", request.url), 302);
  }

  const store = await cookies();
  const raw = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  let saved: { state?: string; verifier?: string } = {};
  try {
    saved = raw ? (JSON.parse(raw) as typeof saved) : {};
  } catch {
    saved = {};
  }
  if (!saved.state || saved.state !== state || !saved.verifier) {
    // CSRF protection: the state we issued must come back unchanged.
    return Response.redirect(new URL("/login?error=state_mismatch", request.url), 302);
  }

  try {
    const tokens = await exchangeCodeForToken(config, code, saved.verifier);
    const profile = await getMyProfile(tokens.access_token);

    await setSession({ userId: profile.id, accessToken: tokens.access_token });

    const next = url.searchParams.get("next");
    const target =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return Response.redirect(new URL(target, request.url), 302);
  } catch (error) {
    const message =
      error instanceof OAuthError ? error.message : "Sign-in failed";
    return Response.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
      302,
    );
  }
}
