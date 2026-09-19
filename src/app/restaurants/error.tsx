"use client";

// Error boundaries must be Client Components.
// Next.js 16 renamed this prop from `reset` to `retry`.
export default function RestaurantsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start gap-4 py-10">
      <h1 className="display">The venue list did not load</h1>
      <p className="text-[0.875rem] leading-6 text-[var(--ink-soft)]">
        We could not reach the venue directory just now. Your wallet, tables and
        history are unaffected.
      </p>
      <p className="text-[0.8125rem] text-[var(--muted)]">{error.message}</p>
      <button type="button" onClick={retry} className="btn btn-primary">
        Try again
      </button>
    </div>
  );
}
