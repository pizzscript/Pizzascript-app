import { TECH, TOPIC_ICONS, type TopicIcon } from "./assets";

/**
 * What a poster says and which template shows it. The AI acts as art director and fills this in; the rules below
 * produce the same shape without AI (quota used up, outage) and validate whatever the AI returns.
 */
export type PosterType = "comparison" | "metric" | "code" | "cost" | "case-study" | "guide";

export interface PosterPlan {
  type: PosterType;
  headline: string; // ≤ 7 words, the big text
  highlight: string | null; // one word of the headline, drawn in the accent colour
  kicker: string; // ≤ 14 words, the line under the headline
  tech: string[]; // up to 3 keys of TECH
  icon: TopicIcon; // topic icon for when there's no tech logo
  compare: [string, string] | null; // two TECH keys or short labels, for comparison
  metric: { label: string; before: string; after: string } | null;
  code: { filename: string; lines: string[] } | null;
  cost: { range: string; label: string } | null;
}

export interface PosterInput {
  title: string;
  excerpt: string;
  tags: string[];
  query: string;
  angle: string;
  role: string | null;
  categoryName: string;
  categoryIcon: TopicIcon;
  bodyHtml: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const words = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&");

/** The poster fonts only cover Latin; replace characters they can't draw so nothing renders as a box. */
export function sanitize(s: string) {
  return s
    .replace(/[→⟶]/g, "to")
    .replace(/₹/g, "Rs ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e -ÿ–—…]/g, "")
    .trim();
}

/** Tools our articles usually argue against — only shown when the title/tags/query are actually about them. */
const COMPETITORS = new Set(["wordpress", "webflow"]);

/** Tech in order of first mention (for titles), or most-mentioned first (for article bodies). */
export function detectTech(text: string, opts: { byFrequency?: boolean; allowCompetitors?: boolean } = {}): string[] {
  const hits = Object.entries(TECH)
    .filter(([key]) => opts.allowCompetitors !== false || !COMPETITORS.has(key))
    .map(([key, t]) => ({ key, at: text.search(t.match), count: (text.match(new RegExp(t.match.source, "gi")) ?? []).length }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => (opts.byFrequency ? b.count - a.count || a.at - b.at : a.at - b.at))
    .map((h) => h.key);
  // "Google" is only interesting when nothing more specific is present.
  return (hits.length > 1 ? hits.filter((k) => k !== "google") : hits).slice(0, 3);
}

/** A short line that ends cleanly: first clause of the first sentence, ≤ 13 words, with "…" only if it had to be cut. */
function cleanKicker(s: string) {
  const sentence = (s.split(/(?<=[.!?])\s/)[0] ?? s).trim();
  const clause = sentence.split(/\s*[;:—]\s*|\s+-\s+/)[0].replace(/[.,;:]+$/, "");
  const w = clause.split(/\s+/).filter(Boolean);
  return w.length <= 13 ? clause : `${w.slice(0, 11).join(" ").replace(/[,;:]+$/, "")}…`;
}

function firstCode(html: string): string[] | null {
  const block = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1];
  if (!block) return null;
  const lines = decode(block.replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((l) => l.replace(/\t/g, "  ").replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0)
    .slice(0, 6)
    .map((l) => clip(l, 42));
  return lines.length >= 2 ? lines : null;
}

const METRIC = /from\s+(\d+(?:\.\d+)?\s?(?:s|ms|%|kb|mb|seconds))\s+(?:down\s+)?to\s+(\d+(?:\.\d+)?\s?(?:s|ms|%|kb|mb|seconds))/i;

/** Rule-based plan: always works, no AI. */
export function rulePlan(input: PosterInput): PosterPlan {
  const [main, sub] = input.title.split(/:\s+/, 2);
  const text = `${input.title} ${input.tags.join(" ")} ${input.query}`;
  const bodyText = decode(input.bodyHtml.replace(/<[^>]+>/g, " "));
  const fromTitle = detectTech(text);
  const tech = fromTitle.length ? fromTitle : detectTech(bodyText, { byFrequency: true, allowCompetitors: false });
  const kicker = sub ?? cleanKicker(input.excerpt || input.angle);

  const base: PosterPlan = {
    type: "guide",
    headline: words(main, 7),
    highlight: null,
    kicker: cleanKicker(kicker),
    tech,
    icon: input.categoryIcon,
    compare: null,
    metric: null,
    code: null,
    cost: null,
  };

  const vs = main.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s+for\b.*)?$/i);
  if (vs) {
    const a = detectTech(vs[1])[0] ?? clip(vs[1], 14);
    const b = detectTech(vs[2])[0] ?? clip(vs[2], 14);
    return { ...base, type: "comparison", compare: [a, b], highlight: "vs" };
  }
  if (input.role === "case-study" || /^case study/i.test(input.title)) {
    const m = bodyText.match(METRIC);
    return { ...base, type: "case-study", icon: "briefcase", metric: m ? { label: "Result", before: m[1], after: m[2] } : null };
  }
  if (/\b(cost|price|pricing|budget|rates?)\b/i.test(main)) {
    const range = bodyText.match(/(?:₹|rs\.?|inr)\s?[\d,.]+\s?(?:k|l|lakh|lakhs)?\s?(?:–|-|to)\s?(?:₹|rs\.?|inr)?\s?[\d,.]+\s?(?:k|l|lakh|lakhs)?/i)?.[0];
    return { ...base, type: "cost", icon: "indian-rupee", cost: { range: range ? clip(sanitize(range), 22) : "Real numbers", label: "What it actually costs" } };
  }
  const metric = bodyText.match(METRIC);
  if (metric && /\b(speed|fast|performance|lcp|load|optimi[sz]|core web vitals|lighthouse)\b/i.test(text)) {
    return { ...base, type: "metric", icon: "gauge", metric: { label: "Load time", before: metric[1], after: metric[2] } };
  }
  const code = firstCode(input.bodyHtml);
  if (code && /\b(how|fix|prevent|setup|set up|implement|integrat|configur|build|guide|optimi[sz])/i.test(text)) {
    const ext = /typescript|\.tsx?\b/i.test(bodyText) ? "tsx" : "js";
    return { ...base, type: "code", code: { filename: `${(tech[0] ?? "snippet").replace(/[^a-z]/g, "")}.${ext}`, lines: code } };
  }
  return base;
}

/** Validates an AI plan against the rules' plan; anything missing or malformed falls back to the rule value. */
export function mergePlan(ai: Partial<PosterPlan> | null, rules: PosterPlan): PosterPlan {
  if (!ai || typeof ai !== "object") return rules;
  const type = (["comparison", "metric", "code", "cost", "case-study", "guide"] as const).includes(ai.type as PosterType) ? (ai.type as PosterType) : rules.type;
  const headline = typeof ai.headline === "string" && ai.headline.trim() ? words(sanitize(ai.headline), 7) : rules.headline;
  const tech = Array.isArray(ai.tech) ? ai.tech.filter((k): k is string => typeof k === "string" && k in TECH).slice(0, 3) : rules.tech;
  const plan: PosterPlan = {
    type,
    headline,
    highlight: typeof ai.highlight === "string" && headline.toLowerCase().includes(ai.highlight.toLowerCase()) ? ai.highlight : rules.highlight,
    kicker: typeof ai.kicker === "string" && ai.kicker.trim() ? words(sanitize(ai.kicker), 14) : rules.kicker,
    tech: tech.length ? tech : rules.tech,
    icon: (TOPIC_ICONS as readonly string[]).includes(ai.icon as string) ? (ai.icon as TopicIcon) : rules.icon,
    compare:
      Array.isArray(ai.compare) && ai.compare.length === 2 && ai.compare.every((c) => typeof c === "string" && c.trim())
        ? [clip(sanitize(ai.compare[0]), 16), clip(sanitize(ai.compare[1]), 16)]
        : rules.compare,
    metric:
      ai.metric && typeof ai.metric.before === "string" && typeof ai.metric.after === "string"
        ? { label: clip(sanitize(String(ai.metric.label ?? "Result")), 22), before: clip(sanitize(ai.metric.before), 10), after: clip(sanitize(ai.metric.after), 10) }
        : rules.metric,
    code:
      ai.code && Array.isArray(ai.code.lines) && ai.code.lines.length >= 2
        ? { filename: clip(sanitize(String(ai.code.filename ?? "snippet.js")), 24), lines: ai.code.lines.slice(0, 6).map((l) => clip(sanitize(String(l)), 42)) }
        : rules.code,
    cost: ai.cost && typeof ai.cost.range === "string" ? { range: clip(sanitize(ai.cost.range), 22), label: clip(sanitize(String(ai.cost.label ?? "")), 30) } : rules.cost,
  };
  // A template needs its hero content; without it, show the guide layout rather than an empty card.
  if (
    (plan.type === "comparison" && !plan.compare) ||
    (plan.type === "metric" && !plan.metric) ||
    (plan.type === "code" && !plan.code) ||
    (plan.type === "cost" && !plan.cost)
  ) {
    plan.type = "guide";
  }
  return plan;
}

/** The prompt for the AI art director. */
export function planPrompt(input: PosterInput, rules: PosterPlan) {
  return `You are the art director for PizzaScript's blog banners (dark, warm, premium developer-studio look).
Decide what the banner for this article should SAY and SHOW. A fixed template draws it; you only choose content.

ARTICLE
Title: ${input.title}
Category: ${input.categoryName}
Target search: ${input.query}
Angle: ${input.angle}
Excerpt: ${input.excerpt}
Tags: ${input.tags.join(", ")}
First code block (if any): ${(firstCode(input.bodyHtml) ?? []).join(" | ")}

Pick ONE type:
- "comparison": the article compares two things → compare: two items (tech keys below, or ≤ 2-word labels)
- "metric": a concrete before/after number is the story → metric: {label, before, after} (only real numbers from the article)
- "code": a hands-on technical fix → code: {filename, lines: 3–6 short real lines from the article}
- "cost": pricing / budget → cost: {range, label} (only figures from the article; else "Real numbers")
- "case-study": a client result
- "guide": anything else

Rules: headline ≤ 6 words, punchy, not the full title. highlight = one word from your headline. kicker ≤ 12 words.
tech: up to 3 keys from [${Object.keys(TECH).join(", ")}] that the article is really about.
icon: one of [${TOPIC_ICONS.join(", ")}].
Never invent numbers. Use plain ASCII (no arrows or currency symbols — write "Rs" for rupees).

A rule-based draft, for reference: ${JSON.stringify(rules)}

Return JSON: {"type","headline","highlight","kicker","tech","icon","compare","metric","code","cost"} (null where not used).`;
}
