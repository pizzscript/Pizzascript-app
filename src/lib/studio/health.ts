import { MODEL_LIMITS, quotaDayStart, type AgentState, type ModelLimit } from "./models";
import type { AiCall, Studio } from "./server";

export interface HealthRow {
  name: string;
  value: string;
  /** 0–1 share of the free limit used; null when there's no meaningful cap to show. */
  used: number | null;
  note: string;
  connected: boolean;
}

const SUPABASE_FREE_BYTES = 500 * 1024 * 1024;
const GITHUB_FREE_MINUTES = 2000;
const CACHE_MS = 10 * 60_000;

let external: { at: number; bright: HealthRow; github: HealthRow } | null = null;

async function getJson<T>(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function agentStatus(studio: Studio) {
  if (studio.mode !== "live") return "Main writer";
  const { data } = await studio.db.from("settings").select("value").eq("key", "agent_state").maybeSingle();
  const until = (data?.value as AgentState | undefined)?.cooldownUntil;
  if (!until || Date.parse(until) <= Date.now()) return "Main writer · ready";
  return `Paused until ${new Date(Date.parse(until) + 5.5 * 3_600_000).toISOString().slice(11, 16)} IST · backups writing`;
}

function geminiRows(calls: AiCall[], agentNote: string): HealthRow[] {
  const start = quotaDayStart();
  const reset = new Date(start + 86_400_000 + 5.5 * 3_600_000).toISOString().slice(11, 16);
  const groups: { name: string; group: ModelLimit["group"][]; note: string }[] = [
    { name: "Antigravity agent", group: ["agent"], note: `${agentNote} · quota resets ${reset} IST` },
    { name: "Gemini writers", group: ["writer"], note: "3 backup models" },
    { name: "Gemini small jobs", group: ["light"], note: "2 models, Gemma as backup" },
    { name: "Gemini decisions", group: ["decision"], note: "Yes/no checks" },
  ];
  return groups.map(({ name, group, note }) => {
    const models = Object.entries(MODEL_LIMITS).filter(([, l]) => group.includes(l.group));
    const limit = models.reduce((sum, [, l]) => sum + l.rpd, 0);
    const ids = new Set(models.map(([id]) => id));
    // Failed requests count too: Google charges them against the daily limit.
    const count = calls.filter((c) => ids.has(c.model) && Date.parse(c.created_at) >= start).length;
    return { name, value: `${count} / ${limit.toLocaleString("en-IN")} requests`, used: Math.min(1, count / limit), note, connected: true };
  });
}

async function supabaseRow(studio: Studio): Promise<HealthRow> {
  const name = "Supabase database";
  if (studio.mode !== "live") return { name, value: "Preview", used: null, note: "No live database", connected: false };
  const { data, error } = await studio.db.rpc("system_usage");
  if (error) return { name, value: "Unavailable", used: null, note: "Couldn't read size", connected: false };
  const bytes = (data as { db_bytes: number }).db_bytes;
  return { name, value: `${Math.round(bytes / 1024 / 1024)} / 500 MB`, used: Math.min(1, bytes / SUPABASE_FREE_BYTES), note: "Free plan limit", connected: true };
}

async function brightRow(): Promise<HealthRow> {
  const name = "Bright Data";
  const key = process.env.BRIGHT_DATA_API_KEY;
  if (!key) return { name, value: "Not connected", used: null, note: "Add BRIGHT_DATA_API_KEY", connected: false };
  try {
    const d = await getJson<{ included_credits: number; used_credits: number; left_credits: number }>("https://api.brightdata.com/trials/free_tier", { authorization: `Bearer ${key}` });
    return { name, value: `${d.used_credits} / ${d.included_credits} credits`, used: d.included_credits ? d.used_credits / d.included_credits : null, note: "Resets on the 1st", connected: true };
  } catch {
    return { name, value: "Unavailable", used: null, note: "Key needs billing.read", connected: false };
  }
}

async function githubRow(): Promise<HealthRow> {
  const name = "GitHub Actions";
  const repo = process.env.GITHUB_REPO ?? process.env.RENDER_GIT_REPO_SLUG;
  if (!repo) return { name, value: "Not connected", used: null, note: "Add GITHUB_REPO", connected: false };
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "system-health-panel" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const month = `${new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 7)}-01`;
    const [info, runs] = await Promise.all([
      getJson<{ private: boolean }>(`https://api.github.com/repos/${repo}`, headers),
      getJson<{ total_count: number }>(`https://api.github.com/repos/${repo}/actions/runs?per_page=1&created=%3E%3D${month}`, headers),
    ]);
    if (!info.private) return { name, value: `${runs.total_count} runs this month`, used: null, note: "Unlimited (public repo)", connected: true };
    return { name, value: `~${runs.total_count} / ${GITHUB_FREE_MINUTES} min`, used: Math.min(1, runs.total_count / GITHUB_FREE_MINUTES), note: "Estimated at 1 min per run", connected: true };
  } catch {
    return { name, value: "Unavailable", used: null, note: "Couldn't reach GitHub", connected: false };
  }
}

export async function loadHealth(studio: Studio, calls: AiCall[]): Promise<HealthRow[]> {
  if (!external || Date.now() - external.at > CACHE_MS) {
    const [bright, github] = await Promise.all([brightRow(), githubRow()]);
    external = { at: Date.now(), bright, github };
  }
  return [...geminiRows(calls, await agentStatus(studio)), await supabaseRow(studio), external.bright, external.github];
}
