"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { useToast } from "@/components/providers";

/**
 * The two endings of an invite.
 *
 * Somebody already signed in adds the inviter to their people right here.
 * Somebody new is sent to create an account and comes straight back to
 * this page afterwards.
 */
export function InviteActions({
  inviterId,
  inviterName,
  invitePath,
  signedIn,
}: {
  inviterId: string;
  inviterName: string;
  invitePath: string;
  signedIn: boolean;
}) {
  const [state, setState] = useState<"idle" | "working" | "connected" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { push } = useToast();

  const next = `/login?next=${encodeURIComponent(invitePath)}`;

  if (!signedIn) {
    return (
      <div className="rise flex flex-col gap-2.5">
        <Link href={next} className="btn btn-primary btn-block btn-lg">
          Create an account
          <ArrowRightIcon size={17} />
        </Link>
        <Link href={next} className="btn btn-outline btn-block">
          I already have an account
        </Link>
      </div>
    );
  }

  if (state === "connected") {
    return (
      <div className="rise flex flex-col gap-2.5">
        <p className="alert" role="status">
          <CheckIcon size={17} />
          {inviterName} is in your people. You can pick them the next time you open a
          table.
        </p>
        <Link href="/people" className="btn btn-outline btn-block">
          See your people
        </Link>
      </div>
    );
  }

  return (
    <div className="rise flex flex-col gap-2.5">
      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        disabled={state === "working"}
        onClick={() => {
          setState("working");
          setMessage(null);
          startTransition(async () => {
            try {
              const res = await fetch("/api/people/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: inviterId, source: "invite" }),
              });
              const body = (await res.json().catch(() => null)) as { error?: string } | null;
              if (!res.ok) {
                throw new Error(body?.error ?? "Could not add that person");
              }
              setState("connected");
              push({ title: `${inviterName} added to your people` });
            } catch (error) {
              setState("failed");
              setMessage(error instanceof Error ? error.message : "Could not add that person");
            }
          });
        }}
      >
        {state === "working" ? <Spinner size={17} /> : <CheckIcon size={17} />}
        {state === "working" ? "Adding…" : `Add ${inviterName} to my people`}
      </button>
      <Link href="/" className="btn btn-outline btn-block">
        Back to my wallet
      </Link>
      {message ? (
        <p className="alert alert-danger" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
