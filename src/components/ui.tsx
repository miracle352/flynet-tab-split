import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  raised = false,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <section
      className={["card", raised ? "card-raised" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <h2 className="truncate text-[0.9375rem] font-semibold tracking-tight">
          {title}
        </h2>
        {hint ? (
          <p className="mt-0.5 text-sm text-[var(--muted)]">{hint}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="chip chip-paid">
        <Dot /> Paid
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="chip chip-pending">
        <Dot /> Awaiting
      </span>
    );
  }
  return <span className="chip chip-idle">Open seat</span>;
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="size-1.5 rounded-full bg-current opacity-80"
    />
  );
}

/** Segmented settlement progress — reads instantly at a glance. */
export function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((paid / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${paid} of ${total} shares paid`}
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-[var(--muted)]">{pct}%</span>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-8">
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-[var(--muted)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 7h16M4 12h16M4 17h9" strokeLinecap="round" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">{body}</p>
      </div>
      {action}
    </div>
  );
}

/** Explainer used where Flynet's constraints change what the UI can do. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-3 text-sm leading-6 text-[var(--ink-soft)]">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[0.6875rem] font-bold text-[var(--accent)]"
      >
        i
      </span>
      <div>{children}</div>
    </div>
  );
}
