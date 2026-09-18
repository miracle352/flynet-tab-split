import { DEMO_USERS } from "@/auth/demoUsers";
import { oauthEnabled } from "@/auth/oauth";
import { LoginForm } from "./LoginForm";

/** Same guard as `safeNext` in middleware: relative, not protocol-relative. */
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
  const { next, error } = await searchParams;
  const redirectTo = safeNext(next);
  const oauth = oauthEnabled();
  const errorMessage = Array.isArray(error) ? error[0] : error;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col items-stretch gap-8">
        <div>
          <p className="eyebrow">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)]">
            {oauth ? "Sign in" : "Log in as a demo member"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            {oauth
              ? "Connect your Blackbird account to check in and settle tables in FLY."
              : "Mock login only. Set the FLYNET_OAUTH_* variables to switch this page to real Flynet OAuth — the session cookie and useCurrentUser() stay the same."}
          </p>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] p-3 text-sm text-[var(--danger)]/40"
          >
            {errorMessage}
          </p>
        ) : null}

        {oauth ? (
          <a
            href={`/api/auth/oauth/start${
              redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ""
            }`}
            className="rounded-full bg-[var(--ink)] px-5 py-3 text-center text-sm font-medium text-[var(--bg)] hover:opacity-90"
          >
            Connect with Blackbird
          </a>
        ) : null}

        <div className="flex flex-col gap-3">
          {oauth ? (
            <p className="eyebrow">
              Or use a demo member
            </p>
          ) : null}
          <LoginForm users={DEMO_USERS} redirectTo={redirectTo} />
        </div>
      </main>
    </div>
  );
}
