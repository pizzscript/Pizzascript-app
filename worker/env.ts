function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
  geminiApiKey: required("GEMINI_API_KEY"),
  textModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
  imageModel: process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image",
  /** Full service-account JSON (Render secret). Search Console sync is skipped when unset. */
  gscServiceAccount: process.env.GSC_SERVICE_ACCOUNT_JSON,
  /** e.g. "sc-domain:pizzascript.com" or "https://www.pizzascript.com/". */
  gscSite: process.env.GSC_SITE_URL ?? "sc-domain:pizzascript.com",
  siteUrl: process.env.SITE_URL ?? "https://www.pizzascript.com",
  revalidateSecret: process.env.REVALIDATE_SECRET,
  workerId: process.env.GITHUB_RUN_ID ?? `worker-${process.pid}`,
};
