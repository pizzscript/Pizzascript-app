import { GoogleAuth } from "google-auth-library";
import { env } from "./env";

export interface GscRow {
  date: string;
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function gscConfigured() {
  return Boolean(env.gscServiceAccount);
}

/** Search Console rows for [startDate, endDate] by date × page × query. Pages are returned as site paths. */
export async function fetchGsc(startDate: string, endDate: string): Promise<GscRow[]> {
  const auth = new GoogleAuth({
    credentials: JSON.parse(env.gscServiceAccount!),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const client = await auth.getClient();
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(env.gscSite)}/searchAnalytics/query`;
  const rows: GscRow[] = [];
  for (let startRow = 0; ; startRow += 5000) {
    const res = await client.request<{ rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }>({
      url,
      method: "POST",
      data: { startDate, endDate, dimensions: ["date", "page", "query"], rowLimit: 5000, startRow },
    });
    const batch = res.data.rows ?? [];
    for (const r of batch) {
      const [date, page, query] = r.keys;
      rows.push({
        date,
        page: page.replace(/^https?:\/\/(www\.)?pizzascript\.com/, "") || "/",
        query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      });
    }
    if (batch.length < 5000) break;
  }
  return rows;
}
