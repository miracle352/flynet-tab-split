"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { displayName } from "@/auth/demoUsers";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { formatFly } from "@/money";

const LINKS = [
  { href: "/", label: "Home", exact: true },
  { href: "/restaurants", label: "Venues" },
  { href: "/visits", label: "My visits" },
];

function Mark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-[var(--ink)] text-[0.8125rem] font-bold text-[var(--bg)]"
    >
      TS
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useCurrentUser();

  // The sign-in screen gets the chrome without the navigation.
  const bare = pathname === "/login";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-3">
          <Link href={user ? "/" : "/login"} className="flex items-center gap-2.5">
            <Mark />
            <span className="text-sm font-semibold tracking-tight">
              Flynet Tab Split
            </span>
          </Link>

          {!bare && user ? (
            <>
              <nav className="ml-4 hidden items-center gap-1 sm:flex">
                {LINKS.map((link) => {
                  const active = link.exact
                    ? pathname === link.href
                    : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-[var(--surface)] font-medium text-[var(--ink)] shadow-[var(--shadow-sm)]"
                          : "text-[var(--muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="ml-auto flex items-center gap-3">
                <span
                  className="hidden font-mono text-xs text-[var(--muted)] sm:inline"
                  title="FLY balance"
                >
                  {formatFly(user.balance.balance.value)} FLY
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                  {displayName(user)
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    router.push("/login");
                    router.refresh();
                  }}
                  className="btn btn-quiet !px-2.5 !py-1.5 text-xs"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              {loading ? (
                <span className="skeleton h-6 w-20" />
              ) : (
                <span className="chip chip-idle">Demo build</span>
              )}
            </div>
          )}
        </div>

        {!bare && user ? (
          <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-5 pb-2 sm:hidden">
            {LINKS.map((link) => {
              const active = link.exact
                ? pathname === link.href
                : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                    active
                      ? "bg-[var(--surface)] font-medium shadow-[var(--shadow-sm)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-[var(--line)] py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Settlement in FLY is one-way by design: member wallet → venue. There
            is no peer-to-peer transfer in Flynet v1.
          </span>
          <span className="font-mono">mock mode</span>
        </div>
      </footer>
    </div>
  );
}
