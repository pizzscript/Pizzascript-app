import { AsyncLocalStorage } from "node:async_hooks";
import { BUDGET_ERROR, istMonthStart, type ModuleId } from "../src/lib/studio/plans";
import { db, todayIst } from "./db";
import { currentPlan } from "./profile";
import { currentWorkspace } from "./workspace";

/** The module the current job's work counts against (set by the runner from the job type). */
const moduleStore = new AsyncLocalStorage<string>();
export const currentModule = () => moduleStore.getStore() ?? "platform";
export const inModule = <T>(module: ModuleId | "content" | "platform", work: () => Promise<T>) => moduleStore.run(module, work);

/** Today's AI requests per client, read once from the ledger and then counted in memory. */
const aiToday = new Map<string, number>();
const dayKey = () => `${currentWorkspace()}:${todayIst()}`;

async function aiUsedToday() {
  const key = dayKey();
  const known = aiToday.get(key);
  if (known !== undefined) return known;
  const { data } = await db.from("usage_ledger").select("ai_requests").eq("day", todayIst());
  const used = ((data ?? []) as { ai_requests: number }[]).reduce((sum, row) => sum + (row.ai_requests ?? 0), 0);
  aiToday.set(key, used);
  return used;
}

/** Only the offline test harness resets the in-memory counters. */
export function resetUsageCounters() {
  aiToday.clear();
}

/** Throws when this client's daily AI budget is spent, so its job waits for tomorrow while other clients carry on. */
export async function assertAiBudget() {
  const limit = currentPlan().aiRequestsPerDay;
  if (!limit) return;
  const used = await aiUsedToday();
  if (used >= limit) throw new Error(`${BUDGET_ERROR} (${used} of ${limit}) for this client. It continues tomorrow.`);
}

export async function aiBudgetLeft() {
  const limit = currentPlan().aiRequestsPerDay;
  return limit ? Math.max(0, limit - (await aiUsedToday())) : Infinity;
}

/** Adds to the client's usage ledger. Never fails the job. */
export function addUsage(change: { ai?: number; articles?: number; pages?: number }) {
  if (change.ai) aiToday.set(dayKey(), (aiToday.get(dayKey()) ?? 0) + change.ai);
  return db
    .rpc("add_usage", { ws: currentWorkspace(), d: todayIst(), mod: currentModule(), ai: change.ai ?? 0, art: change.articles ?? 0, pages: change.pages ?? 0 })
    .then(({ error }) => {
      if (error) console.warn(`[usage] ${error.message}`);
    });
}

/** Articles drafted for this client since the 1st of this month (IST). */
export async function articlesThisMonth() {
  const { data } = await db.from("usage_ledger").select("articles").gte("day", istMonthStart());
  return ((data ?? []) as { articles: number }[]).reduce((sum, row) => sum + (row.articles ?? 0), 0);
}
