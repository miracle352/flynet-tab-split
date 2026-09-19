import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password storage.
 *
 * scrypt with a per-password salt, kept in the self-describing
 * `scrypt$N$r$p$salt$hash` format so the cost parameters can move later
 * without a migration. Comparison is constant time.
 */

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;

export const MIN_PASSWORD_LENGTH = 8;

function derive(
  password: string,
  salt: string,
  cost = COST,
  blockSize = BLOCK_SIZE,
  parallelism = PARALLELISM,
): string {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelism,
    maxmem: 64 * 1024 * 1024,
  }).toString("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt, derive(password, salt)].join("$");
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) {
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, cost, blockSize, parallelism, salt, expected] = parts;
  const a = Buffer.from(
    derive(password, salt, Number(cost), Number(blockSize), Number(parallelism)),
    "hex",
  );
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Stable pseudo-random hex from a seed — used for wallet addresses. */
export function deterministicHex(seed: string, bytes: number): string {
  let out = "";
  let round = 0;
  while (out.length < bytes * 2) {
    out += createHash("sha256").update(`${seed}:${round}`).digest("hex");
    round += 1;
  }
  return out.slice(0, bytes * 2);
}

/** `0xAbCd…1234` — the way wallets show an address. */
export function shortAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 1) {
    return address;
  }
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
