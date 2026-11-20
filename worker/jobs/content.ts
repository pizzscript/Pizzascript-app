import { auditPost, internalLinks, joinSections, plainText, splitSections, wordCount, wordRangeFor } from "../../src/lib/studio/content";
import { computeScore, priorityFor } from "../../src/lib/studio/scoring";
import type { Brief, RewritePayload, StudioPost, Topic, TopicFilters, TopicScores } from "../../src/lib/studio/types";
import { allClusters, allFacts, allPosts, allTopics, check, db, enqueue, getPost, linkPlan, raiseSignal, saveVersion, settings } from "../db";
import { makePoster } from "../poster";
import { json } from "../gemini";
import { AGENT, FILTERS, HTML_FORMAT, IMAGE_PROTOCOL, SERVICE_PAGES, STRATEGY, WRITING, factsBlock } from "../rules";
import { revalidate } from "./publish";

const BUCKET = "blog-images";

function inventory(posts: StudioPost[], topics: Topic[]) {
  const live = posts.filter((p) => p.stage === "live").map((p) => `- /blog/${p.slug} | T${p.track ?? "?"} ${p.role ?? "spoke"} | "${p.title}" | query: ${p.seo_plan?.targetQuery ?? "?"}`);
  const planned = topics
    .filter((t) => t.status === "approved" || t.status === "in_production")
    .map((t) => `- ${t.slug} | T${t.track} | query: ${t.query}`);
  return `PUBLISHED ARTICLES:\n${live.join("\n") || "none"}\n\nPLANNED/IN PRODUCTION:\n${planned.join("\n") || "none"}`;
}

// ───────────────────────── score_topic ─────────────────────────

export async function scoreTopic({ topicId }: { topicId: string }) {
  const [topic, posts, topics, clusters, neverCover, scoring] = await Promise.all([
    check(await db.from("topics").select("*").eq("id", topicId).single(), "topic") as Topic,
    allPosts(),
    allTopics(),
    allClusters(),
    settings.neverCover(),
    settings.scoring(),
  ]);
  const cluster = clusters.find((c) => c.id === topic.cluster_id);

  const result = await json<{
    scores: Record<"authority" | "intent" | "volume" | "backlink" | "difficulty" | "internalLink", { value: number; reason: string }>;
    caseStudy: boolean;
    intent: "informational" | "commercial" | "transactional";
    audience: "client" | "developer" | "both";
    role: "pillar" | "spoke" | "edge" | "case-study" | "trend";
    filters: TopicFilters;
    research: { summary: string; angle: string; title: string; outline: string[]; competitors: string[] };
  }>(
    `Score this topic for pizzascript.com.

QUERY: ${topic.query}
TRACK: ${topic.track}
CLUSTER: ${cluster?.name ?? "unassigned"} (audience: ${cluster?.audience ?? "both"})
NEVER COVER: ${neverCover.join("; ") || "none"}

${inventory(posts.filter((p) => p.topic_id !== topic.id), topics.filter((t) => t.id !== topic.id))}

Score each factor 0–100 with a one-line reason:
- authority: how much this builds topical authority for the studio's clusters
- intent: match between searcher intent and what the studio sells
- volume: realistic search volume (use Google Search to sanity-check)
- backlink: likelihood of earning links
- difficulty: ranking difficulty (higher = harder)
- internalLink: how naturally it links into existing articles and service pages
caseStudy: true only if it is about real studio project results.
Then evaluate the five filters with pass/fail and a specific reason (name the overlapping article for cannibalism).

${FILTERS}

Also research the query with Google Search and write, for a busy studio owner in plain language:
- summary: 2–3 sentences on what currently ranks and what those articles miss
- angle: the one angle only this studio can write
- title: a working title ≤ 60 chars
- outline: 4–7 section headings
- competitors: up to 3 titles or domains of top-ranking pages

JSON shape: {"scores":{"authority":{"value":0,"reason":""},...},"caseStudy":false,"intent":"informational","audience":"both","role":"spoke","filters":{"uniqueness":{"pass":true,"reason":""},"depth":{...},"audience":{...},"cannibalism":{...},"demand":{...}},"research":{"summary":"","angle":"","title":"","outline":[],"competitors":[]}}`,
    `${AGENT}\n\n${STRATEGY}`,
    { search: true },
  );

  const scores: TopicScores = { ...result.scores, caseStudy: result.caseStudy };
  const { score } = computeScore(scores, topic.track, scoring);
  const failed = Object.entries(result.filters).filter(([, f]) => f && !f.pass);
  const priority = failed.length ? "P4" : priorityFor(score, scoring);
  check(
    await db
      .from("topics")
      .update({
        scores,
        score,
        priority,
        filters: result.filters,
        research: result.research,
        intent: result.intent,
        audience: result.audience,
        role: result.role,
        status: failed.length && topic.status === "candidate" ? "archived" : topic.status,
        reason: failed.length ? `Failed ${failed.map(([k]) => k).join(", ")}: ${failed[0][1]!.reason}` : null,
      })
      .eq("id", topicId),
    "topic update",
  );
  return { score, priority };
}

// ───────────────────────── write_brief ─────────────────────────

export async function writeBrief({ topicId, postId, auto }: { topicId?: string; postId?: string; auto?: boolean }) {
  let post = postId ? await getPost(postId) : null;
  const topicKey = topicId ?? post?.topic_id;
  const topic = topicKey ? (check(await db.from("topics").select("*").eq("id", topicKey).single(), "topic") as Topic) : null;
  if (!post && !topic) throw new Error("write_brief needs a topicId or postId");

  if (!post) {
    const existing = await db.from("posts").select("*").eq("topic_id", topic!.id).maybeSingle();
    post =
      (existing.data as StudioPost | null) ??
      (check(
        await db
          .from("posts")
          .insert({
            slug: topic!.slug,
            status: "draft",
            stage: "brief",
            title: topic!.query,
            body_html: "",
            topic_id: topic!.id,
            cluster_id: topic!.cluster_id,
            track: topic!.track,
            role: topic!.role,
            seo_plan: { targetQuery: topic!.query },
            version: 0,
          })
          .select("*")
          .single(),
        "create post",
      ) as StudioPost);
  }
  if (topic) await db.from("topics").update({ status: "in_production" }).eq("id", topic.id);
  // From an approved idea: let the pipeline carry this post through draft, banner and SEO check on its own.
  if (auto && !post.auto_pipeline) {
    await db.from("posts").update({ auto_pipeline: true }).eq("id", post.id);
    post.auto_pipeline = true;
  }

  const [posts, topics, facts, ranges, plan] = await Promise.all([allPosts(), allTopics(), allFacts(), settings.wordRanges(), linkPlan()]);
  const plannedLinks = plan.filter((l) => l.from_slug === post!.slug).map((l) => l.to_path);
  const wordRange = wordRangeFor(post, ranges);

  const brief = await json<Brief & { title: string; imageDecision: string }>(
    `Write the brief for this article. Confirm all eight pre-writing items.

QUERY: ${post.seo_plan?.targetQuery ?? topic?.query}
TRACK: ${post.track} · ROLE: ${post.role}
${topic?.research?.summary ? `RESEARCH (already done — build on it): ${JSON.stringify(topic.research)}` : ""}
WORD RANGE: ${wordRange[0]}–${wordRange[1]}
LINKS ALREADY PLANNED: ${[...(post.brief?.linksTo ?? []), ...plannedLinks].join(", ") || "none"}
SERVICE PAGES: ${SERVICE_PAGES.join(", ")}

${inventory(posts.filter((p) => p.id !== post!.id), topics)}

${factsBlock(facts)}

Return JSON: {"title":"working title ≤ 60 chars","angle":"one sentence: the unique angle only the studio can write","audience":"client|developer|both","depth":"A|B|C|D|E","servicePage":"/services/... (required for Track 2 and pillars)","linksTo":["/blog/slug", ...existing published articles only, satisfying the funnel],"outline":["h2 section titles in order"],"imageDecision":"category 1-5 and why, or 'no banner — reason'"}`,
    `${AGENT}\n\n${STRATEGY}\n\n${FILTERS}`,
  );

  const known = new Set(posts.filter((p) => p.stage === "live").map((p) => `/blog/${p.slug}`));
  const linksTo = [...new Set([...(post.brief?.linksTo ?? []), ...plannedLinks, ...(brief.linksTo ?? [])])].filter(
    (l) => known.has(l) || l.startsWith("/blog/") === false,
  );
  check(
    await db
      .from("posts")
      .update({
        title: post.title === topic?.query || !post.body_html ? brief.title : post.title,
        brief: { ...post.brief, ...brief, linksTo, wordRange, title: undefined, imageDecision: undefined },
        image_prompt: post.image_prompt ?? null,
      })
      .eq("id", post.id),
    "brief update",
  );
  return { postId: post.id };
}

// ───────────────────────── write_draft ─────────────────────────

export async function writeDraft({ postId }: { postId: string }) {
  const post = await getPost(postId);
  if (!post.brief?.angle) {
    await writeBrief({ postId });
    return writeDraft({ postId });
  }
  const [posts, facts, ranges] = await Promise.all([allPosts(), allFacts(), settings.wordRanges()]);
  const wordRange = post.brief.wordRange ?? wordRangeFor(post, ranges);
  const draft = await json<{
    title: string;
    seo_title: string;
    seo_description: string;
    excerpt: string;
    body_html: string;
    image_prompt: string | null;
    image_alt: string | null;
  }>(
    `Write the full article.

QUERY: ${post.seo_plan?.targetQuery}
TRACK ${post.track} · ${post.role} · audience ${post.brief.audience} · depth criterion ${post.brief.depth}
ANGLE: ${post.brief.angle}
OUTLINE: ${(post.brief.outline ?? []).join(" | ")}
WORD RANGE: ${wordRange[0]}–${wordRange[1]} words
MUST LINK TO (natural anchors, inside the body): ${[...(post.brief.linksTo ?? []), post.brief.servicePage].filter(Boolean).join(", ")}
OTHER PUBLISHED ARTICLES YOU MAY LINK: ${posts.filter((p) => p.stage === "live" && p.id !== post.id).map((p) => `/blog/${p.slug}`).join(", ")}

${factsBlock(facts)}

${WRITING}

${HTML_FORMAT}

${IMAGE_PROTOCOL}

Return JSON: {"title":"≤ 60 chars, includes the query naturally","seo_title":"≤ 60 chars","seo_description":"120–160 chars, specific benefit","excerpt":"1–2 sentences for cards and Open Graph","body_html":"...","image_prompt":"full banner prompt following the image protocol, or null if no image is the better choice","image_alt":"descriptive alt text, never 'AI generated image of'"}`,
    `${AGENT}\n\n${STRATEGY}`,
    { temperature: 0.75 },
  );

  await saveVersion(post, draft.body_html, "Agent draft", {
    title: draft.title,
    seo_title: draft.seo_title,
    seo_description: draft.seo_description,
    excerpt: draft.excerpt,
    image_prompt: draft.image_prompt,
    cover_image_alt: draft.image_alt,
    stage: "draft",
    word_count: wordCount(draft.body_html),
    reading_minutes: Math.max(1, Math.round(wordCount(draft.body_html) / 200)),
  } as Partial<StudioPost>);

  // Banner next (a designed poster — see worker/poster), unless the post already has one.
  await enqueue(post.cover_image_url ? "run_audit" : "generate_image", { postId });
  return { words: wordCount(draft.body_html) };
}

// ───────────────────────── rewrite ─────────────────────────

export async function rewrite(payload: RewritePayload) {
  const post = await getPost(payload.postId);
  const [facts, posts] = await Promise.all([allFacts(), allPosts()]);
  const context = `ARTICLE: "${post.title}" · query: ${post.seo_plan?.targetQuery} · T${post.track} · audience ${post.brief?.audience ?? "both"}
${factsBlock(facts)}
${WRITING}
${HTML_FORMAT}
Keep every existing internal link unless the instruction says otherwise. Published articles: ${posts.filter((p) => p.stage === "live").map((p) => `/blog/${p.slug}`).join(", ")}`;

  const sections = splitSections(post.body_html);
  let body: string;
  let note: string;

  if (payload.scope === "article") {
    const out = await json<{ body_html: string }>(
      `Rewrite the whole article.\nINSTRUCTION: ${payload.instruction}\n\nCURRENT BODY:\n${post.body_html}\n\nReturn JSON {"body_html":"..."}`,
      `${AGENT}\n\n${context}`,
    );
    body = out.body_html;
    note = `Article: ${payload.instruction}`;
  } else {
    const index =
      payload.scope === "section"
        ? payload.section ?? 0
        : sections.findIndex((s) => plainText(s.html).includes((payload.selection ?? "").replace(/\s+/g, " ").trim().slice(0, 80)));
    if (index < 0 || !sections[index]) throw new Error("Couldn't find the selected text — the article may have changed since you selected it.");
    const target = sections[index];
    const out = await json<{ html: string }>(
      payload.scope === "section"
        ? `Rewrite ONLY this section of the article. Keep its <h2> (you may sharpen the wording).\nINSTRUCTION: ${payload.instruction}\n\nSURROUNDING ARTICLE (for context, do not return it):\n${post.body_html}\n\nSECTION TO REWRITE:\n${target.html}\n\nReturn JSON {"html":"the rewritten section"}`
        : `Inside this section, change ONLY the passage quoted below; return the full section with everything else unchanged.\nINSTRUCTION: ${payload.instruction}\nPASSAGE: "${payload.selection}"\n\nSECTION:\n${target.html}\n\nReturn JSON {"html":"the full section with only that passage changed"}`,
      `${AGENT}\n\n${context}`,
    );
    sections[index] = { ...target, html: out.html };
    body = joinSections(sections);
    note = `${payload.scope === "section" ? `Section “${target.heading ?? "intro"}”` : "Selection"}: ${payload.instruction}`;
  }

  await saveVersion(post, body, note.slice(0, 200));
  await enqueue("run_audit", { postId: post.id });
  if (post.stage === "live") await revalidate(post.slug);
  return { note };
}

// ───────────────────────── insert_link ─────────────────────────

export async function insertLink({ fromSlug, toPath }: { fromSlug: string; toPath: string }) {
  const post = check(await db.from("posts").select("*").eq("slug", fromSlug).single(), "post") as StudioPost;
  if (internalLinks(post.body_html).some((l) => l.href === toPath)) {
    await db.from("link_plan").update({ status: "inserted" }).eq("from_slug", fromSlug).eq("to_path", toPath);
    return { already: true };
  }
  const target = toPath.startsWith("/blog/")
    ? ((await db.from("posts").select("title,excerpt").eq("slug", toPath.slice(6)).maybeSingle()).data as { title: string; excerpt: string } | null)
    : null;
  const out = await json<{ body_html: string; anchor: string }>(
    `Add ONE contextual internal link to ${toPath}${target ? ` ("${target.title}" — ${target.excerpt})` : ""} into this article.
Put it where it genuinely helps the reader, with a natural descriptive anchor (no "click here"). Change at most one sentence; return the full body otherwise identical.

BODY:
${post.body_html}

Return JSON {"body_html":"...","anchor":"the anchor text used"}`,
    AGENT,
    { temperature: 0.3 },
  );
  if (!internalLinks(out.body_html).some((l) => l.href === toPath)) throw new Error("The agent didn't insert the link; try again.");
  await saveVersion(post, out.body_html, `Link → ${toPath}`);
  await db.from("link_plan").upsert({ from_slug: fromSlug, to_path: toPath, anchor: out.anchor, status: "inserted" }, { onConflict: "from_slug,to_path" });
  await db.from("signals").update({ status: "acted" }).eq("dedupe_key", `backlink:${fromSlug}:${toPath}`);
  await enqueue("run_audit", { postId: post.id });
  if (post.stage === "live") await revalidate(post.slug);
  return { anchor: out.anchor };
}

// ───────────────────────── fix_title ─────────────────────────

export async function fixTitle({ postId }: { postId: string }) {
  const post = await getPost(postId);
  const { data: rows } = await db
    .from("gsc_daily")
    .select("query,impressions,clicks,position")
    .eq("page", `/blog/${post.slug}`)
    .gte("date", new Date(Date.now() + 5.5 * 3_600_000 - 28 * 86_400_000).toISOString().slice(0, 10)); // IST date
  const queries = Object.values(
    (rows ?? []).reduce<Record<string, { query: string; impressions: number }>>((acc, r) => {
      acc[r.query] = { query: r.query, impressions: (acc[r.query]?.impressions ?? 0) + r.impressions };
      return acc;
    }, {}),
  )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  const out = await json<{ seo_title: string; seo_description: string; why: string }>(
    `This article ranks on page one but searchers don't click. Rewrite its SEO title and meta description to earn the click for the queries it actually shows for, without clickbait or claims the article can't back up.

CURRENT TITLE: ${post.seo_title ?? post.title}
CURRENT DESCRIPTION: ${post.seo_description}
ARTICLE OPENING: ${plainText(post.body_html).slice(0, 600)}
TOP QUERIES (28 days): ${queries.map((q) => `${q.query} (${q.impressions})`).join("; ") || post.seo_plan?.targetQuery}

Return JSON {"seo_title":"≤ 60 chars","seo_description":"120–160 chars","why":"one sentence"}`,
    AGENT,
  );
  check(await db.from("posts").update({ seo_title: out.seo_title, seo_description: out.seo_description }).eq("id", postId), "title update");
  await db.from("agent_messages").insert({
    thread: `post:${postId}`,
    role: "agent",
    content: `Retitled for CTR.\nBefore: ${post.seo_title ?? post.title}\nAfter: ${out.seo_title}\n${out.why}`,
  });
  if (post.stage === "live") await revalidate(post.slug);
  return out;
}

// ───────────────────────── generate_image ─────────────────────────

/**
 * Designed banner: the AI art director picks the concept (comparison, code fix, metric, cost, case study or guide;
 * headline; tech logos; stat or snippet) and a fixed template renders it on the server — fonts, icons and layout are
 * bundled, so it needs no image model and still works (rule-based concept) when the Gemini quota is used up.
 */
export async function generateImage({ postId }: { postId: string; prompt?: string }) {
  const [post, clusters] = await Promise.all([getPost(postId), allClusters()]);
  const categoryName = clusters.find((c) => c.id === post.cluster_id)?.name ?? "PizzaScript Blog";
  const poster = await makePoster(post, categoryName);

  const objectPath = `${post.slug}/banner-${Date.now()}.webp`;
  const { error } = await db.storage.from(BUCKET).upload(objectPath, poster.webp, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`upload: ${error.message}`);
  const url = db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;

  check(
    await db
      .from("posts")
      .update({ cover_image_url: url, cover_image_alt: poster.alt, stage: post.stage === "draft" ? "image" : post.stage })
      .eq("id", postId),
    "banner update",
  );
  await enqueue("run_audit", { postId });
  if (post.stage === "live") await revalidate(post.slug);
  return { url, type: poster.plan.type, aiDirected: poster.ai };
}

// ───────────────────────── run_audit ─────────────────────────

export async function runAudit({ postId }: { postId: string }) {
  const [post, posts, banned, ranges, batches, autopilot] = await Promise.all([
    getPost(postId),
    allPosts(),
    settings.banned(),
    settings.wordRanges(),
    db.from("batches").select("id,approved_at"),
    settings.autopilot(),
  ]);
  if (!post.body_html) throw new Error("Nothing to audit yet — write the draft first.");
  const audit = auditPost(post, { posts, bannedPhrases: banned, wordRange: post.brief?.wordRange ?? wordRangeFor(post, ranges) });

  const batchApproved = (batches.data ?? []).some((b) => b.id === post.batch_id && b.approved_at);
  let stage = post.stage;
  if (audit.ok && ["draft", "image"].includes(stage)) stage = "audit";
  if (!audit.ok && stage === "slotted") stage = "audit";
  if (audit.ok && stage === "audit" && post.scheduled_for && (post.approved_at || batchApproved || autopilot)) stage = "slotted";

  check(await db.from("posts").update({ audit, stage }).eq("id", postId), "audit save");
  // Passing now clears any earlier "SEO check failed" alert for this post.
  if (audit.ok) await db.from("signals").update({ status: "acted" }).eq("dedupe_key", `audit:${post.id}`).eq("status", "open");
  if (!audit.ok && post.stage !== "live") {
    const failing = audit.checks.filter((c) => !c.pass);
    await db.from("signals").delete().eq("dedupe_key", `audit:${post.id}`);
    await raiseSignal({
      kind: "audit_failed",
      title: `${post.title}: ${failing.length} audit issue${failing.length > 1 ? "s" : ""} (${failing.map((c) => c.label.toLowerCase()).slice(0, 2).join(", ")})`,
      detail: { checks: failing },
      priority: post.scheduled_for && new Date(post.scheduled_for).getTime() - Date.now() < 2 * 86_400_000 ? "P1" : "P2",
      post_id: post.id,
      topic_id: post.topic_id,
      dedupe_key: `audit:${post.id}`,
    });
  } else {
    await db.from("signals").update({ status: "acted" }).eq("dedupe_key", `audit:${post.id}`);
  }
  return { ok: audit.ok, stage };
}
