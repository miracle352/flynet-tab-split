import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File-backed JSON store.
 *
 * There is no database here, and an in-memory Map is not an option: the
 * dev server hands the page bundle and every route handler their own
 * copy of a module, so a Map written by one of them is invisible to the
 * others. A JSON file per collection is the smallest thing every module
 * instance and every browser session agrees on.
 *
 * The exported surface is the whole contract — swap these four
 * functions for a real database and nothing else changes.
 */

const DATA_DIR = path.join(process.cwd(), ".data");

/** One FIFO queue per file so concurrent writes cannot clobber each other. */
const queues = new Map<string, Promise<unknown>>();

function serialize<T>(file: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const run = previous.then(work, work);
  queues.set(
    file,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function pathFor(file: string): string {
  return path.join(DATA_DIR, `${file}.json`);
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(pathFor(file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write-then-rename so a crash mid-write cannot leave a torn file. */
async function atomicWrite(file: string, value: unknown): Promise<void> {
  const target = pathFor(file);
  const temp = `${target}.${process.pid}.tmp`;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, target);
}

export function writeJson<T>(file: string, value: T): Promise<T> {
  return serialize(file, async () => {
    await atomicWrite(file, value);
    return value;
  });
}

/** Read-modify-write, serialized per file. */
export function mutateJson<T>(
  file: string,
  fallback: T,
  update: (current: T) => T | Promise<T>,
): Promise<T> {
  return serialize(file, async () => {
    const current = await readJson<T>(file, fallback);
    const next = await update(current);
    await atomicWrite(file, next);
    return next;
  });
}
