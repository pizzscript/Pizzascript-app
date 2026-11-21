import { internalLinks, wordCount, wordRangeFor } from "../../src/lib/studio/content";
import type { StudioPost } from "../../src/lib/studio/types";
import { allFacts, allPosts, db, enqueue, getPost, raiseSignal, saveVersion, settings } from "../db";
import { json } from "../gemini";
import { AGENT, HTML_FORMAT, STRATEGY, WRITING, factsBlock } from "../rules";
import { writeBrief } from "./content";

interface DraftProgress {
  key: string;
  model?: string;
  intro?: string;
  sections: string[];
}

const FACT_RULE = "Any specific number, percentage, timeframe or client result must come from the VERIFIED FACTS list. If it isn't there, describe it generally.";
const stripFence = (html: string) => html.trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").trim();

function ensureHeading(html: string, heading: string) {
  const clean = stripFence(html);
  return /^<h2[\s>]/i.test(clean) ? clean : `<h2>${heading}</h2>\n${clean}`;
}

/** Writes intro + one call per heading + one closing call. Each finished part is saved, so a quota stop resumes there. */
export async function writeDraft({ postId }: { postId: string }): Promise<{ words: number }> {
  const post = await getPost(postId);
  if (!post.brief?.angle) {
    await writeBrief({ postId });
    return writeDraft({ postId });
  }
  const outline = post.brief.outline ?? [];
  if (!outline.length) throw new Error("The brief has no outline; rewrite the brief first.");

  const [posts, facts, ranges] = await Promise.all([allPosts(), allFacts(), settings.wordRanges()]);
  const wordRange = post.brief.wordRange ?? wordRangeFor(post, ranges);
  const target = Math.round((wordRange[0] + wordRange[1]) / 2);
  const introWords = 130;
  const sectionWords = Math.round((target - introWords) / outline.length);

  const key = JSON.stringify([post.brief.angle, outline]);
  const saved = post.seo_plan?.draftProgress as DraftProgress | undefined;
  const progress: DraftProgress = saved?.key === key ? saved : { key, sections: [] };
  const sticky = { model: progress.model };
  const persist = () => {
    progress.model = sticky.model;
    return db.from("posts").update({ seo_plan: { ...post.seo_plan, draftProgress: progress } }).eq("id", postId);
  };

  const required = [...(post.brief.linksTo ?? []), post.brief.servicePage].filter((l): l is string => Boolean(l));
  const usedLinks = () => new Set(internalLinks([progress.intro ?? "", ...progress.sections].join("\n")).map((l) => l.href));
  const others = posts.filter((p) => p.stage === "live" && p.id !== post.id).map((p) => `/blog/${p.slug}`);
  const questions = post.brief.questions ?? [];

  const context = `ARTICLE
QUERY: ${post.seo_plan?.targetQuery}
TRACK ${post.track} · ${post.role} · audience ${post.brief.audience} · depth criterion ${post.brief.depth}
ANGLE: ${post.brief.angle}
FULL OUTLINE: ${outline.join(" | ")}
${questions.length ? `RELATED QUESTIONS THE ARTICLE MUST ANSWER: ${questions.join(" | ")}` : ""}

${factsBlock(facts)}
${FACT_RULE}`;
  const system = `${AGENT}\n\n${STRATEGY}\n\n${WRITING}\n\n${HTML_FORMAT}\nThis call writes only the part requested, not the whole article, so the section-count rule applies to the finished article.`;

  const linkNote = (isLast: boolean) => {
    const used = usedLinks();
    const left = required.filter((l) => !used.has(l));
    const optional = others.filter((l) => !used.has(l) && !left.includes(l));
    return `${left.length ? `LINKS STILL NEEDED${isLast ? " (ALL must appear in this section)" : " (use any that fit naturally)"}: ${left.join(", ")}` : "All required links are placed."}
OTHER ARTICLES YOU MAY LINK: ${optional.join(", ") || "none"}
ALREADY LINKED (do not link again): ${[...used].join(", ") || "none"}`;
  };

  if (!progress.intro) {
    const out = await json<{ html: string }>(
      `${context}\n\nWrite ONLY the opening: about ${introWords} words of <p> tags with no heading. Line 1 is the insight or counterintuitive finding.\n${linkNote(false)}\n\nReturn JSON {"html":"..."}`,
      system,
      { temperature: 0.75, tier: "writer", sticky },
    );
    progress.intro = stripFence(out.html);
    await persist();
  }

  for (let i = progress.sections.length; i < outline.length; i++) {
    const isLast = i === outline.length - 1;
    const previous = progress.sections.length ? progress.sections[progress.sections.length - 1] : progress.intro;
    const out = await json<{ html: string }>(
      `${context}

WRITTEN SO FAR (headings): ${outline.slice(0, i).join(" | ") || "opening only"}
PREVIOUS PART (continue from it, don't repeat it):
${previous}

Write ONLY the section "<h2>${outline[i]}</h2>", about ${sectionWords} words, starting with that <h2>.${isLast ? " This is the final section: don't summarise; end with the next logical action or a natural service-page transition." : ""}
${linkNote(isLast)}

Return JSON {"html":"..."}`,
      system,
      { temperature: 0.75, tier: "writer", sticky },
    );
    progress.sections.push(ensureHeading(out.html, outline[i]));
    await persist();
  }

  const body = [progress.intro, ...progress.sections].join("\n\n");
  const meta = await json<{ title: string; seo_title: string; seo_description: string; excerpt: string; unsupported_claims: string[] }>(
    `Finish this article.

QUERY: ${post.seo_plan?.targetQuery}
${factsBlock(facts)}

ARTICLE:
${body}

1. Write its metadata: title (≤ 60 chars, includes the query naturally), seo_title (≤ 60 chars), seo_description (120–160 chars, specific benefit), excerpt (1–2 sentences).
2. List every specific number or client result stated as the studio's own experience that is NOT in the VERIFIED FACTS list. General technical facts (API names, version numbers, documented limits) don't count. Empty array if none.

Return JSON {"title":"","seo_title":"","seo_description":"","excerpt":"","unsupported_claims":[]}`,
    AGENT,
    { temperature: 0.3 },
  );

  const seoPlan = { ...post.seo_plan };
  delete seoPlan.draftProgress;
  const claims = (meta.unsupported_claims ?? []).slice(0, 10);
  const version = await saveVersion(post, body, "Agent draft", {
    title: meta.title,
    seo_title: meta.seo_title,
    seo_description: meta.seo_description,
    excerpt: meta.excerpt,
    stage: "draft",
    word_count: wordCount(body),
    reading_minutes: Math.max(1, Math.round(wordCount(body) / 200)),
    seo_plan: { ...seoPlan, unsupportedClaims: claims },
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

  await enqueue(post.cover_image_url ? "run_audit" : "generate_image", { postId });
  return { words: wordCount(body) };
}
