import type { Metadata } from "next";
import { oauthEnabled } from "@/auth/oauth";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to FlyTab or create a wallet.",
};

/** Same guard as `safeNext` in the proxy: relative, never protocol-relative. */
function safeNext(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return undefined;
  }
  return candidate;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthForm next={safeNext(next)} oauthEnabled={oauthEnabled()} initialUser={null} />
  );
}
