// A client's research profile: what the business sells, to whom and where. The site analysis drafts it; the owner
// approves it; every research step reads only the approved copy. Pure functions, shared by the worker and admin.

export type SourceKind = "website" | "gsc" | "business_profile" | "owner" | "inferred";

export interface Source {
  kind: SourceKind;
  url?: string;
  /** True once the owner approved or edited it. */
  confirmed: boolean;
}

export interface Field<T> {
  value: T;
  source: Source;
}

export type ServicePriority = "grow" | "keep" | "ignore";

export interface ResearchService {
  name: string;
  path: string | null;
  priority: ServicePriority;
  description: string;
  source: Source;
}

export interface ResearchLocation {
  name: string;
  countryCode: string;
  primary: boolean;
}

export interface TopicGroup {
  id: string;
  label: string;
  /** What belongs in this group, in plain words, for the AI. */
  description: string;
  /** The service this group sells, the buyer it serves and why it was suggested. */
  service?: string;
  customer?: string;
  why?: string;
  /** Target share of the idea pool, 0–100. Shares add up to 100. */
  share: number;
  /** How Auto-pick treats the group: by share (auto), favoured (boost), or written first when behind (mandatory). */
  mode?: GroupMode;
}

export type GroupMode = "auto" | "boost" | "mandatory";
export const isGroupMode = (v: unknown): v is GroupMode => v === "auto" || v === "boost" || v === "mandatory";

export interface ResearchProfile {
  version: number;
  status: "draft" | "approved";
  analysedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  business: Field<string>;
  industry: Field<string>;
  services: ResearchService[];
  customers: Field<string>[];
  locations: ResearchLocation[];
  language: string;
  avoid: string[];
  tone: Field<string>;
  topicGroups: TopicGroup[];
  competitors: string[];
  customerQuestions: string[];
  trustedSources: string[];
  /** What the analysis couldn't find out. */
  gaps: string[];
  /** The owner's answers the analysis was given. */
  brief?: OwnerBrief;
  pagesRead?: PageRead[];
  searchData?: { queries: number; impressions: number; used: boolean };
}

/** What only the owner knows. It outranks anything the website or search data suggests. */
export interface OwnerBrief {
  hire: string;
  grow: string;
  never: string;
}
export const EMPTY_BRIEF: OwnerBrief = { hire: "", grow: "", never: "" };
export const BRIEF_KEY = "research_brief";

export interface PageRead {
  path: string;
  /** html: read from the page; reader: needed the rendering reader; title-only: no readable text. */
  how: "html" | "reader" | "title-only";
  words: number;
}

/** Below this, search data is too small a sample to say what a business should write about. */
export const SEARCH_EVIDENCE_MIN = { queries: 25, impressions: 500 };
export const enoughSearchData = (queries: number, impressions: number) => queries >= SEARCH_EVIDENCE_MIN.queries && impressions >= SEARCH_EVIDENCE_MIN.impressions;

const DEVELOPER_TOPIC = /\b(developer (guides?|tutorials?|tools?)|frameworks?|react|next\.?js|vite|gsap|tailwind|typescript|javascript|sdk|devops|deployment|edge|cloud (infrastructure|hosting)|cloudflare|vercel|coding|tutorials?)\b/i;
const stems = (s: string) => new Set((s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).map((w) => w.replace(/s$/, "")));

/** The listed service a topic group names, allowing small wording differences. */
export function matchService(name: string, services: ResearchService[]) {
  const wanted = stems(name);
  if (!wanted.size) return null;
  return (
    services
      .filter((s) => s.priority !== "ignore")
      .map((s) => ({ s, hit: [...stems(s.name)].filter((w) => wanted.has(w)).length / Math.max(stems(s.name).size, 1) }))
      .filter((m) => m.hit >= 0.6)
      .sort((a, b) => b.hit - a.hit)[0]?.s ?? null
  );
}

/**
 * Keeps only topic groups tied to a service the business sells and a buyer it serves. Developer-focused groups are
 * dropped unless the owner said developers are the customers. With nothing usable left, groups come from the services.
 */
export function checkGroups(groups: TopicGroup[], services: ResearchService[], brief: OwnerBrief) {
  const wantsDevelopers = /\b(developers?|engineers?|dev teams?)\b/i.test(brief.hire);
  const rejected: string[] = [];
  const kept = groups.flatMap((g) => {
    const service = matchService(g.service ?? "", services);
    const reason = !service
      ? "it isn't tied to a service you sell"
      : !g.customer?.trim()
        ? "it names no customer"
        : !wantsDevelopers && DEVELOPER_TOPIC.test(`${g.label} ${g.description} ${g.customer}`)
          ? "it's aimed at developers"
          : null;
    if (reason) rejected.push(`Topic group "${g.label}" was removed: ${reason}.`);
    return reason ? [] : [{ ...g, service: service!.name }];
  });
  if (kept.length) return { groups: kept, rejected };
  const sold = services.filter((s) => s.priority !== "ignore");
  const base = [...sold.filter((s) => s.priority === "grow"), ...sold.filter((s) => s.priority !== "grow")].slice(0, 3);
  const fallback: TopicGroup[] = base.map((s) => ({ id: slug(s.name), label: s.name.slice(0, 40), description: `questions buyers ask before paying for ${s.name.toLowerCase()}`, share: 1, service: s.name, why: "Built from your services because no suggested group passed the checks." }));
  return { groups: fallback, rejected };
}

export const PROFILE_KEYS = { draft: "research_profile_draft", approved: "research_profile" } as const;

const COUNTRY_CODES: Record<string, string> = {
  india: "in", "united states": "us", usa: "us", "united kingdom": "gb", uk: "gb", england: "gb", australia: "au", canada: "ca",
  "united arab emirates": "ae", uae: "ae", singapore: "sg", "new zealand": "nz", ireland: "ie", germany: "de", france: "fr",
};

/** Google's country code for a country name, or "" when unknown. */
export const countryCodeFor = (country: string) => COUNTRY_CODES[country.trim().toLowerCase()] ?? (/^[a-z]{2}$/i.test(country.trim()) ? country.trim().toLowerCase() : "");

const text = (v: unknown, max = 300) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, max: number, len = 200) =>
  (Array.isArray(v) ? v : [])
    .map((x) => text(x, len))
    .filter(Boolean)
    .slice(0, max);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "general";

/** The AI's claimed source, kept only if it points at a page that was actually read. */
function sourceFrom(raw: unknown, pages: Set<string>): Source {
  const r = (raw ?? {}) as { kind?: string; url?: string };
  const url = typeof r.url === "string" ? r.url.trim() : "";
  if (url && pages.has(url)) return { kind: "website", url, confirmed: false };
  if (r.kind === "gsc" || r.kind === "business_profile") return { kind: r.kind, confirmed: false };
  return { kind: "inferred", confirmed: false };
}

const field = (raw: unknown, pages: Set<string>, max = 300): Field<string> => {
  const r = (raw ?? {}) as { value?: unknown; source?: unknown };
  return { value: text(typeof raw === "string" ? raw : r.value, max), source: sourceFrom(r.source, pages) };
};

/** Shares rounded so they add up to exactly 100. */
export function normaliseShares(groups: TopicGroup[]): TopicGroup[] {
  if (!groups.length) return groups;
  const total = groups.reduce((s, g) => s + Math.max(0, g.share), 0) || groups.length;
  const out = groups.map((g) => ({ ...g, share: Math.round((Math.max(0, g.share) || (total === groups.length ? 1 : 0)) * (100 / total)) }));
  out[0].share += 100 - out.reduce((s, g) => s + g.share, 0);
  return out;
}

/**
 * Checks the AI's draft: keeps only service paths and sources that point at pages actually read, fixes country codes
 * and topic shares, and trims everything. Anything it can't support is labelled inferred.
 */
export function validateDraft(raw: unknown, pageUrls: string[], fallback: { language: string; location: string }, brief: OwnerBrief = EMPTY_BRIEF): ResearchProfile {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pages = new Set(pageUrls);
  const paths = new Set(pageUrls.map((u) => new URL(u).pathname.replace(/\/$/, "") || "/"));
  const services = (Array.isArray(r.services) ? r.services : []).slice(0, 15).map((s) => {
    const x = (s ?? {}) as Record<string, unknown>;
    const path = typeof x.path === "string" ? x.path.trim().replace(/\/$/, "") : "";
    return {
      name: text(x.name, 80),
      path: path && paths.has(path) ? path : null,
      priority: (["grow", "keep", "ignore"].includes(String(x.priority)) ? x.priority : "keep") as ServicePriority,
      description: text(x.description, 200),
      source: sourceFrom(x.source, pages),
    };
  }).filter((s) => s.name);
  const locations = (Array.isArray(r.locations) ? r.locations : []).slice(0, 8).map((l, i) => {
    const x = (l ?? {}) as Record<string, unknown>;
    const name = text(x.name, 80);
    const code = countryCodeFor(text(x.countryCode, 40)) || countryCodeFor(name.split(",").at(-1) ?? "");
    return { name, countryCode: code || "in", primary: x.primary === true || i === 0 };
  }).filter((l) => l.name);
  if (!locations.length) locations.push({ name: fallback.location, countryCode: countryCodeFor(fallback.location.split(",").at(-1) ?? "") || "in", primary: true });
  const groups = (Array.isArray(r.topicGroups) ? r.topicGroups : []).slice(0, 5).map((g) => {
    const x = (g ?? {}) as Record<string, unknown>;
    const label = text(x.label, 40);
    return { id: slug(label), label, description: text(x.description, 160), share: Number(x.share) || 0, service: text(x.service, 80), customer: text(x.customer, 160), why: text(x.why, 240) };
  }).filter((g) => g.label);
  const checked = checkGroups(groups, services, brief);
  return {
    version: 1,
    status: "draft",
    analysedAt: new Date().toISOString(),
    business: field(r.business, pages),
    industry: field(r.industry, pages, 80),
    services,
    customers: (Array.isArray(r.customers) ? r.customers : []).slice(0, 6).map((c) => field(c, pages, 200)).filter((c) => c.value),
    locations,
    language: text(r.language, 10) || fallback.language,
    avoid: list(r.avoid, 15),
    tone: field(r.tone, pages, 200),
    topicGroups: normaliseShares(checked.groups.length ? checked.groups : [{ id: "general", label: "General", description: "the business's services and its customers' problems", share: 100 }]),
    competitors: list(r.competitors, 5, 120).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))),
    customerQuestions: list(r.customerQuestions, 20),
    trustedSources: list(r.trustedSources, 10, 120),
    gaps: [...checked.rejected, ...list(r.gaps, 10)],
    brief,
  };
}

/** A profile becomes the approved copy: everything in it now counts as confirmed by the owner. */
export function approve(profile: ResearchProfile, by: string, now = new Date().toISOString()): ResearchProfile {
  const confirm = <T>(f: Field<T>): Field<T> => ({ ...f, source: { ...f.source, confirmed: true } });
  return {
    ...profile,
    status: "approved",
    approvedAt: now,
    approvedBy: by,
    business: confirm(profile.business),
    industry: confirm(profile.industry),
    tone: confirm(profile.tone),
    customers: profile.customers.map(confirm),
    services: profile.services.map((s) => ({ ...s, source: { ...s.source, confirmed: true } })),
    topicGroups: normaliseShares(profile.topicGroups),
    version: (profile.version ?? 0) + 1,
  };
}

/** Plain-language list of what differs between the approved profile and a new draft. */
export function profileChanges(approved: ResearchProfile | null, draft: ResearchProfile): string[] {
  if (!approved) return [];
  const out: string[] = [];
  if (approved.business.value !== draft.business.value) out.push(`Business: "${draft.business.value}"`);
  if (approved.industry.value !== draft.industry.value) out.push(`Industry: "${draft.industry.value}"`);
  const names = (s: ResearchService[]) => new Set(s.map((x) => x.name.toLowerCase()));
  const before = names(approved.services);
  const after = names(draft.services);
  for (const s of draft.services) if (!before.has(s.name.toLowerCase())) out.push(`New service: ${s.name}`);
  for (const s of approved.services) if (!after.has(s.name.toLowerCase())) out.push(`Service no longer found: ${s.name}`);
  const where = (l: ResearchLocation[]) => l.map((x) => x.name).sort().join(", ");
  if (where(approved.locations) !== where(draft.locations)) out.push(`Locations: ${where(draft.locations)}`);
  return out;
}

/** The parts of the client profile that research reads, taken from an approved research profile. */
export function researchFields(profile: ResearchProfile) {
  const primary = profile.locations.find((l) => l.primary) ?? profile.locations[0];
  const where = profile.locations.map((l) => l.name).join(", ");
  const sells = profile.services.filter((s) => s.priority !== "ignore").map((s) => s.name).join(", ");
  return {
    researchDescription: `${profile.business.value}${sells ? ` (${sells})` : ""}`,
    market: profile.customers.map((c) => c.value).join("; ") + (where ? ` in ${where}` : ""),
    country: primary?.name.split(",").at(-1)?.trim() || "India",
    countryCode: primary?.countryCode || "in",
    language: profile.language || "en",
  };
}

/** Place names a client's research may mention. Anything else in this list is "outside the area". */
const KNOWN_PLACES = /\b(india|usa|us|uk|united states|united kingdom|australia|canada|uae|dubai|philippines|kenya|south africa|america|singapore|nigeria|pakistan|london|new york|sydney|toronto)\b/gi;

/** True when a search names no place, or only places the client serves. */
export function placeAllowed(query: string, locations: ResearchLocation[]) {
  const allowed = locations.map((l) => `${l.name} ${l.countryCode}`.toLowerCase());
  const codeNames: Record<string, string[]> = { in: ["india"], us: ["usa", "us", "united states", "america", "new york"], gb: ["uk", "united kingdom", "london"], au: ["australia", "sydney"], ca: ["canada", "toronto"], ae: ["uae", "dubai"], sg: ["singapore"] };
  const ok = new Set(locations.flatMap((l) => codeNames[l.countryCode] ?? []));
  return [...query.toLowerCase().matchAll(KNOWN_PLACES)].every((m) => ok.has(m[1]) || allowed.some((a) => a.includes(m[1])));
}

/** True when a search touches a topic the client never wants covered. */
/**
 * Why a topic found outside normal research (a news feed, a competitor's page) doesn't fit the approved profile, or
 * null when it does. The same rules normal research and topic groups follow.
 */
export function outsideProfile(query: string, profile: Pick<ResearchProfile, "avoid" | "locations" | "brief">) {
  if (isAvoided(query, profile.avoid)) return "on the avoid list";
  if (!placeAllowed(query, profile.locations)) return "outside the client's area";
  if (!/\b(developers?|engineers?|dev teams?)\b/i.test(profile.brief?.hire ?? "") && DEVELOPER_TOPIC.test(query)) return "aimed at developers";
  return null;
}

export const isAvoided = (query: string, avoid: string[]) => avoid.some((a) => a.trim() && query.toLowerCase().includes(a.trim().toLowerCase()));
