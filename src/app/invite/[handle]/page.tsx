import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { Avatar, Card, Chip } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { ArrowRightIcon, CheckIcon, ShieldIcon } from "@/components/icons";
import { formatFly } from "@/money";
import { expireStaleTabs } from "@/tabs/service";
import { memberName } from "@/users/types";
import { InviteActions } from "./InviteActions";
import { listMembers } from "@/users/store";

export const metadata: Metadata = {
  title: "You're invited",
  description: "Join Flynet Tab Split and settle your share at the table.",
};

/**
 * A personal invite.
 *
 * Open to signed-out visitors on purpose: this is the page somebody
 * lands on from a shared link, and the next step is creating an account.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const members = await listMembers();
  const inviter = members.find(
    (member) => member.handle.toLowerCase() === handle.trim().toLowerCase(),
  );
  if (!inviter) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const tabs = await expireStaleTabs();
  const hosted = tabs.filter(
    (tab) => tab.host_user_id === inviter.id && tab.status === "settled",
  );
  const settledCount = hosted.length;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="rise flex flex-col items-center gap-4 pt-6 text-center">
        <LogoMark size={44} />
        <Avatar name={memberName(inviter)} hue={inviter.avatar_hue} size={72} />
        <div>
          <h1 className="display">
            {inviter.first_name} invited you to Flynet Tab Split
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[0.875rem] leading-6 text-[var(--muted)]">
            Split the check at the table and settle your share in FLY. Create an
            account, get a wallet, and you are ready for the next bill.
          </p>
        </div>
      </div>

      <Card className="rise overflow-hidden">
        <ul className="divide-y divide-[var(--line)]">
          {[
            {
              icon: <ShieldIcon size={17} />,
              title: "Your own wallet",
              body: "You pay your own share straight to the venue; nobody fronts cash for you.",
            },
            {
              icon: <CheckIcon size={17} />,
              title: "Settled in seconds",
              body: "One tap confirms your share. The table closes when the last person pays.",
            },
            {
              icon: <ArrowRightIcon size={17} />,
              title: "Invite-only tables",
              body: "You only ever see tables you were picked for or invited to by link.",
            },
          ].map((item) => (
            <li key={item.title} className="row">
              <span
                className="icon-tile size-10"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[0.875rem] font-semibold">{item.title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-5 text-[var(--muted)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="divider flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <Chip tone="accent" dot>
              {settledCount} {settledCount === 1 ? "table" : "tables"} settled
            </Chip>
            <Chip tone="idle" dot>
              Splits in FLY
            </Chip>
          </div>
          <span className="tnum text-[0.75rem] text-[var(--muted)]">
            New wallets open with {formatFly(BigInt(120) * BigInt(10) ** BigInt(18))} FLY
          </span>
        </div>
      </Card>

      <InviteActions
        inviterId={inviter.id}
        inviterName={inviter.first_name}
        invitePath={`/invite/${inviter.handle}`}
        signedIn={Boolean(viewer)}
      />

      <p className="text-center text-[0.75rem] text-[var(--muted)]">
        Invited by {memberName(inviter)} · @{inviter.handle}
      </p>
    </div>
  );
}
