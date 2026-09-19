"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { formatUsdFromFly, formatPercent, type PriceQuote } from "@/price/fly";
import type { CurrentUser } from "@/auth/types";

/**
 * App-wide client state.
 *
 * Three small contexts, one provider tree: who is signed in, what FLY
 * is worth right now, and a toast stack. Keeping them together means a
 * deposit on the wallet screen updates the header balance, the price on
 * the home screen and the toast in the same commit.
 */

// --- Signed-in member ---

interface UserApi {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<CurrentUser | null>;
  /** Applies a server response without another round trip. */
  apply: (user: CurrentUser | null) => void;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserApi | null>(null);

async function fetchMe(): Promise<CurrentUser | null> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { user: CurrentUser | null };
  return data.user ?? null;
}

/**
 * Holds the signed-in member for the whole app.
 *
 * `initialUser` comes from the server render, so the first paint already
 * shows balances and names instead of skeletons. The fetch below still
 * runs once, to pick up anything that moved since the page was built.
 */
export function UserProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: CurrentUser | null;
}) {
  const [user, setUser] = useState<CurrentUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    if (initialUser) {
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((next) => {
        if (!cancelled) {
          setUser(next);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialUser]);

  const refresh = useCallback(async () => {
    const next = await fetchMe();
    setUser(next);
    return next;
  }, []);

  const apply = useCallback((next: CurrentUser | null) => {
    setUser(next);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, apply, signOut }),
    [user, loading, refresh, apply, signOut],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserApi {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used inside UserProvider");
  }
  return context;
}

// --- Live price ---

const PRICE_POLL_MS = 5_000;

interface PriceApi {
  quote: PriceQuote;
  /** Microdollars per FLY. */
  priceMicro: number;
  /** FLY (wei) → formatted USD at the current quote. */
  usd: (flyWei: string | bigint) => string;
  /** USD → formatted USD, for USDT amounts. */
  dollars: (amountWei: string | bigint) => string;
  change: string;
  up: boolean;
  updatedAt: number;
}

const PriceContext = createContext<PriceApi | null>(null);

export function PriceProvider({
  initial,
  children,
}: {
  initial: PriceQuote;
  children: ReactNode;
}) {
  const [quote, setQuote] = useState<PriceQuote>(initial);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stopped = false;

    async function tick() {
      if (stopped) {
        return;
      }
      try {
        if (typeof document === "undefined" || document.visibilityState === "visible") {
          const res = await fetch("/api/price", { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { quote: PriceQuote };
            setQuote(data.quote);
            setUpdatedAt(Date.now());
          }
        }
      } catch {
        // A missed tick is invisible; the next one catches up.
      }
      if (!stopped) {
        timer.current = setTimeout(tick, PRICE_POLL_MS);
      }
    }

    timer.current = setTimeout(tick, PRICE_POLL_MS);
    return () => {
      stopped = true;
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const value = useMemo<PriceApi>(() => {
    const priceMicro = quote.priceMicro;
    return {
      quote,
      priceMicro,
      usd: (flyWei) => formatUsdFromFly(flyWei, priceMicro),
      dollars: (amountWei) =>
        formatUsdFromFly(amountWei, 1_000_000),
      change: formatPercent(quote.change24hPct),
      up: quote.change24hPct >= 0,
      updatedAt,
    };
  }, [quote, updatedAt]);

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
}

export function usePrice(): PriceApi {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error("usePrice must be used inside PriceProvider");
  }
  return context;
}

// --- Toasts ---

export type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastApi {
  toasts: Toast[];
  push: (toast: { title: string; description?: string; tone?: ToastTone }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<ToastApi["push"]>(
    ({ title, description, tone = "success" }) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-2), { id, title, description, tone }]);
      setTimeout(() => dismiss(id), 4_500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

export function ToastStack() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className="toast w-full text-left"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 size-2 shrink-0 rounded-full"
            style={{
              background:
                toast.tone === "error"
                  ? "var(--danger)"
                  : toast.tone === "info"
                    ? "var(--info)"
                    : "var(--accent)",
            }}
          />
          <span className="min-w-0">
            <span className="block text-[0.8125rem] font-medium">{toast.title}</span>
            {toast.description ? (
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {toast.description}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Signs out and returns to the sign-in screen. Shared by the shell and /account. */
export function useSignOut() {
  const router = useRouter();
  const { signOut } = useUser();

  return useCallback(async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  }, [router, signOut]);
}
