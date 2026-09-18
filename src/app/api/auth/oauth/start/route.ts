import { cookies } from "next/headers";
import {
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  createState,
  getOAuthConfig,
} from "@/auth/oauth";

export const OAUTH_STATE_COOKIE = "flynet_oauth";

/**
 * GET /api/auth/oauth/start
 *
 * Kicks off Authorization Code + PKCE. The verifier and state live in a
 * short-lived httpOnly cookie — never in the URL, so the verifier is
 * not leaked to browser history or the referer header.
 */
export async function GET(request: Request) {
  const config = getOAuthConfig();
  if (!config) {
    return new Response(
      "OAuth is not configured. Set FLYNET_CLIENT_ID, FLYNET_CLIENT_SECRET, " +
        "FLYNET_OAUTH_REDIRECT_URI, FLYNET_OAUTH_AUTHORIZE_URL and " +
        "FLYNET_OAUTH_TOKEN_URL.",
      { status: 503 },
    );
  }

  const verifier = createCodeVerifier();
  const state = createState();
  const challenge = createCodeChallenge(verifier);

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const authorize = buildAuthorizeUrl(config, state, challenge);
  const target =
    next && next.startsWith("/") && !next.startsWith("//")
      ? `${authorize}&next=${encodeURIComponent(next)}`
      : authorize;

  return Response.redirect(target, 302);
}
