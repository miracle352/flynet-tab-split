import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Tab } from "./types";

/**
 * Demo-only tab persistence.
 *
 * This project has no database, and an in-memory Map is not viable:
 * Turbopack hands the page bundle and each route handler its own copy
 * of a module, so a Map written by one route is invisible to another.
 * A single JSON file is the smallest store that every module instance
 * and every browser session can see.
 *
 * Swap this file for a real database later — the exported surface is
 * the whole contract.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const TABS_FILE = path.join(DATA_DIR, "tabs.json");

/** Serializes writes so two concurrent joins cannot clobber each other. */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(() => work());
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readAll(): Promise<Tab[]> {
  try {
    const raw = await readFile(TABS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Tab[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(tabs: Tab[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TABS_FILE, `${JSON.stringify(tabs, null, 2)}\n`, "utf8");
}

export async function listTabs(): Promise<Tab[]> {
  const tabs = await readAll();
  return tabs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getTab(id: string): Promise<Tab | null> {
  const tabs = await readAll();
  return tabs.find((tab) => tab.id === id) ?? null;
}

export async function getTabByCode(code: string): Promise<Tab | null> {
  const wanted = code.trim().toUpperCase();
  const tabs = await readAll();
  return tabs.find((tab) => tab.join_code === wanted) ?? null;
}

export function insertTab(tab: Tab): Promise<Tab> {
  return serialize(async () => {
    const tabs = await readAll();
    tabs.push(tab);
    await writeAll(tabs);
    return tab;
  });
}

/** Read-modify-write under the queue. Returns null if the tab is gone. */
export function updateTab(
  id: string,
  mutate: (tab: Tab) => Tab,
): Promise<Tab | null> {
  return serialize(async () => {
    const tabs = await readAll();
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) {
      return null;
    }
    const updated = mutate(tabs[index]);
    tabs[index] = updated;
    await writeAll(tabs);
    return updated;
  });
}

export async function tabsInvolving(userId: string): Promise<Tab[]> {
  const tabs = await listTabs();
  return tabs.filter(
    (tab) =>
      tab.host_user_id === userId ||
      tab.shares.some((share) => share.user_id === userId),
  );
}
