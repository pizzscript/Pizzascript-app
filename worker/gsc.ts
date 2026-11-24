import { GoogleAuth } from "google-auth-library";
import { conn } from "./connections";
import { currentProfile } from "./profile";

export interface GscRow {
  date: string;
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** The current client's Search Console property. A client never falls back to PizzaScript's. */
const property = () => conn("gscSite");

export function gscConfigured() {
  return Boolean(conn("gscServiceAccount") && property());
}

async function client(scope = "https://www.googleapis.com/auth/webmasters.readonly") {
  const auth = new GoogleAuth({ credentials: JSON.parse(conn("gscServiceAccount")!), scopes: [scope] });
  return auth.getClient();
}

/** The property's host, e.g. "pizzascript.com" for sc-domain:pizzascript.com. */
export function propertyHost(site = property() ?? "") {
  if (site.startsWith("sc-domain:")) return site.slice("sc-domain:".length);
  try {
    return new URL(site).hostname.replace(/^www\./, "");
  } catch {
    return new URL(currentProfile().origin).hostname.replace(/^www\./, "");
  }
}

/** A full URL from Search Console as a site path. */
export function toPath(page: string) {
  const host = propertyHost().replace(/\./g, "\\.");
  return page.replace(new RegExp(`^https?://([a-z0-9-]+\\.)*${host}`, "i"), "") || "/";
}

/** Search Console rows for [startDate, endDate] by date × page × query. Pages are returned as site paths. */
export async function fetchGsc(startDate: string, endDate: string, dimensions: ("date" | "page" | "query")[] = ["date", "page", "query"]): Promise<GscRow[]> {
  const api = await client();
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property()!)}/searchAnalytics/query`;
  const rows: GscRow[] = [];
  for (let startRow = 0; ; startRow += 5000) {
    const res = await api.request<{ rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }>({
      url,
      method: "POST",
      data: { startDate, endDate, dimensions, rowLimit: 5000, startRow },
    });
    const batch = res.data.rows ?? [];
    for (const r of batch) {
      const value = (d: string) => r.keys[dimensions.indexOf(d as never)] ?? "";
      rows.push({
        date: value("date"),
        page: dimensions.includes("page") ? toPath(value("page")) : "",
        query: value("query"),
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      });
    }
    if (batch.length < 5000 || startRow >= 45_000) break;
  }
  return rows;
}

export interface Inspection {
  verdict: string;
  coverage: string;
  indexed: boolean;
  lastCrawl: string | null;
  canonical: string | null;
}

/** URL Inspection: whether Google has indexed a page, and if not, why. About 2,000 a day per property. */
export async function inspectUrl(pageUrl: string): Promise<Inspection> {
  const api = await client();
  const res = await api.request<{ inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string; googleCanonical?: string } } }>({
    url: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    method: "POST",
    data: { inspectionUrl: pageUrl, siteUrl: property() },
  });
  const r = res.data.inspectionResult?.indexStatusResult ?? {};
  return {
    verdict: r.verdict ?? "VERDICT_UNSPECIFIED",
    coverage: r.coverageState ?? "Unknown",
    indexed: r.verdict === "PASS",
    lastCrawl: r.lastCrawlTime ?? null,
    canonical: r.googleCanonical ?? null,
  };
}
