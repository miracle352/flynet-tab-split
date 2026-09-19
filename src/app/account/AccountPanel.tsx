"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyField } from "@/components/ui";
import { LogoutIcon, ShieldIcon } from "@/components/icons";
import { useSignOut, useUser } from "@/components/providers";

export function AccountPanel({ invitePath }: { invitePath: string }) {
  const router = useRouter();
  const { user } = useUser();
  const signOut = useSignOut();
  const [busy, setBusy] = useState(false);

  const inviteUrl =
    typeof window === "undefined" ? invitePath : `${window.location.origin}${invitePath}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="card card-pad flex flex-col gap-3">
        <p className="eyebrow">Your invite link</p>
        <p className="text-[0.8125rem] leading-5 text-[var(--muted)]">
          Share this and people land on your invite page, where they can create an
          account and be added to your people.
        </p>
        <CopyField value={inviteUrl} label="Link" mono={false} />
      </div>

      <div className="card card-pad flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            className="icon-tile size-10 shrink-0"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            <ShieldIcon size={18} />
          </span>
          <div>
            <p className="text-[0.9375rem] font-semibold tracking-tight">Session</p>
            <p className="mt-1 text-[0.8125rem] leading-5 text-[var(--muted)]">
              You are signed in as {user ? `@${user.handle}` : "your account"}. Signing
              out clears this device; your balances, tables and history stay
              exactly where they are.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
            router.push("/login");
          }}
          className="btn btn-danger btn-block"
        >
          <LogoutIcon size={16} />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
