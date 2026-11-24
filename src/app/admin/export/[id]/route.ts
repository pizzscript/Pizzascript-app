import { requireAdmin, supabaseServer } from "@/lib/studio/server";

/** Everything a client owns, as one JSON file (before offboarding or for the client's records). Keys are never included. */
const TABLES = ["posts", "post_versions", "topics", "clusters", "batches", "facts", "link_plan", "signals", "briefings", "settings", "agent_messages", "jobs", "ai_calls", "gsc_daily", "page_stats", "usage_ledger"];
// Later modules' tables; missing ones are skipped, so export works before those phases are applied.
const MODULE_TABLES = ["crawl_pages", "crawl_issues", "metrics_daily", "url_inspections", "rank_changes", "backlinks", "link_opportunities", "competitors", "competitor_pages", "alerts", "reports", "local_posts", "citations", "approvals"];

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const studio = await requireAdmin();
  if (studio.mode === "preview") return new Response("Preview mode", { status: 400 });
  const workspace = studio.workspaces.find((w) => w.id === id);
  if (!workspace) return new Response("Unknown client", { status: 404 });
  const db = await supabaseServer();
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), workspace };
  for (const table of [...TABLES, ...MODULE_TABLES]) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select("*").eq("workspace_id", id).range(from, from + 999);
      if (error) {
        if (!MODULE_TABLES.includes(table)) rows.push({ error: error.message });
        break;
      }
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    if (rows.length || TABLES.includes(table)) out[table] = rows;
  }
  // Settings may hold a saved profile but never keys; strip anything that looks like one anyway.
  const body = JSON.stringify(out, (key, value) => (/(api_?key|secret|password|token)$/i.test(key) && typeof value === "string" ? "[removed]" : value), 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${workspace.slug}-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
