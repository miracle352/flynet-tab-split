import Link from "next/link";

/** Shared sub-navigation across the history screens. */
export function HistoryTabs({ current }: { current: "activity" | "visits" | "tables" }) {
  const items = [
    { id: "activity", label: "Transactions", href: "/activity" },
    { id: "visits", label: "Visits", href: "/visits" },
    { id: "tables", label: "Tables", href: "/tables" },
  ] as const;

  return (
    <div className="segmented w-full sm:w-auto" role="tablist" aria-label="History">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          role="tab"
          aria-selected={current === item.id}
          className="flex-1 text-center sm:flex-none"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
