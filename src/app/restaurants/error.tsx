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
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Couldn’t load the venue list
        </h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {error.message}
        </p>
        <p className="text-sm text-zinc-500">
          In mock mode this usually means <code>MOCK_MODE=true</code> is not set;
          in live mode check <code>API_BASE_URL</code> and <code>API_KEY</code>.
        </p>
        <button
          type="button"
          onClick={retry}
          className="self-start rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Try again
        </button>
      </main>
    </div>
  );
}
