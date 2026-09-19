"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./Logo";
import {
  Avatar,
  Chip,
  Sparkline,
} from "./ui";
import {
  HomeIcon,
  LogoutIcon,
  PeopleIcon,
  PinIcon,
  PlusIcon,
  ReceiptIcon,
  InfoIcon,
  UserIcon,
  WalletIcon,
} from "./icons";
import { formatFly, formatUsdt } from "@/money";
import {
  PriceProvider,
  ToastProvider,
  ToastStack,
  UserProvider,
  usePrice,
  useSignOut,
  useUser,
} from "./providers";
import type { PriceQuote } from "@/price/fly";
import type { CurrentUser } from "@/auth/types";
import { memberName } from "@/users/types";

const LINKS = [
  { href: "/", label: "Wallet", icon: HomeIcon, exact: true },
  { href: "/restaurants", label: "Venues", icon: PinIcon },
  { href: "/tables", label: "Tables", icon: ReceiptIcon },
  { href: "/activity", label: "Activity", icon: WalletIcon },
  { href: "/people", label: "People", icon: PeopleIcon },
];

const MOBILE_LINKS = [
  { href: "/", label: "Wallet", icon: HomeIcon, exact: true },
  { href: "/restaurants", label: "Venues", icon: PinIcon },
  { href: "/activity", label: "Activity", icon: ReceiptIcon },
  { href: "/people", label: "People", icon: PeopleIcon },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) {
    return pathname === href;
  }
  if (href === "/activity") {
    return pathname === "/activity" || pathname.startsWith("/visits");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PricePill() {
  const { quote, change, up } = usePrice();

  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-3 pr-2 lg:inline-flex"
      title="Live FLY quote"
    >
      <span className="flex items-center gap-1.5">
        <span
          className="live-dot size-1.5 rounded-full"
          style={{ background: up ? "var(--accent)" : "var(--danger)" }}
        />
        <span className="tnum text-xs font-semibold">
          ${(quote.priceMicro / 1_000_000).toFixed(4)}
        </span>
      </span>
      <span
        className="tnum text-[0.6875rem] font-medium"
        style={{ color: up ? "var(--accent)" : "var(--danger)" }}
      >
        {change}
      </span>
      <Sparkline values={quote.series.slice(-28)} width={44} height={16} up={up} area={false} />
    </span>
  );
}

function BalancePill() {
  const { user } = useUser();
  const { usd } = usePrice();
  if (!user) {
    return null;
  }

  return (
    <Link
      href="/wallet"
      className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 transition-colors hover:border-[var(--line-strong)] sm:inline-flex"
      title="Open wallet"
    >
      <span className="tnum text-xs font-semibold">{formatFly(user.balance.fly)}</span>
      <span className="text-[0.6875rem] font-medium text-[var(--muted)]">FLY</span>
      <span className="tnum text-[0.6875rem] text-[var(--muted)]">{usd(user.balance.fly)}</span>
    </Link>
  );
}

function AccountMenu() {
  const { user } = useUser();
  const signOut = useSignOut();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) {
    return null;
  }

  const name = memberName(user);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-transparent p-0.5 transition-colors hover:border-[var(--line)] hover:bg-[var(--surface)]"
      >
        <Avatar name={name} hue={user.avatar_hue} size={32} />
      </button>

      {open ? (
        <div
          role="menu"
          className="rise absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3.5">
            <Avatar name={name} hue={user.avatar_hue} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-[var(--muted)]">@{user.handle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-[var(--line)] px-3 py-3">
            <div className="rounded-[var(--radius)] bg-[var(--surface-sunken)] px-3 py-2">
              <p className="eyebrow">FLY</p>
              <p className="tnum mt-0.5 text-sm font-semibold">{formatFly(user.balance.fly)}</p>
            </div>
            <div className="rounded-[var(--radius)] bg-[var(--surface-sunken)] px-3 py-2">
              <p className="eyebrow">USDT</p>
              <p className="tnum mt-0.5 text-sm font-semibold">
                {formatUsdt(user.balance.usdt)}
              </p>
            </div>
          </div>

          <nav className="flex flex-col p-1.5">
            <MenuItem
              href="/account"
              icon={<UserIcon size={17} />}
              label="Account & wallet"
              onClick={() => setOpen(false)}
            />
            <MenuItem
              href="/how-it-works"
              icon={<InfoIcon size={17} />}
              label="How settlement works"
              onClick={() => setOpen(false)}
            />
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOut();
                router.push("/login");
              }}
              className="flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-left text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-60"
            >
              <LogoutIcon size={17} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
    >
      {icon}
      {label}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const bare = pathname === "/login";

  // The sign-in screen is full-bleed and brings its own chrome.
  if (bare) {
    return (
      <>
        {children}
        <ToastStack />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <Link href={user ? "/" : "/login"} className="flex shrink-0 items-center gap-2.5">
            <LogoMark size={34} />
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-[0.9375rem] font-semibold tracking-[-0.02em]">Flynet</span>
              <span className="mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                Tab Split
              </span>
            </span>
          </Link>

          {!bare && user ? (
            <>
              <nav className="ml-2 hidden items-center gap-0.5 md:flex">
                {LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-active={isActive(pathname, link.href, link.exact)}
                    aria-current={isActive(pathname, link.href, link.exact) ? "page" : undefined}
                    className="navlink"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
                <PricePill />
                <BalancePill />
                <Link
                  href="/split"
                  className="btn btn-primary btn-sm !px-3.5"
                  title="Open a table"
                >
                  <PlusIcon size={16} />
                  <span className="hidden sm:inline">Split a bill</span>
                  <span className="sm:hidden">Split</span>
                </Link>
                <AccountMenu />
                <SignOutButton />
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              {loading ? (
                <span className="skeleton h-8 w-24 rounded-full" />
              ) : (
                <Link href="/login" className="btn btn-outline btn-sm">
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-10">
        {children}
      </main>

      {!bare && user ? (
        <nav className="tabbar md:hidden" aria-label="Primary">
          {MOBILE_LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} />
                {link.label}
              </Link>
            );
          })}
          <Link href="/account" data-active={pathname === "/account"}>
            <UserIcon size={20} />
            Account
          </Link>
        </nav>
      ) : null}

      <footer className="border-t border-[var(--line)] py-8 md:pb-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-sm">
              <span className="flex items-center gap-2.5">
                <LogoMark size={28} />
                <span className="text-sm font-semibold tracking-tight">Flynet Tab Split</span>
              </span>
              <p className="mt-3 text-[0.8125rem] leading-6 text-[var(--muted)]">
                Split the check at the table. Every seat pays the venue directly
                in FLY, anchored to a real check-in. Nobody fronts the bill and
                chases the others afterwards.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <FooterColumn
                title="Product"
                links={[
                  { href: "/wallet", label: "Wallet" },
                  { href: "/restaurants", label: "Venues" },
                  { href: "/tables", label: "Tables" },
                  { href: "/activity", label: "Activity" },
                ]}
              />
              <FooterColumn
                title="Learn"
                links={[
                  { href: "/how-it-works", label: "How settlement works" },
                  { href: "/people", label: "Your people" },
                  { href: "/account", label: "Account & sign out" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-5 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Flynet Tab Split</span>
            <span className="flex items-center gap-2">
              <Chip tone="accent" dot>
                Settlements go member → venue
              </Chip>
            </span>
          </div>
        </div>
      </footer>

      <ToastStack />
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="min-w-[9rem]">
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[0.8125rem] text-[var(--ink-soft)] transition-colors hover:text-[var(--accent)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Always-visible sign-out control, shown once somebody is signed in. */
function SignOutButton() {
  const signOut = useSignOut();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.push("/login");
      }}
      className="btn btn-quiet btn-sm hidden !px-2.5 xl:inline-flex"
      title="Sign out"
    >
      <LogoutIcon size={16} />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function AppShell({
  children,
  initialQuote,
  initialUser,
}: {
  children: React.ReactNode;
  initialQuote: PriceQuote;
  initialUser: CurrentUser | null;
}) {
  return (
    <UserProvider initialUser={initialUser}>
      <PriceProvider initial={initialQuote}>
        <ToastProvider>
          <Shell>{children}</Shell>
        </ToastProvider>
      </PriceProvider>
    </UserProvider>
  );
}
