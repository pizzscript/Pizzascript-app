import { plainText, removeUnknownLinks, wordCount, wordRangeFor } from "../../src/lib/studio/content";
import { AGENT_MODEL } from "../../src/lib/studio/models";
import type { Fact, StudioPost, Topic } from "../../src/lib/studio/types";
import { runAgent } from "../agent";
import { allFacts, allPosts, db, enqueue, getPost, raiseSignal, saveVersion, settings } from "../db";
import { decide, json, text } from "../gemini";
import { cleanMarkdown, markdownToHtml } from "../markdown";
import { pagesBlock, readTopPages } from "../research/reader";
import { AGENT, ARTICLE_RULES, SERVICE_PAGES } from "../rules";
import { serpBlock, serpFor, writeBrief } from "./content";

const FACT_THRESHOLD = 0.7;
const SECTIONS_PER_REQUEST = 2;

interface DraftProgress {
  key: string;
  model?: string;
  parts: string[];
}

interface ArticleJob {
  post: StudioPost;
  outline: string[];
  liveSlugs: string[];
  wordRange: [number, number];
  required: string[];
  optional: string[];
  context: string;
}

/** At most one client fact, and only if it directly proves something in this article. */
async function relevantFact(post: StudioPost, facts: Fact[]) {
  if (!facts.length) return null;
  const scores = await decide(
    `Article query: ${post.seo_plan?.targetQuery}\nAngle: ${post.brief?.angle}\nOutline: ${(post.brief?.outline ?? []).join(" | ")}\n\nResults:\n${facts.map((f, i) => `[${i}] ${f.statement}`).join("\n")}`,
    Object.fromEntries(facts.map((_, i) => [`fact_${i}`, `Does result [${i}] measure the exact metric or outcome this article is about, so citing it would directly prove the article's main point?`])),
  );
  if (!scores) return null;
  const best = facts.map((f, i) => ({ f, score: scores[`fact_${i}`] })).sort((a, b) => b.score - a.score)[0];
  return best.score >= FACT_THRESHOLD ? best.f.statement : null;
}

async function prepare(post: StudioPost, facts: Fact[]): Promise<ArticleJob> {
  const [posts, ranges, topicRow, fact] = await Promise.all([
    allPosts(),
    settings.wordRanges(),
    post.topic_id ? db.from("topics").select("*").eq("id", post.topic_id).maybeSingle() : Promise.resolve({ data: null }),
    relevantFact(post, facts),
  ]);
  const topic = topicRow.data as Topic | null;
  const serp = topic ? await serpFor(topic) : null;
  const pages = serp ? await readTopPages(serp.organic.map((r) => r.url)) : [];
  const wordRange = post.brief.wordRange ?? wordRangeFor(post, ranges);
  const live = posts.filter((p) => p.stage === "live" && p.id !== post.id);
  const liveSlugs = live.map((p) => p.slug);
  const required = [...(post.brief.linksTo ?? []), post.brief.servicePage].filter(
    (l): l is string => Boolean(l) && (SERVICE_PAGES.includes(l!) || liveSlugs.includes(l!.replace("/blog/", ""))),
  );
  const optional = [...SERVICE_PAGES, ...live.map((p) => `/blog/${p.slug}`)].filter((l) => !required.includes(l));

  const context = `QUERY: ${post.seo_plan?.targetQuery}
AUDIENCE: ${post.brief.audience ?? "both"}
ANGLE: ${post.brief.angle}
OUTLINE: ${(post.brief.outline ?? []).join(" | ")}
LENGTH: ${Math.round((wordRange[0] + wordRange[1]) / 2)} words (allowed ${wordRange[0]}–${wordRange[1]})
${post.brief.questions?.length ? `QUESTIONS TO ANSWER: ${post.brief.questions.join(" | ")}` : ""}
RESEARCH: ${serp ? `${serpBlock(serp)}\n\n${pagesBlock(pages)}` : "No live search data. Don't claim what currently ranks."}
LINKS YOU MUST USE: ${required.join(", ") || "none"}
OTHER LINKS YOU MAY USE (exact paths only): ${optional.join(", ")}
${fact ? `ONE REAL RESULT YOU MAY CITE as "on a recent project", only if it fits naturally: ${fact}` : "Cite no studio or client results."}`;

  return { post, outline: post.brief.outline ?? [], liveSlugs, wordRange, required, optional, context };
}

const toHtml = (job: ArticleJob, markdown: string) => removeUnknownLinks(markdownToHtml(markdown), job.liveSlugs);

async function writeWithAgent(job: ArticleJob) {
  const { text: markdown } = await runAgent(`${ARTICLE_RULES}\n\nDo not use any tools, search, files or code execution.\n\n${job.context}`, {
    label: `article: ${job.post.slug}`,
    maxTokens: 60_000,
    timeoutMs: 15 * 60_000,
  });
  const html = toHtml(job, markdown);
  const words = wordCount(html);
  if ((html.match(/<h2[\s>]/gi) ?? []).length < 3 || words < job.wordRange[0] * 0.6) throw new Error(`Agent article too thin (${words} words)`);
  return html;
}

/** Backup writer: two sections per request, saving after each so a quota stop resumes where it left off. */
async function writeInGroups(job: ArticleJob) {
  const { post, outline } = job;
  const key = JSON.stringify(["markdown", post.brief.angle, outline]);
  const saved = post.seo_plan?.draftProgress as DraftProgress | undefined;
  const progress: DraftProgress = saved?.key === key ? saved : { key, parts: [] };
  const sticky = { model: progress.model };
  const groups: string[][] = [];
  for (let i = 0; i < outline.length; i += SECTIONS_PER_REQUEST) groups.push(outline.slice(i, i + SECTIONS_PER_REQUEST));
  const target = Math.round((job.wordRange[0] + job.wordRange[1]) / 2 / outline.length);

  for (let g = progress.parts.length; g < groups.length; g++) {
    const headings = groups[g];
    const soFar = progress.parts.join("\n\n");
    const used = job.required.filter((l) => soFar.includes(`](${l}`));
    const left = job.required.filter((l) => !used.includes(l));
    const isLast = g === groups.length - 1;
    const out = await text(
      `${job.context}

${soFar ? `WRITTEN SO FAR (continue it; never repeat its points, examples or code):\n${soFar}\n` : ""}
Write ONLY ${g === 0 ? "the opening paragraphs (no heading), then " : ""}these sections, about ${target} words each:
${headings.map((h) => `## ${h}`).join("\n")}
${left.length ? `Links still needed${isLast ? " (ALL must appear now)" : ""}: ${left.join(", ")}` : ""}
${isLast ? "This is the end of the article: no summary, finish with the next logical action or a natural service-page transition." : "Don't conclude; the article continues."}`,
      ARTICLE_RULES,
      { temperature: 0.7, tier: "writer", sticky },
    );
    let part = cleanMarkdown(out);
    if (g > 0 && !/^##\s/m.test(part)) part = `## ${headings[0]}\n\n${part}`;
    progress.parts.push(part);
    progress.model = sticky.model;
    await db.from("posts").update({ seo_plan: { ...post.seo_plan, draftProgress: progress } }).eq("id", post.id);
  }
  return { html: toHtml(job, progress.parts.join("\n\n")), model: sticky.model };
}

async function saveDraft(post: StudioPost, html: string, facts: Fact[], writtenBy: string | undefined) {
  const meta = await json<{ title: string; seo_title: string; seo_description: string; excerpt: string; unsupported_claims: string[] }>(
    `Write the metadata for this article and check its claims.

QUERY: ${post.seo_plan?.targetQuery}
VERIFIED STUDIO RESULTS: ${facts.map((f) => f.statement).join(" | ") || "none"}

ARTICLE:
${plainText(html)}

1. title (≤ 60 chars, includes the query's main words), seo_title (≤ 60 chars), seo_description (120–160 chars, specific benefit), excerpt (1–2 sentences).
2. unsupported_claims: every specific number or result stated as the studio's own experience, or as a share of projects or audits, that is NOT in the verified results. Documented technical values don't count. Empty if none.

Return JSON {"title":"","seo_title":"","seo_description":"","excerpt":"","unsupported_claims":[]}`,
    AGENT,
    { temperature: 0.3 },
  );

  const seoPlan = { ...post.seo_plan };
  delete seoPlan.draftProgress;
  delete seoPlan.bannerPlan;
  const lower = html.toLowerCase();
  const named = [...new Set(facts.map((f) => f.subject))].filter((name) => lower.includes(name.toLowerCase()));
  const claims = [...named.map((name) => `Names client: ${name}`), ...(meta.unsupported_claims ?? [])].slice(0, 10);
  const words = wordCount(html);
  const version = await saveVersion(post, html, "Agent draft", {
    title: meta.title,
    seo_title: meta.seo_title,
    seo_description: meta.seo_description,
    excerpt: meta.excerpt,
    stage: "draft",
    word_count: words,
    reading_minutes: Math.max(1, Math.round(words / 200)),
    seo_plan: { ...seoPlan, unsupportedClaims: claims, writtenBy },
  } as Partial<StudioPost>);

  if (claims.length) {
    await raiseSignal({
      kind: "quality_gate",
      title: `${meta.title}: check ${claims.length} claim${claims.length > 1 ? "s" : ""} not in your facts (${claims[0].slice(0, 70)})`,
      detail: { claims },
      priority: "P1",
      post_id: post.id,
      topic_id: post.topic_id,
      dedupe_key: `claims:${post.id}:${version}`,
    });
  }
  await enqueue(post.cover_image_url ? "run_audit" : "generate_image", { postId: post.id });
  return { words };
}

/** Antigravity writes first. If it hangs or fails, the normal writers take over automatically. */
export async function writeDraft({ postId }: { postId: string }): Promise<{ words: number }> {
  let post = await getPost(postId);
  if (!post.brief?.angle) {
    await writeBrief({ postId });
    post = await getPost(postId);
  }
  if (!post.brief?.outline?.length) throw new Error("The brief has no outline; rewrite the brief first.");

  const facts = await allFacts();
  const job = await prepare(post, facts);
  const saved = post.seo_plan?.draftProgress as DraftProgress | undefined;
  const hasProgress = saved?.key === JSON.stringify(["markdown", post.brief.angle, post.brief.outline]) && saved.parts?.length > 0;

  if (!hasProgress) {
    try {
      return await saveDraft(post, await writeWithAgent(job), facts, AGENT_MODEL);
    } catch (error) {
      console.warn(`[draft] agent unavailable, using backup writers: ${error instanceof Error ? error.message.slice(0, 200) : error}`);
    }
  }
  const { html, model } = await writeInGroups(job);
  return saveDraft(post, html, facts, model);
}
