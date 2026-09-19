import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHead, Chip, Note } from "@/components/ui";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  ReceiptIcon,
  ShieldIcon,
  SparkIcon,
  SwapIcon,
  WalletIcon,
} from "@/components/icons";
import { IDLE_WINDOW_MINUTES } from "@/tabs/types";

export const metadata: Metadata = {
  title: "How settlement works",
  description: "How a shared bill becomes settled payments at the venue.",
};

const STEPS = [
  {
    n: "01",
    icon: <ReceiptIcon size={18} />,
    title: "Check in at the venue",
    body: "A check-in is what ties the bill to a real visit. The venue, the room and the moment are recorded against your account before any money moves.",
    detail: "Pick the venue from the Venues tab. One check-in can carry more than one table.",
  },
  {
    n: "02",
    icon: <SparkIcon size={18} />,
    title: "Open a table and split it",
    body: "Enter the subtotal and the tip, then choose how it divides — evenly, or a different amount per seat. Seats are fixed the moment the table opens.",
    detail: "Even splits push the odd remainder onto the first seat, so the shares always add back to the total exactly.",
  },
  {
    n: "03",
    icon: <WalletIcon size={18} />,
    title: "Every seat gets its own request",
    body: "One payment request per person, in FLY, created up front. People you picked see it when they sign in; anybody else arrives through the table link.",
    detail: "Each request is unique and idempotent — reopening the app never double-charges a seat.",
  },
  {
    n: "04",
    icon: <ArrowRightIcon size={18} />,
    title: "Each person pays the venue",
    body: "Settlement goes from a member's wallet to the venue's wallet. Nobody fronts the bill, so there is nothing to chase and no one is out of pocket.",
    detail: "Short on FLY? Fund your wallet with FLY or USDT and swap — the table stays open while you do.",
  },
  {
    n: "05",
    icon: <CheckIcon size={18} />,
    title: "The table settles itself",
    body: "When the last share lands, the table closes, everyone keeps a receipt, and the venue's reward campaigns show up on the settled screen.",
    detail: "The live board updates as shares land — no refreshing, no asking who has paid.",
  },
  {
    n: "06",
    icon: <ClockIcon size={18} />,
    title: "Idle tables close and refund",
    body: `Leave a table untouched for ${IDLE_WINDOW_MINUTES} minutes and it closes on its own. Anything already paid goes straight back to the person who paid it.`,
    detail: "The host can also cancel at any point, which refunds every settled seat the same way.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="rise max-w-3xl">
        <p className="eyebrow">Settlement</p>
        <h1 className="display mt-1.5">How the bill actually settles</h1>
        <p className="mt-3 text-[0.9375rem] leading-7 text-[var(--ink-soft)]">
          Most splitting apps move money between friends afterwards. This settles
          the check <em>with the restaurant</em>, one share per seat, while
          everybody is still sitting at the table. That single change is what
          removes the awkward part — no IOUs, no &ldquo;I&apos;ll send it
          later&rdquo;, no one person covering the table on a card.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="rise overflow-hidden">
          <CardHead title="The flow, end to end" hint="Six moves from check-in to settled" />
          <ol className="divider divide-y divide-[var(--line)]">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4 px-5 py-5">
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="icon-tile size-10"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {step.icon}
                  </span>
                  <span className="tnum text-[0.625rem] font-bold tracking-widest text-[var(--muted)]">
                    {step.n}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight">{step.title}</h2>
                  <p className="mt-1.5 text-[0.875rem] leading-6 text-[var(--ink-soft)]">
                    {step.body}
                  </p>
                  <p className="mt-2 text-[0.8125rem] leading-5 text-[var(--muted)]">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="rise overflow-hidden">
            <CardHead
              title="Why money only moves one way"
              icon={<ShieldIcon size={17} />}
            />
            <div className="divider flex flex-col gap-3 px-5 py-5">
              <p className="text-[0.875rem] leading-6 text-[var(--ink-soft)]">
                A settlement moves FLY from a member&apos;s wallet to a{" "}
                <strong className="font-semibold text-[var(--ink)]">venue&apos;s</strong>{" "}
                wallet. There is no member-to-member transfer, which sounds
                limiting until you notice what it removes: nobody has to trust
                anybody else to send money back, because nobody ever does.
              </p>
              <div className="flex items-center justify-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] px-4 py-4">
                <span className="chip chip-accent">You</span>
                <ArrowRightIcon size={18} className="text-[var(--muted)]" />
                <span className="chip chip-idle">Your share</span>
                <ArrowRightIcon size={18} className="text-[var(--muted)]" />
                <span className="chip chip-accent">Venue</span>
              </div>
              <Note tone="accent">
                If you paid by card at the table instead, settle your share in FLY
                here anyway — the venue sees the whole check covered, and the
                person who fronted the card is not left waiting on four transfers.
              </Note>
            </div>
          </Card>

          <Card className="rise overflow-hidden">
            <CardHead title="Getting the FLY" icon={<SwapIcon size={17} />} />
            <div className="divider flex flex-col gap-3 px-5 py-5">
              <ul className="flex flex-col gap-2.5 text-[0.875rem] leading-6 text-[var(--ink-soft)]">
                <li className="flex gap-2.5">
                  <CheckIcon size={16} className="mt-1 shrink-0 text-[var(--accent)]" />
                  <span>
                    <strong className="font-semibold text-[var(--ink)]">Deposit FLY</strong>{" "}
                    to your own deposit address from an exchange or another wallet.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <CheckIcon size={16} className="mt-1 shrink-0 text-[var(--accent)]" />
                  <span>
                    <strong className="font-semibold text-[var(--ink)]">Deposit USDT</strong>{" "}
                    and swap it into FLY at the live rate, fee shown before you
                    confirm.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <CheckIcon size={16} className="mt-1 shrink-0 text-[var(--accent)]" />
                  <span>
                    <strong className="font-semibold text-[var(--ink)]">Connect a wallet</strong>{" "}
                    you already use, or create a self-custody one and keep the
                    recovery key yourself.
                  </span>
                </li>
              </ul>
              <Link href="/wallet" className="btn btn-primary btn-block mt-1">
                Open your wallet
                <ArrowRightIcon size={16} />
              </Link>
            </div>
          </Card>

          <Card className="rise overflow-hidden">
            <CardHead title="The price you see" icon={<SparkIcon size={17} />} />
            <div className="divider flex flex-col gap-3 px-5 py-5">
              <p className="text-[0.875rem] leading-6 text-[var(--ink-soft)]">
                One quote drives every dollar figure in the app. It refreshes
                every few seconds, so a balance, a share and a swap are always
                priced against the same number — never two rates that disagree.
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip tone="accent" dot>
                  Live quote
                </Chip>
                <Chip tone="idle" dot>
                  Amounts stay exact
                </Chip>
              </div>
              <p className="text-[0.8125rem] leading-5 text-[var(--muted)]">
                Splits are calculated in whole units, not floating point, so the
                shares always sum back to the total to the last decimal.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="rise flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-5 py-5">
        <div>
          <h2 className="title">Ready to split one?</h2>
          <p className="mt-1 text-[0.8125rem] text-[var(--muted)]">
            Check in, enter the bill, and send the invites.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/restaurants" className="btn btn-outline">
            Find a venue
          </Link>
          <Link href="/split" className="btn btn-primary">
            Open a table
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
