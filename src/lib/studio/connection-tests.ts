import { JWT } from "google-auth-library";
import type { ConnectionName } from "./connections";

export interface CheckResult {
  ok: boolean;
  detail: string;
  expiresAt?: string | null;
}

const TIMEOUT_MS = 15_000;
const call = (url: string, init: RequestInit = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

/** GitHub sends a token's expiry as "2026-11-30 07:07:00 +0530". */
function githubExpiry(header: string | null) {
  if (!header) return null;
  const m = header.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  const iso = m ? `${m[1]}T${m[2]}${m[3]}:${m[4]}` : header;
  return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
}

/**
 * Checks a key against its service before it is saved, using calls that don't spend AI quota or paid credits.
 * `related` holds the other current settings, for checks that need two values (a key and its site or zone).
 */
export async function testConnection(name: ConnectionName, value: string, related: Partial<Record<ConnectionName, string>> = {}): Promise<CheckResult> {
  const key = value.trim();
  try {
    switch (name) {
      case "gemini_api_key": {
        const res = await call("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": key } });
        if (res.ok) return { ok: true, detail: "Google accepted this key" };
        if (res.status === 429) return { ok: true, detail: "Key accepted, but today's quota is used up" };
        return { ok: false, detail: res.status === 400 || res.status === 403 ? "Google rejected this key" : `Google answered ${res.status}` };
      }
      case "gsc_service_account_json":
      case "gsc_site_url": {
        const json = name === "gsc_service_account_json" ? key : related.gsc_service_account_json;
        const site = name === "gsc_site_url" ? key : related.gsc_site_url;
        if (!json) return { ok: true, detail: "Saved. It will be checked once the service account is added" };
        const account = JSON.parse(json) as { client_email: string; private_key: string };
        const client = new JWT({ email: account.client_email, key: account.private_key, scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
        const { token } = await client.getAccessToken();
        const res = await call("https://searchconsole.googleapis.com/webmasters/v3/sites", { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok) return { ok: false, detail: `Search Console answered ${res.status}` };
        const sites = ((await res.json()) as { siteEntry?: { siteUrl: string }[] }).siteEntry?.map((s) => s.siteUrl) ?? [];
        if (!site) return { ok: true, detail: `Signed in. It can see ${sites.length} propert${sites.length === 1 ? "y" : "ies"}` };
        return sites.includes(site)
          ? { ok: true, detail: `Signed in and can read ${site}` }
          : { ok: false, detail: `Signed in, but ${account.client_email} hasn't been added as a user of ${site} in Search Console` };
      }
      case "bright_data_api_key": {
        const res = await call("https://api.brightdata.com/trials/free_tier", { headers: { authorization: `Bearer ${key}` } });
        if (res.status === 401) return { ok: false, detail: "Bright Data rejected this key" };
        return { ok: true, detail: res.ok ? "Bright Data accepted this key" : "Key accepted (it can't read billing, which is fine)" };
      }
      case "bright_data_serp_zone":
        return { ok: true, detail: "Saved. The zone is checked on the next research run, to avoid a paid request" };
      case "jina_api_key": {
        const res = await call("https://r.jina.ai/https://example.com", { headers: { authorization: `Bearer ${key}`, accept: "text/plain" } });
        if (res.ok) return { ok: true, detail: "Jina accepted this key" };
        return { ok: false, detail: res.status === 401 || res.status === 403 ? "Jina rejected this key" : `Jina answered ${res.status}` };
      }
      case "github_dispatch_token": {
        const repo = process.env.GITHUB_REPO ?? process.env.RENDER_GIT_REPO_SLUG ?? "pizzscript/Pizzascript-app";
        const res = await call(`https://api.github.com/repos/${repo}/actions/workflows/heavy-job.yml`, {
          headers: { accept: "application/vnd.github+json", authorization: `Bearer ${key}`, "x-github-api-version": "2022-11-28", "user-agent": "connections-check" },
        });
        const expiresAt = githubExpiry(res.headers.get("github-authentication-token-expiration"));
        if (res.ok) return { ok: true, detail: `GitHub accepted this token for ${repo}`, expiresAt };
        return { ok: false, detail: res.status === 401 ? "GitHub rejected this token" : `GitHub answered ${res.status}. Check it has access to ${repo}`, expiresAt };
      }
    }
  } catch (error) {
    return { ok: false, detail: `Check failed: ${error instanceof Error ? error.message.slice(0, 120) : "unknown error"}` };
  }
}
