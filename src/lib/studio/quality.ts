/** Every limit the quality check uses, in one place. Change behaviour here rather than in the checks themselves. */
export const QUALITY = {
  maxRepairs: 2,
  title: { max: 65, softMax: 70 },
  meta: { min: 120, max: 160, softMin: 110, softMax: 170 },
  length: { tolerance: 0.15, softTolerance: 0.3 },
  duplicate: { similarity: 0.82, sameQuery: 0.7, copiedText: 0.3 },
  officialSources: [
    "nextjs.org",
    "react.dev",
    "web.dev",
    "developer.mozilla.org",
    "developer.chrome.com",
    "developers.google.com",
    "support.google.com",
    "pptr.dev",
    "rollupjs.org",
    "reactrouter.com",
    "vercel.com",
    "cloudflare.com",
    "vite.dev",
    "vitejs.dev",
    "gsap.com",
    "w3.org",
    "typescriptlang.org",
    "nodejs.org",
  ],
} as const;

export interface ReviewIssue {
  severity: string;
  claim: string;
  problem: string;
  source?: string;
  evidence?: string;
  /** The code block this issue is about, when a test ran against it. */
  block?: number;
  /** Set when a sourced second opinion showed the reviewer was wrong. */
  disputed?: { reason: string; source: string };
}

export interface ReviewCode {
  block: number;
  status: string;
  detail?: string;
}

export function isOfficialSource(url: string | undefined) {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && QUALITY.officialSources.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const codeNames = (text: string) => text.match(/\b[a-z]+[A-Z]\w*\b/g) ?? [];

/** True when a test actually ran the code this issue is about. */
export function provenByTest(issue: ReviewIssue, code: ReviewCode[] = []) {
  const ran = code.filter((c) => c.status === "ran" || c.status === "failed");
  if (issue.block !== undefined) return ran.some((c) => c.block === issue.block);
  const names = codeNames(`${issue.claim} ${issue.problem}`);
  return ran.some((c) => names.some((name) => c.detail?.includes(name)));
}

/**
 * An AI "error" only blocks publishing with proof: a code test, or an official source that wasn't overturned.
 * A test result can't be disputed. Everything else stays visible as a warning.
 */
export function issueBlocks(issue: ReviewIssue, code: ReviewCode[] = []) {
  if (issue.severity !== "error") return false;
  if (provenByTest(issue, code)) return true;
  return !issue.disputed && isOfficialSource(issue.source);
}

export function canDispute(issue: ReviewIssue, code: ReviewCode[], reason: unknown, source: unknown) {
  return !provenByTest(issue, code) && typeof reason === "string" && reason.trim().length >= 20 && typeof source === "string" && isOfficialSource(source);
}

export interface SeoFields {
  title?: string;
  seo_title?: string;
  seo_description?: string;
  excerpt?: string;
}

/** Keeps only the SEO fields that meet the limits, so one bad field is regenerated without touching the rest. */
export function cleanSeo(raw: unknown): SeoFields {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const read = (key: string) => (typeof input[key] === "string" ? (input[key] as string).trim() : "");
  const out: SeoFields = {};
  const title = read("title");
  if (title && title.length <= QUALITY.title.max) out.title = title;
  const seoTitle = read("seo_title");
  if (seoTitle && seoTitle.length <= 60) out.seo_title = seoTitle;
  const description = read("seo_description");
  if (description.length >= QUALITY.meta.min && description.length <= QUALITY.meta.max) out.seo_description = description;
  const excerpt = read("excerpt");
  if (excerpt.length > 40) out.excerpt = excerpt;
  return out;
}

const words = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Share of this text's 6-word runs that also appear in the other text. Finds real copying, not a shared topic. */
export function copiedShare(html: string, otherHtml: string) {
  const runs = (list: string[]) => {
    const out = new Set<string>();
    for (let i = 0; i + 6 <= list.length; i++) out.add(list.slice(i, i + 6).join(" "));
    return out;
  };
  const mine = runs(words(html));
  if (!mine.size) return 0;
  const theirs = runs(words(otherHtml));
  let shared = 0;
  for (const run of mine) if (theirs.has(run)) shared++;
  return shared / mine.size;
}
