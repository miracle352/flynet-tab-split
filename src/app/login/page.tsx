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
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {oauth ? "Sign in" : "Log in as a demo member"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {oauth
              ? "Connect your Blackbird account to check in and settle tables in FLY."
              : "Mock login only. Set the FLYNET_OAUTH_* variables to switch this page to real Flynet OAuth — the session cookie and useCurrentUser() stay the same."}
          </p>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}

        {oauth ? (
          <a
            href={`/api/auth/oauth/start${
              redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ""
            }`}
            className="rounded-full bg-zinc-900 px-5 py-3 text-center text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Connect with Blackbird
          </a>
        ) : null}

        <div className="flex flex-col gap-3">
          {oauth ? (
            <p className="text-xs tracking-wide text-zinc-400 uppercase">
              Or use a demo member
            </p>
          ) : null}
          <LoginForm users={DEMO_USERS} redirectTo={redirectTo} />
        </div>
      </main>
    </div>
  );
}
