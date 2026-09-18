"use client";

// Error boundaries must be Client Components.
// Note: Next.js 16 renamed this prop from `reset` to `retry`.
export default function RestaurantsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <main className="flex w-full max-w-md flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Couldn’t load the venue list
        </h1>
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          {error.message}
        </p>
        <p className="text-sm text-[var(--muted)]">
          In mock mode this usually means <code>MOCK_MODE=true</code> is not set;
          in live mode check <code>API_BASE_URL</code> and <code>API_KEY</code>.
        </p>
        <button
          type="button"
          onClick={retry}
          className="self-start rounded-full border border-[var(--line-strong)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-sunken)]"
        >
          Try again
        </button>
      </main>
    </div>
  );
}
