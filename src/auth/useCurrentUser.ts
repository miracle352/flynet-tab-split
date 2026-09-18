"use client";

import { useCallback, useEffect, useState } from "react";
import type { CurrentUser } from "./types";

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch("/api/me");
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { user: CurrentUser | null };
  return data.user ?? null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/me", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          return { user: null };
        }
        return res.json() as Promise<{ user: CurrentUser | null }>;
      })
      .then((data) => {
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setUser(null);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchCurrentUser();
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, loading, refresh, logout };
}
