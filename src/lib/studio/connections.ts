/**
 * Service keys that can be managed from the admin panel. Values are stored encrypted and never shown in full.
 * scope: "platform" = one shared value (PizzaScript's account) used for every client;
 *        "client"   = each client has its own, and a client never falls back to PizzaScript's;
 *        "either"   = a client may set its own, otherwise the shared one is used (and counts against the shared quota).
 */
export const CONNECTIONS = [
  { name: "gemini_api_key", label: "Gemini API key", env: "GEMINI_API_KEY", field: "geminiApiKey", kind: "secret", scope: "either", help: "Writes, reviews and repairs articles. Google AI Studio → API keys. A client's own key gives it its own quota." },
  { name: "gsc_service_account_json", label: "Search Console service account", env: "GSC_SERVICE_ACCOUNT_JSON", field: "gscServiceAccount", kind: "json", scope: "either", help: "The full JSON key file of a Google service account that you added as a user in Search Console." },
  { name: "gsc_site_url", label: "Search Console property", env: "GSC_SITE_URL", field: "gscSite", kind: "text", scope: "client", help: "For example sc-domain:example.com" },
  { name: "bright_data_api_key", label: "Bright Data API key", env: "BRIGHT_DATA_API_KEY", field: "brightDataKey", kind: "secret", scope: "platform", help: "Live Google results for topic research. Optional." },
  { name: "bright_data_serp_zone", label: "Bright Data search zone", env: "BRIGHT_DATA_SERP_ZONE", field: "brightDataZone", kind: "text", scope: "platform", help: "The name of your Bright Data SERP zone. Optional." },
  { name: "jina_api_key", label: "Jina Reader key", env: "JINA_API_KEY", field: "jinaKey", kind: "secret", scope: "platform", help: "Reads top-ranking pages faster. Optional, free key available." },
  { name: "github_dispatch_token", label: "GitHub token for banners", env: "GITHUB_DISPATCH_TOKEN", field: "githubDispatchToken", kind: "secret", scope: "platform", help: "Fine-grained token, this repo only, Actions read and write. Lets GitHub draw banners." },
  { name: "pagespeed_api_key", label: "PageSpeed Insights key", env: "PAGESPEED_API_KEY", field: "pagespeedKey", kind: "secret", scope: "platform", help: "Free Google Cloud API key with PageSpeed Insights and Chrome UX Report enabled." },
  { name: "bing_webmaster_api_key", label: "Bing Webmaster key", env: "BING_WEBMASTER_API_KEY", field: "bingKey", kind: "secret", scope: "either", help: "Bing Webmaster Tools → Settings → API access. Keywords and inbound links." },
  { name: "gbp_oauth_json", label: "Business Profile access", env: "GBP_OAUTH_JSON", field: "gbpOauth", kind: "json", scope: "client", help: 'JSON with client_id, client_secret and refresh_token for a Google account that manages the profile. Needs Google\'s API approval.' },
  { name: "gbp_location", label: "Business Profile location", env: "GBP_LOCATION", field: "gbpLocation", kind: "text", scope: "client", help: "accounts/…/locations/… for the profile to post to." },
] as const;

export type Connection = (typeof CONNECTIONS)[number];
export type ConnectionName = Connection["name"];
export type ConnectionField = Connection["field"];

export const connectionByName = (name: string) => CONNECTIONS.find((c) => c.name === name);

/** Connections a client page can show: its own and "either" ones. The default workspace sees everything. */
export const connectionsFor = (isDefault: boolean) => CONNECTIONS.filter((c) => isDefault || c.scope !== "platform");

/** What the panel may show: the last 4 characters of a key, the account email of a JSON key, or a plain setting. */
export function describeValue(name: ConnectionName, value: string) {
  const connection = connectionByName(name)!;
  if (connection.kind === "text") return value.trim();
  if (connection.kind === "json") {
    try {
      const json = JSON.parse(value) as { client_email?: string; client_id?: string };
      return json.client_email ?? (json.client_id ? `OAuth …${json.client_id.slice(-6)}` : "JSON key");
    } catch {
      return "JSON key";
    }
  }
  return `…${value.trim().slice(-4)}`;
}

/** A quick shape check before anything is sent anywhere. Returns a problem in plain words, or null. */
export function formatProblem(name: ConnectionName, raw: string): string | null {
  const value = raw.trim();
  if (value.length < 2) return "Paste a value first.";
  const kind = connectionByName(name)!.kind;
  if (/\s/.test(value) && kind !== "json") return "It contains spaces or line breaks. Paste only the key.";
  switch (name) {
    case "gemini_api_key":
      return value.length < 30 ? "That looks too short for a Gemini key." : null;
    case "github_dispatch_token":
      return /^(github_pat_|ghp_)/.test(value) ? null : "GitHub tokens start with github_pat_ or ghp_.";
    case "gsc_site_url":
      return /^(sc-domain:[a-z0-9.-]+\.[a-z]{2,}|https?:\/\/[^\s]+\/)$/i.test(value) ? null : "Use sc-domain:example.com or https://www.example.com/ (with the final slash).";
    case "bright_data_serp_zone":
      return /^[a-z0-9_-]+$/i.test(value) ? null : "Zone names use only letters, numbers, - and _.";
    case "gsc_service_account_json":
      try {
        const json = JSON.parse(value) as { type?: string; client_email?: string; private_key?: string };
        return json.type === "service_account" && json.client_email && json.private_key?.includes("PRIVATE KEY") ? null : "This isn't a service account key file.";
      } catch {
        return "Paste the whole JSON file, starting with {.";
      }
    case "gbp_oauth_json":
      try {
        const json = JSON.parse(value) as { client_id?: string; client_secret?: string; refresh_token?: string };
        return json.client_id && json.client_secret && json.refresh_token ? null : "It needs client_id, client_secret and refresh_token.";
      } catch {
        return "Paste JSON starting with {.";
      }
    case "gbp_location":
      return /^accounts\/[^/]+\/locations\/[^/]+$/.test(value) ? null : "Use the form accounts/123/locations/456.";
    default:
      return value.length < 10 ? "That looks too short for a key." : null;
  }
}
