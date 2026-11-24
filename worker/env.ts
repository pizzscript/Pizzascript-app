function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
  geminiApiKey: required("GEMINI_API_KEY"),
  textModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash",
  brightDataKey: process.env.BRIGHT_DATA_API_KEY,
  brightDataZone: process.env.BRIGHT_DATA_SERP_ZONE,
  /** Optional: raises the Jina Reader limit from 20 to 500 requests a minute. */
  jinaKey: process.env.JINA_API_KEY,
  /** Full service-account JSON (Render secret). Search Console sync is skipped when unset. */
  gscServiceAccount: process.env.GSC_SERVICE_ACCOUNT_JSON,
  /** e.g. "sc-domain:pizzascript.com" or "https://www.pizzascript.com/". */
  gscSite: process.env.GSC_SITE_URL ?? "sc-domain:pizzascript.com",
  siteUrl: process.env.SITE_URL ?? "https://www.pizzascript.com",
  revalidateSecret: process.env.REVALIDATE_SECRET,
  /** Deployments whose blog cache to refresh after publishing (comma-separated). Defaults to SITE_URL. */
  revalidateUrls: (process.env.REVALIDATE_URLS ?? process.env.SITE_URL ?? "https://www.pizzascript.com")
    .split(",")
    .map((u) => u.trim().replace(/\/$/, ""))
    .filter(Boolean),
  /** Optional: lets the app start the GitHub heavy-job workflow. Without it, banners are drawn on this server. */
  githubDispatchToken: process.env.GITHUB_DISPATCH_TOKEN,
  githubRepo: process.env.GITHUB_REPO ?? process.env.RENDER_GIT_REPO_SLUG,
  // The rest are optional; most clients set them in Connections instead.
  pagespeedKey: process.env.PAGESPEED_API_KEY,
  bingKey: process.env.BING_WEBMASTER_API_KEY,
  gbpOauth: process.env.GBP_OAUTH_JSON,
  gbpLocation: process.env.GBP_LOCATION,
  workerId: process.env.GITHUB_RUN_ID ?? `worker-${process.pid}`,
};
