"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Card, CardHead, Chip, EmptyState, Sheet, Spinner } from "@/components/ui";
import {
  ArrowRightIcon,
  CheckIcon,
  LinkIcon,
  PeopleIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
import { useToast, useUser } from "@/components/providers";
import { memberName, type PublicMember } from "@/users/types";

interface SplitWith {
  id: string;
  name: string;
  handle: string | null;
  count: number;
  last: string;
}

/**
 * The people graph: search anybody on FlyTab, keep the ones you split
 * with, and start a table with them in one tap.
 */
export function PeopleBrowser({
  initialConnections,
  splitWith,
}: {
  initialConnections: PublicMember[];
  splitWith: SplitWith[];
}) {
  const { user } = useUser();
  const { push } = useToast();
  const [query, setQuery] = useState("");
  /** Results carry the query they answer, so "still searching" is derived. */
  const [results, setResults] = useState<{ query: string; people: PublicMember[] } | null>(null);
  const [addedHere, setAddedHere] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicMember | null>(null);
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
        // Ignore anything but the latest keystroke's response.
        if (requestId === requestRef.current) {
          setResults({ query: needle, people: data.people });
        }
      } catch {
        // A failed search just leaves the previous results in place.
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [needle]);

  const searching = needle !== "" && results?.query !== needle;

  const added = useMemo(
    () => new Set([...initialConnections.map((member) => member.id), ...addedHere]),
    [initialConnections, addedHere],
  );

  const suggestions = useMemo(() => {
    if (needle === "") {
      return initialConnections.slice(0, 6);
    }
    return results?.query === needle ? results.people : [];
  }, [needle, results, initialConnections]);

  async function addPerson(person: PublicMember) {
    setPending(person.id);
    try {
      const res = await fetch("/api/people/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id, source: "search" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not add that person");
      }
      setAddedHere((current) =>
        current.includes(person.id) ? current : [...current, person.id],
      );
      push({
        title: `${person.first_name} added`,
        description: "They can now be picked onto your tables.",
      });
    } catch (error) {
      push({
        title: "Could not add",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="overflow-hidden">
        <CardHead
          title="Find people"
          hint="Search by name, @handle or email"
          icon={<SearchIcon size={17} />}
        />
        <div className="divider flex flex-col gap-4 px-5 py-5">
          <div className="relative">
            <SearchIcon
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              className="input input-lg pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “amara” or @yuki"
              aria-label="Search people"
            />
          </div>

          {searching ? (
            <div className="flex flex-col gap-2">
              <div className="skeleton h-14 w-full rounded-[var(--radius)]" />
              <div className="skeleton h-14 w-full rounded-[var(--radius)]" />
            </div>
          ) : suggestions.length === 0 ? (
            <EmptyState
              title={query ? "Nobody matches that" : "No people yet"}
              body={
                query
                  ? "Check the spelling, or invite them with a table link — they can create an account in seconds."
                  : "Split a bill with somebody and they land here automatically."
              }
              icon={<PeopleIcon size={20} />}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {suggestions.map((person) => {
                const name = memberName(person);
                const isAdded = added.has(person.id);
                return (
                  <li
                    key={person.id}
                    className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] px-3.5 py-3 transition-colors hover:border-[var(--line-strong)]"
                  >
                    <button
                      type="button"
                      onClick={() => setProfile(person)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar name={name} hue={person.avatar_hue} size={40} />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] font-semibold">{name}</span>
                        <span className="block truncate text-[0.75rem] text-[var(--muted)]">
                          @{person.handle}
                        </span>
                      </span>
                    </button>

                    <Link
                      href={`/split?with=${person.id}`}
                      className="btn btn-outline btn-sm"
                      title={`Split a bill with ${person.first_name}`}
                    >
                      Split
                    </Link>

                    {isAdded ? (
                      <span className="chip chip-accent">
                        <CheckIcon size={13} />
                        Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending === person.id}
                        onClick={() => addPerson(person)}
                        className="btn btn-primary btn-sm"
                      >
                        {pending === person.id ? <Spinner size={14} /> : <PlusIcon size={14} />}
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="overflow-hidden">
          <CardHead
            title="Your people"
            hint={`${initialConnections.length} ${initialConnections.length === 1 ? "person" : "people"} you can pick`}
            icon={<PeopleIcon size={17} />}
          />
          {initialConnections.length === 0 ? (
            <div className="divider">
              <EmptyState
                title="Nobody yet"
                body="Search above, or split a table with somebody and they are added automatically."
                icon={<PeopleIcon size={20} />}
              />
            </div>
          ) : (
            <ul className="divider divide-y divide-[var(--line)]">
              {initialConnections.map((person) => (
                <li key={person.id} className="row row-hover">
                  <Avatar name={memberName(person)} hue={person.avatar_hue} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.875rem] font-medium">
                      {memberName(person)}
                    </p>
                    <p className="truncate text-[0.75rem] text-[var(--muted)]">
                      @{person.handle}
                    </p>
                  </div>
                  <Link href={`/split?with=${person.id}`} className="btn btn-quiet btn-sm">
                    Split
                    <ArrowRightIcon size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHead
            title="Recently split with"
            hint="From tables you have shared"
            icon={<CheckIcon size={17} />}
          />
          {splitWith.length === 0 ? (
            <div className="divider">
              <EmptyState
                title="No shared tables yet"
                body="Once you settle a table with somebody, they show up here with how many bills you have split."
                icon={<PeopleIcon size={20} />}
              />
            </div>
          ) : (
            <ul className="divider divide-y divide-[var(--line)]">
              {splitWith.map((person) => (
                <li key={person.id} className="row">
                  <Avatar name={person.name} hue={(person.count * 71) % 360} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.875rem] font-medium">{person.name}</p>
                    <p className="text-[0.75rem] text-[var(--muted)]">
                      {person.count} shared {person.count === 1 ? "table" : "tables"}
                      {person.handle ? ` · @${person.handle}` : ""}
                    </p>
                  </div>
                  <Link href={`/split?with=${person.id}`} className="btn btn-quiet btn-sm">
                    Again
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHead
            title="Invite somebody"
            hint="Everyone pays from their own wallet"
            icon={<LinkIcon size={17} />}
          />
          <div className="divider flex flex-col gap-3 px-5 py-5">
            <p className="text-[0.8125rem] leading-6 text-[var(--ink-soft)]">
              Two ways in: you pick them by name when you open a table, or you
              send them the table link. Either way they sign in — or create an
              account — before their seat exists, so every payer is real.
            </p>
            {user ? (
              <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[0.75rem] text-[var(--muted)]">
                  /invite/{user.handle}
                </span>
                <Link href={`/invite/${user.handle}`} className="btn btn-outline btn-sm">
                  Open
                </Link>
              </div>
            ) : null}
            <Link href="/split" className="btn btn-primary btn-block">
              Open a table
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </Card>
      </div>

      <Sheet
        open={profile !== null}
        onClose={() => setProfile(null)}
        title={profile ? memberName(profile) : ""}
        hint={profile ? `@${profile.handle}` : undefined}
      >
        {profile ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={memberName(profile)} hue={profile.avatar_hue} size={54} />
              <div className="min-w-0">
                <p className="text-[0.9375rem] font-semibold">{memberName(profile)}</p>
                <p className="text-[0.8125rem] text-[var(--muted)]">@{profile.handle}</p>
                <div className="mt-1.5 flex gap-1.5">
                  {added.has(profile.id) ? (
                    <Chip tone="accent" dot>
                      In your people
                    </Chip>
                  ) : (
                    <Chip tone="idle" dot>
                      Not saved yet
                    </Chip>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[0.8125rem] leading-6 text-[var(--ink-soft)]">
              Balances stay private — you will only ever see what they owe on a
              table you share, and whether their share has settled.
            </p>

            <div className="flex flex-col gap-2">
              <Link
                href={`/split?with=${profile.id}`}
                onClick={() => setProfile(null)}
                className="btn btn-primary btn-block"
              >
                Split a bill with {profile.first_name}
              </Link>
              {!added.has(profile.id) ? (
                <button
                  type="button"
                  disabled={pending === profile.id}
                  onClick={() => addPerson(profile)}
                  className="btn btn-outline btn-block"
                >
                  {pending === profile.id ? <Spinner size={15} /> : <PlusIcon size={15} />}
                  Add to my people
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
