import { mutateJson } from "@/lib/jsonStore";
import type { Tab } from "./types";

/**
 * Tab persistence.
 *
 * One JSON file, serialized writes. The exported surface is the whole
 * contract — replace these functions with a database and nothing else in
 * the app changes.
 */

const FILE = "tabs";

async function all(): Promise<Tab[]> {
  return mutateJson<Tab[]>(FILE, [], (tabs) => tabs);
}

export async function listTabs(): Promise<Tab[]> {
  const tabs = await all();
  return tabs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getTab(id: string): Promise<Tab | null> {
  const tabs = await all();
  return tabs.find((tab) => tab.id === id) ?? null;
}

export async function getTabByCode(code: string): Promise<Tab | null> {
  const wanted = code.trim().toUpperCase();
  const tabs = await all();
  return tabs.find((tab) => tab.join_code === wanted) ?? null;
}

export async function insertTab(tab: Tab): Promise<Tab> {
  await mutateJson<Tab[]>(FILE, [], (tabs) => [...tabs, tab]);
  return tab;
}

/** Read-modify-write under the file queue. Returns null if the tab is gone. */
export async function updateTab(
  id: string,
  mutate: (tab: Tab) => Tab,
): Promise<Tab | null> {
  let updated: Tab | null = null;
  await mutateJson<Tab[]>(FILE, [], (tabs) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) {
      return tabs;
    }
    updated = mutate(tabs[index]);
    tabs[index] = updated;
    return tabs;
  });
  return updated;
}

export async function tabsInvolving(userId: string): Promise<Tab[]> {
  const tabs = await listTabs();
  return tabs.filter(
    (tab) =>
      tab.host_user_id === userId ||
      tab.shares.some((share) => share.user_id === userId),
  );
}

/** Finds the tab and seat a payment intent belongs to. */
export async function findByIntentId(
  intentId: string,
): Promise<{ tab: Tab; share: Tab["shares"][number] } | null> {
  const tabs = await all();
  for (const tab of tabs) {
    const share = tab.shares.find((candidate) => candidate.payment_intent_id === intentId);
    if (share) {
      return { tab, share };
    }
  }
  return null;
}
