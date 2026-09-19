import { deterministicHex, hashPassword } from "@/auth/passwords";
import type { Wallet } from "@/types";
import type { Member } from "./types";

/**
 * The starting roster.
 *
 * These are ordinary member accounts with real balances — they show up
 * in people search, can be picked onto a table by a host, and settle
 * their own shares when they sign in. `SEED_PASSWORD` is a repo
 * convenience for exercising the multi-payer flow (see README); it is
 * never rendered anywhere in the product.
 */

export const SEED_PASSWORD = "flytab-table-2026";

const CREATED_AT = "2026-05-11T20:21:07.812609Z";

interface SeedPerson {
  id: string;
  handle: string;
  first_name: string;
  last_name: string;
  email: string;
  fly: string;
  usdt: string;
  hue: number;
}

const PEOPLE: SeedPerson[] = [
  {
    id: "be9caffa-7f30-462a-b7ab-9cca9edb8ab8",
    handle: "miracle",
    first_name: "Miracle",
    last_name: "Iyanuoluwa",
    email: "miracle@flytab.xyz",
    fly: "842500000000000000000",
    usdt: "310250000000000000000",
    hue: 168,
  },
  {
    id: "6e2c4a91-3b7d-4f18-9c0a-1d5e8f2b4a70",
    handle: "amara",
    first_name: "Amara",
    last_name: "Osei",
    email: "amara.osei@flytab.xyz",
    fly: "412800000000000000000",
    usdt: "64000000000000000000",
    hue: 24,
  },
  {
    id: "9c8b7a65-4d3e-4210-8f9a-0b1c2d3e4f50",
    handle: "kwame",
    first_name: "Kwame",
    last_name: "Mensah",
    email: "kwame@flytab.xyz",
    // Deliberately short, so the "fund your wallet" path is reachable.
    fly: "3000000000000000000",
    usdt: "0",
    hue: 268,
  },
  {
    id: "3d7f1b02-9a44-4c1e-8f6b-7c2d5e9a1b30",
    handle: "sofia",
    first_name: "Sofía",
    last_name: "Rossi",
    email: "sofia.rossi@flytab.xyz",
    fly: "196400000000000000000",
    usdt: "488000000000000000000",
    hue: 330,
  },
  {
    id: "5b2e8c47-1f09-4a63-9d18-4e7f0a6b2c95",
    handle: "yuki",
    first_name: "Yuki",
    last_name: "Tanaka",
    email: "yuki.tanaka@flytab.xyz",
    fly: "77100000000000000000",
    usdt: "15500000000000000000",
    hue: 200,
  },
  {
    id: "8a4c6e13-2b75-4d90-b1e4-6f3a8c5d0e71",
    handle: "diego",
    first_name: "Diego",
    last_name: "Marín",
    email: "diego.marin@flytab.xyz",
    fly: "1240000000000000000000",
    usdt: "9250000000000000000",
    hue: 96,
  },
];

function walletsFor(person: SeedPerson): Wallet[] {
  const membership = deterministicHex(`${person.id}:membership`, 20);
  const spending = deterministicHex(`${person.id}:spending`, 20);
  const mixed = (hex: string) =>
    `0x${hex.replace(/./g, (char, index) =>
      index % 3 === 0 ? char.toUpperCase() : char,
    )}`;

  return [
    {
      id: `${person.id.slice(0, 8)}-0000-4000-8000-000000000001`,
      object: "user_wallet",
      wallet_type: "MEMBERSHIP",
      address: mixed(membership),
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
    },
    {
      id: `${person.id.slice(0, 8)}-0000-4000-8000-000000000002`,
      object: "user_wallet",
      wallet_type: "SPENDING",
      address: mixed(spending),
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
    },
  ];
}

export function seedMembers(): Member[] {
  const hash = hashPassword(SEED_PASSWORD);
  const now = new Date().toISOString();

  return PEOPLE.map((person) => ({
    id: person.id,
    object: "user" as const,
    handle: person.handle,
    first_name: person.first_name,
    last_name: person.last_name,
    email: person.email,
    password_hash: hash,
    avatar_hue: person.hue,
    wallets: walletsFor(person),
    balances: { fly: person.fly, usdt: person.usdt },
    connected_wallet: null,
    created_at: CREATED_AT,
    last_seen_at: now,
  }));
}

/** Seed balances for a table that has already settled, in wei. */
export function seededLedgerHints(): { memberId: string; label: string }[] {
  return PEOPLE.slice(0, 4).map((person) => ({
    memberId: person.id,
    label: person.handle,
  }));
}
