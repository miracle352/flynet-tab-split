"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Card, CardHead, Chip, Note, Spinner } from "@/components/ui";
import {
  ArrowRightIcon,
  CheckIcon,
  PeopleIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";
import { usePrice, useToast } from "@/components/providers";
import {
  applyTipPercent,
  formatDecimal,
  formatFly,
  parseDecimalToWei,
  parseFlyToWei,
  sumFlyWei,
} from "@/money";
import { flyWeiFromUsdMicro } from "@/price/fly";
import { splitBill } from "@/splitBill";
import type { SplitMode } from "@/tabs/types";
import { memberName, type PublicMember } from "@/users/types";

const TIP_PRESETS = [15, 18, 20, 22];

export function SplitForm({
  venueLabel,
  venueNeighborhood,
  hostId,
  preselected,
}: {
  venueLabel: string;
  venueNeighborhood?: string;
  timeZone?: string;
  hostId: string;
  preselected: PublicMember[];
}) {
  const router = useRouter();
  const { priceMicro, usd } = usePrice();
  const { push } = useToast();

  const [enteredIn, setEnteredIn] = useState<"FLY" | "USD">("FLY");
  const [rawSubtotal, setRawSubtotal] = useState("");
  const [tipPercent, setTipPercent] = useState(20);
  const [splitMode, setSplitMode] = useState<SplitMode>("even");
  const [selected, setSelected] = useState<PublicMember[]>(preselected);
  const [openSeats, setOpenSeats] = useState(1);
  /** Per-seat overrides for a custom split; anything unset uses the even share. */
  const [amountOverrides, setAmountOverrides] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  /** Results carry the query they answer, so "still searching" is derived. */
  const [results, setResults] = useState<{ query: string; people: PublicMember[] } | null>(null);
  const requestRef = useRef(0);

  const needle = query.trim();

  useEffect(() => {
    if (!needle) {
      return;
    }
    const requestId = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/people/search?q=${encodeURIComponent(needle)}`);
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { people: PublicMember[] };
        if (requestId === requestRef.current) {
          setResults({
            query: needle,
            people: data.people.filter((person) => person.id !== hostId),
          });
        }
      } catch {
        // A failed search just leaves the previous results in place.
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [needle, hostId]);

  const searching = needle !== "" && results?.query !== needle;
  const searchResults = needle !== "" && results?.query === needle ? results.people : [];

  /** Bill subtotal in FLY wei, whatever currency it was typed in. */
  const subtotalWei = useMemo(() => {
    try {
      if (enteredIn === "FLY") {
        const value = parseFlyToWei(rawSubtotal);
        return value > BigInt(0) ? value : null;
      }
      const usdMicro = parseDecimalToWei(rawSubtotal) / BigInt(10) ** BigInt(12);
      const value = flyWeiFromUsdMicro(usdMicro, priceMicro);
      return value > BigInt(0) ? value : null;
    } catch {
      return null;
    }
  }, [rawSubtotal, enteredIn, priceMicro]);

  const totalWei = useMemo(
    () => (subtotalWei ? applyTipPercent(subtotalWei, tipPercent) : null),
    [subtotalWei, tipPercent],
  );

  const seatCount = selected.length + 1 + openSeats;

  const evenShares = useMemo(() => {
    if (!totalWei || seatCount < 1) {
      return null;
    }
    try {
      return splitBill(totalWei.toString(), seatCount).map(BigInt);
    } catch {
      return null;
    }
  }, [totalWei, seatCount]);

  /** One row per seat, prefilled from the even split until edited. */
  const amounts = useMemo(
    () =>
      Array.from({ length: seatCount }, (_, index) => {
        const override = amountOverrides[index];
        if (override !== undefined) {
          return override;
        }
        return formatFly(evenShares?.[index] ?? BigInt(0));
      }),
    [seatCount, amountOverrides, evenShares],
  );

  function addPerson(person: PublicMember) {
    setSelected((current) =>
      current.some((member) => member.id === person.id) ? current : [...current, person],
    );
    setQuery("");
    setResults(null);
    if (splitMode === "custom") {
      setSplitMode("even");
    }
  }

  function removePerson(id: string) {
    setSelected((current) => current.filter((member) => member.id !== id));
    if (splitMode === "custom") {
      setSplitMode("even");
    }
  }

  const customTotal = useMemo(() => {
    if (splitMode !== "custom" || amounts.length === 0) {
      return null;
    }
    try {
      return sumFlyWei(amounts.map((amount) => parseFlyToWei(amount)));
    } catch {
      return null;
    }
  }, [splitMode, amounts]);

  const customBalanced =
    totalWei !== null &&
    customTotal !== null &&
    customTotal === totalWei &&
    amounts.length === seatCount;

  const ready =
    subtotalWei !== null &&
    totalWei !== null &&
    seatCount >= 1 &&
    (splitMode === "even" || customBalanced);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal: subtotalWei?.toString() ?? "",
          tipPercent,
          splitMode,
          participantIds: [hostId, ...selected.map((person) => person.id)],
          openSeats,
          amounts: splitMode === "custom" ? amounts : undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        tab?: { id: string };
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not open the table");
      }
      push({
        title: "Table opened",
        description: "Payment requests are on their way to each seat.",
      });
      router.push(`/tabs/${body?.tab?.id ?? ""}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the table");
      setPending(false);
    }
  }

  const subtotalDisplay = subtotalWei
    ? enteredIn === "FLY"
      ? `${formatDecimal(subtotalWei, 2)} FLY`
      : usd(subtotalWei)
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* The bill */}
      <Card className="rise overflow-hidden">
        <CardHead
          title="The bill"
          hint={venueNeighborhood ? `${venueLabel} · ${venueNeighborhood}` : venueLabel}
          icon={<PlusIcon size={17} />}
          action={
            <div className="segmented" role="tablist" aria-label="Currency to enter">
              {(["FLY", "USD"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={enteredIn === option}
                  onClick={() => {
                    setEnteredIn(option);
                    setRawSubtotal("");
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          }
        />
        <div className="divider flex flex-col gap-5 px-5 py-5">
          <label className="flex flex-col gap-2">
            <span className="field-label">
              Subtotal before tip, in {enteredIn}
            </span>
            <div className="relative">
              <input
                className="input input-lg tnum pr-16"
                inputMode="decimal"
                value={rawSubtotal}
                onChange={(event) => setRawSubtotal(event.target.value)}
                placeholder={enteredIn === "FLY" ? "186.40" : "142.00"}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted)]">
                {enteredIn}
              </span>
            </div>
            {subtotalWei ? (
              <span className="field-hint">
                {enteredIn === "FLY" ? usd(subtotalWei) : `${formatDecimal(subtotalWei, 4)} FLY`}{" "}
                at the live quote · {subtotalDisplay}
              </span>
            ) : (
              <span className="field-hint">
                Enter the total from the check, before tip.
              </span>
            )}
          </label>

          <div className="flex flex-col gap-2">
            <span className="field-label">Tip</span>
            <div className="flex flex-wrap items-center gap-2">
              {TIP_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTipPercent(preset)}
                  className={`btn btn-sm ${tipPercent === preset ? "btn-ink" : "btn-outline"}`}
                >
                  {preset}%
                </button>
              ))}
              <div className="relative w-24">
                <input
                  className="input tnum pr-6 text-center"
                  inputMode="decimal"
                  value={tipPercent}
                  onChange={(event) => setTipPercent(Number(event.target.value) || 0)}
                  aria-label="Custom tip percent"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* The people */}
      <Card className="rise overflow-hidden">
        <CardHead
          title="Who is splitting it?"
          hint={`${seatCount} ${seatCount === 1 ? "seat" : "seats"} (you, plus the people you pick)`}
          icon={<PeopleIcon size={17} />}
        />
        <div className="divider flex flex-col gap-4 px-5 py-5">
          <div className="relative">
            <SearchIcon
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              className="input pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, @handle or email"
              aria-label="Search people to add to the table"
            />
            {searching ? (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <Spinner size={15} />
              </span>
            ) : null}
          </div>

          {searchResults.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {searchResults.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => addPerson(person)}
                    className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] px-3 py-2.5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  >
                    <Avatar name={memberName(person)} hue={person.avatar_hue} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-medium">
                        {memberName(person)}
                      </span>
                      <span className="block truncate text-[0.75rem] text-[var(--muted)]">
                        @{person.handle}
                      </span>
                    </span>
                    <PlusIcon size={16} className="text-[var(--muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {needle !== "" && !searching && searchResults.length === 0 ? (
            <p className="rounded-[var(--radius)] border border-dashed border-[var(--line-strong)] px-4 py-3 text-[0.8125rem] text-[var(--muted)]">
              Nobody matches that yet. Open the table anyway and leave an open
              seat. They can join with the link and create an account in seconds.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="field-label">At this table</span>
            <ul className="flex flex-col gap-1.5">
              <li className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2.5">
                <Avatar name="You" hue={168} size={34} />
                <span className="min-w-0 flex-1 text-[0.875rem] font-medium">You (host)</span>
                <Chip tone="accent">Seat 1</Chip>
              </li>
              {selected.map((person, index) => (
                <li
                  key={person.id}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] px-3 py-2.5"
                >
                  <Avatar name={memberName(person)} hue={person.avatar_hue} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-medium">
                      {memberName(person)}
                    </span>
                    <span className="block truncate text-[0.75rem] text-[var(--muted)]">
                      @{person.handle}
                    </span>
                  </span>
                  <Chip tone="idle">Seat {index + 2}</Chip>
                  <button
                    type="button"
                    onClick={() => removePerson(person.id)}
                    className="btn btn-quiet btn-sm !px-2"
                    aria-label={`Remove ${memberName(person)}`}
                  >
                    <XIcon size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--line)] px-4 py-3">
            <div>
              <p className="text-[0.875rem] font-medium">Open seats for the invite link</p>
              <p className="mt-0.5 text-[0.75rem] text-[var(--muted)]">
                Anyone with the link signs in and claims one of these.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenSeats((value) => Math.max(0, value - 1))}
                className="btn btn-outline btn-sm !px-3"
                aria-label="Fewer open seats"
              >
                −
              </button>
              <span className="tnum w-8 text-center text-sm font-semibold">{openSeats}</span>
              <button
                type="button"
                onClick={() => setOpenSeats((value) => Math.min(10, value + 1))}
                className="btn btn-outline btn-sm !px-3"
                aria-label="More open seats"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* The split */}
      <Card className="rise overflow-hidden">
        <CardHead
          title="How it divides"
          icon={<CheckIcon size={17} />}
          action={
            <div className="segmented" role="tablist" aria-label="Split mode">
              <button
                type="button"
                role="tab"
                aria-selected={splitMode === "even"}
                onClick={() => setSplitMode("even")}
              >
                Evenly
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={splitMode === "custom"}
                onClick={() => setSplitMode("custom")}
              >
                Custom
              </button>
            </div>
          }
        />
        <div className="divider flex flex-col gap-4 px-5 py-5">
          {splitMode === "custom" ? (
            <div className="flex flex-col gap-2">
              {amounts.map((amount, index) => (
                <label key={index} className="flex items-center justify-between gap-4">
                  <span className="text-[0.8125rem] text-[var(--muted)]">Seat {index + 1}</span>
                  <div className="relative w-40">
                    <input
                      className="input tnum pr-12"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) =>
                        setAmountOverrides((current) => ({
                          ...current,
                          [index]: event.target.value,
                        }))
                      }
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]">
                      FLY
                    </span>
                  </div>
                </label>
              ))}
              {customTotal !== null && totalWei ? (
                <span
                  className="text-[0.75rem]"
                  style={{
                    color: customBalanced ? "var(--accent)" : "var(--pending)",
                  }}
                >
                  {customBalanced
                    ? "Balanced: the shares add up to the total exactly."
                    : `${formatFly(totalWei - customTotal)} FLY left to assign`}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-[0.8125rem] leading-5 text-[var(--muted)]">
              Evenly across all {seatCount} seats. If it does not divide exactly,
              the remainder goes on the first seat so nothing is lost.
            </p>
          )}

          {totalWei && evenShares ? (
            <dl className="flex flex-col gap-1.5 rounded-[var(--radius)] bg-[var(--surface-sunken)] px-4 py-3.5 text-[0.875rem]">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Subtotal</dt>
                <dd className="tnum font-medium">
                  {formatDecimal(totalWei && subtotalWei ? subtotalWei : BigInt(0), 2)} FLY
                  <span className="ml-2 text-[0.75rem] text-[var(--muted)]">
                    {usd(subtotalWei ?? BigInt(0))}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Tip ({tipPercent}%)</dt>
                <dd className="tnum font-medium">
                  {formatDecimal(totalWei - (subtotalWei ?? totalWei), 2)} FLY
                </dd>
              </div>
              <div className="hairline mt-1 flex justify-between pt-2 text-[0.9375rem] font-semibold">
                <dt>Total</dt>
                <dd className="tnum">
                  {formatDecimal(totalWei, 2)} FLY
                  <span className="ml-2 text-[0.75rem] font-normal text-[var(--muted)]">
                    {usd(totalWei)}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between text-[var(--ink-soft)]">
                <dt>Each of {seatCount}</dt>
                <dd className="tnum">
                  {formatDecimal(evenShares[0], 4)} FLY
                  <span className="ml-2 text-[0.75rem] text-[var(--muted)]">
                    {usd(evenShares[0])}
                  </span>
                </dd>
              </div>
            </dl>
          ) : null}

          <Note>
            Each seat pays the venue directly in FLY. If somebody is short, they
            can <Link href="/wallet" className="link">fund their wallet</Link> (with
            FLY, or with USDT swapped at the live rate) while the table
            stays open.
          </Note>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending || !ready}
        onClick={submit}
        className="btn btn-primary btn-block btn-lg"
      >
        {pending ? <Spinner size={17} /> : null}
        {pending
          ? "Opening the table…"
          : `Request ${seatCount} ${seatCount === 1 ? "payment" : "payments"}`}
        {!pending ? <ArrowRightIcon size={17} /> : null}
      </button>
      <p className="text-center text-[0.75rem] text-[var(--muted)]">
        Nobody is charged until they confirm their own share.
      </p>
    </div>
  );
}
