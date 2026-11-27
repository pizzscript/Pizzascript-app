// Client plans: what each client gets (articles, AI budget, modules) and the limits the worker enforces.
// Pure functions, shared by the worker and the admin.

export const MODULES = [
  { id: "research", label: "Idea research", help: "Finds new article ideas every day." },
  { id: "autopick", label: "Auto-pick", help: "Chooses and schedules ideas on its own." },
  { id: "site_health", label: "Site health", help: "Weekly crawl for broken links, missing titles and other problems." },
  { id: "speed", label: "Speed", help: "Weekly PageSpeed and Core Web Vitals checks." },
  { id: "indexing", label: "Indexing", help: "Checks that new pages are indexed by Google." },
  { id: "rankings", label: "Rankings", help: "Daily Search Console positions, clicks and changes." },
  { id: "content_growth", label: "Content growth", help: "Refresh suggestions, orphan pages and internal links." },
  { id: "backlinks", label: "Backlink monitoring", help: "Weekly: who links to the site, what's new and what was lost." },
  { id: "link_building", label: "Link building", help: "Monthly outreach ideas checked against real search results, drafted for a person to send." },
  { id: "competitors", label: "Competitors", help: "Watches competitor sites for new pages and topic gaps." },
  { id: "local", label: "Local SEO", help: "Business profile posts, reviews and listing consistency." },
  { id: "reports", label: "Reports and alerts", help: "Email alerts and the monthly report." },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];
export type ResearchLevel = "off" | "light" | "full";

export interface ClientPlan {
  name: string;
  articlesPerMonth: number;
  /** AI requests a day for this client. 0 = no cap (PizzaScript's own plan). */
  aiRequestsPerDay: number;
  researchLevel: ResearchLevel;
  /** Most pages a site-health crawl reads. */
  crawlPages: number;
  /** Competitors tracked. */
  competitors: number;
  modules: ModuleId[];
}

export const PLAN_PRESETS: Record<"starter" | "growth" | "pro" | "internal", ClientPlan> = {
  starter: { name: "Starter", articlesPerMonth: 4, aiRequestsPerDay: 60, researchLevel: "light", crawlPages: 200, competitors: 0, modules: ["research", "autopick", "site_health", "speed", "reports"] },
  growth: {
    name: "Growth",
    articlesPerMonth: 8,
    aiRequestsPerDay: 120,
    researchLevel: "full",
    crawlPages: 500,
    competitors: 3,
    modules: ["research", "autopick", "site_health", "speed", "indexing", "rankings", "content_growth", "competitors", "reports"],
  },
  pro: { name: "Pro", articlesPerMonth: 16, aiRequestsPerDay: 250, researchLevel: "full", crawlPages: 1500, competitors: 5, modules: MODULES.map((m) => m.id) },
  internal: { name: "Internal", articlesPerMonth: 30, aiRequestsPerDay: 0, researchLevel: "full", crawlPages: 2000, competitors: 5, modules: MODULES.map((m) => m.id) },
};

/** New clients start on Starter (plan decision 4 in the implementation plan). */
export const DEFAULT_CLIENT_PLAN = PLAN_PRESETS.starter;

const MODULE_IDS = new Set<string>(MODULES.map((m) => m.id));
const num = (value: unknown, fallback: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), max) : fallback;
};

/**
 * The effective plan from a workspace's saved plan. PizzaScript always keeps every module and no AI cap unless its saved
 * plan says otherwise; a client gets Starter for anything not saved.
 */
export function planOf(saved: Record<string, unknown> | null | undefined, isDefault: boolean): ClientPlan {
  const base = isDefault ? PLAN_PRESETS.internal : DEFAULT_CLIENT_PLAN;
  const raw = saved ?? {};
  let savedModules = Array.isArray(raw.modules) ? (raw.modules as unknown[]).filter((m): m is ModuleId => typeof m === "string" && MODULE_IDS.has(m)) : null;
  // "backlinks" used to include outreach ideas. Plans saved before the split keep both until the modules are saved again.
  if (savedModules?.includes("backlinks") && !raw.linkBuildingSplit && !savedModules.includes("link_building")) savedModules = [...savedModules, "link_building"];
  // PizzaScript's live plan predates most modules, so its list only ever adds to the full set.
  const modules = isDefault ? base.modules : (savedModules ?? base.modules);
  const level = raw.researchLevel;
  return {
    name: typeof raw.name === "string" && raw.name ? raw.name : base.name,
    articlesPerMonth: num(raw.articlesPerMonth, base.articlesPerMonth, 300),
    aiRequestsPerDay: num(raw.aiRequestsPerDay, base.aiRequestsPerDay, 10_000),
    researchLevel: level === "off" || level === "light" || level === "full" ? level : base.researchLevel,
    crawlPages: num(raw.crawlPages, base.crawlPages, 20_000),
    competitors: num(raw.competitors, base.competitors, 10),
    modules,
  };
}

export const hasModule = (plan: ClientPlan, module: ModuleId) => plan.modules.includes(module);

/** Which module a job's AI requests and work count against. */
export function moduleForJob(type: string): ModuleId | "content" | "platform" {
  if (["discover_ideas", "prune_ideas", "scan_services", "analyze_site", "score_topic"].includes(type)) return "research";
  if (["crawl_site"].includes(type)) return "site_health";
  if (["speed_check"].includes(type)) return "speed";
  if (["inspect_urls"].includes(type)) return "indexing";
  if (["sync_rankings"].includes(type)) return "rankings";
  if (["content_growth"].includes(type)) return "content_growth";
  if (["backlink_scan"].includes(type)) return "backlinks";
  if (["find_opportunities"].includes(type)) return "link_building";
  if (["competitor_scan"].includes(type)) return "competitors";
  if (["local_post", "local_check"].includes(type)) return "local";
  if (["send_alerts", "monthly_report"].includes(type)) return "reports";
  if (["daily_briefing", "quality_gate", "performance_check", "publish_due", "discuss"].includes(type)) return "platform";
  return "content";
}

/** The start of today in IST (UTC ISO), the day the AI budget and the ledger count by. */
export function istDayStart(now = Date.now()) {
  const ist = new Date(now + 5.5 * 3_600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3_600_000);
}

/** First day of this IST month as YYYY-MM-DD. */
export function istMonthStart(now = Date.now()) {
  return new Date(now + 5.5 * 3_600_000).toISOString().slice(0, 8) + "01";
}

/** When a client whose daily budget is spent can try again: the next IST midnight, plus a few minutes. */
export const nextBudgetDay = (now = Date.now()) => new Date(istDayStart(now).getTime() + 86_400_000 + 5 * 60_000);

export const BUDGET_ERROR = "Daily AI budget used";
export const ARTICLE_LIMIT_ERROR = "Monthly article limit reached";
export const isBudgetError = (message: string) => message.includes(BUDGET_ERROR);

export interface UsageRow {
  day: string;
  module: string;
  ai_requests: number;
  articles: number;
  crawl_pages: number;
}

/** Sums ledger rows into a month's totals, per module and overall. */
export function summarizeUsage(rows: UsageRow[]) {
  const byModule: Record<string, { ai: number; articles: number; pages: number }> = {};
  for (const r of rows) {
    const m = (byModule[r.module] ??= { ai: 0, articles: 0, pages: 0 });
    m.ai += r.ai_requests;
    m.articles += r.articles;
    m.pages += r.crawl_pages;
  }
  const total = Object.values(byModule).reduce((t, m) => ({ ai: t.ai + m.ai, articles: t.articles + m.articles, pages: t.pages + m.pages }), { ai: 0, articles: 0, pages: 0 });
  return { byModule, total };
}
