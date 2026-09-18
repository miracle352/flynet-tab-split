import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAuthorizeUrl,
  createCodeChallenge,
  createCodeVerifier,
  createState,
  type OAuthConfig,
} from "./oauth.ts";

const config: OAuthConfig = {
  clientId: "client-123",
  clientSecret: "secret",
  redirectUri: "http://localhost:3000/api/auth/oauth/callback",
  authorizeUrl: "https://auth.example.test/authorize",
  tokenUrl: "https://auth.example.test/token",
  scopes: "read:profile payments",
};

describe("PKCE", () => {
  it("matches the RFC 7636 Appendix B test vector", () => {
    // The canonical example from the spec, so a broken base64url or
    // hashing step cannot pass by accident.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    assert.equal(
      createCodeChallenge(verifier),
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("generates verifiers within the RFC length bounds", () => {
    for (let i = 0; i < 50; i++) {
      const verifier = createCodeVerifier();
      assert.ok(verifier.length >= 43, `${verifier.length} too short`);
      assert.ok(verifier.length <= 128, `${verifier.length} too long`);
      assert.match(verifier, /^[A-Za-z0-9\-._~]+$/, "unreserved chars only");
    }
  });

  it("generates base64url output with no padding or unsafe chars", () => {
    const challenge = createCodeChallenge(createCodeVerifier());
    assert.doesNotMatch(challenge, /[+/=]/);
  });

  it("never reuses a verifier or state", () => {
    const verifiers = new Set(Array.from({ length: 200 }, createCodeVerifier));
    const states = new Set(Array.from({ length: 200 }, createState));
    assert.equal(verifiers.size, 200);
    assert.equal(states.size, 200);
  });

  it("is deterministic for the same verifier", () => {
    const verifier = createCodeVerifier();
    assert.equal(createCodeChallenge(verifier), createCodeChallenge(verifier));
  });
});

describe("buildAuthorizeUrl", () => {
  it("sets every required OAuth + PKCE parameter", () => {
    const url = new URL(buildAuthorizeUrl(config, "state-1", "challenge-1"));
    assert.equal(url.origin + url.pathname, "https://auth.example.test/authorize");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "client-123");
    assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
    assert.equal(url.searchParams.get("scope"), "read:profile payments");
    assert.equal(url.searchParams.get("state"), "state-1");
    assert.equal(url.searchParams.get("code_challenge"), "challenge-1");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  });

  it("never leaks the client secret into the URL", () => {
    const url = buildAuthorizeUrl(config, "s", "c");
    assert.ok(!url.includes("secret"));
  });
});
