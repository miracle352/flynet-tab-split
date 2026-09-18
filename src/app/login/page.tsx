import { DEMO_USERS } from "@/auth/demoUsers";
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
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const redirectTo = safeNext(next);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col items-stretch gap-8">
        <div>
          <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
            Flynet Tab Split
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Log in as a demo member
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Mock login only. Later this page becomes Flynet OAuth; the
            session cookie and <code>useCurrentUser()</code> stay the same.
          </p>
        </div>
        <LoginForm users={DEMO_USERS} redirectTo={redirectTo} />
      </main>
    </div>
  );
}
