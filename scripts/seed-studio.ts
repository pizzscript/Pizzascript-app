/**
 * Converts the markdown state in ../blogs/automation into Studio rows.
 *
 *   npm run seed:studio              # writes supabase/seed/studio.json (also used as the admin preview dataset)
 *   npm run seed:studio -- --write   # upserts into Supabase (run after migrations + migrate:blog)
 *
 * --write needs SUPABASE_URL, SUPABASE_SECRET_KEY and ADMIN_EMAIL.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CASE_STUDIES } from "../src/data/portfolio";
import { readLegacyBlog } from "./lib/legacy-blog";

const AUTOMATION = path.resolve("../blogs/automation");
const LEGACY_BLOG = path.resolve("../blogs/blog");
const OUT = path.resolve("supabase/seed/studio.json");
const WRITE = process.argv.includes("--write");

const id = (...parts: string[]) => {
  const h = createHash("sha1").update(parts.join(":")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// AGENT.md Part 6 cluster architecture.
const CLUSTERS = [
  { id: "custom-builds", name: "Web Development & Custom Builds", short: "Custom Builds", audience: "client", target_t1: 60 },
  { id: "performance", name: "Web Performance Optimization", short: "Performance", audience: "both", target_t1: 70 },
  { id: "tech-seo", name: "Technical SEO for JS Sites", short: "Tech SEO", audience: "both", target_t1: 65 },
  { id: "scroll-motion", name: "Scroll, Animation & Interactive", short: "Scroll/Motion", audience: "client", target_t1: 60 },
  { id: "ai-workflows", name: "AI-Assisted Web Development", short: "AI Workflows", audience: "both", target_t1: 80 },
  { id: "deployment", name: "Deployment & Infrastructure", short: "Deployment", audience: "developer", target_t1: 65 },
  { id: "case-studies", name: "Case Studies & Project Results", short: "Case Studies", audience: "client", target_t1: 0 },
] as const;

const clusterFor = (label: string | undefined) => {
  if (!label) return null;
  const l = label.toLowerCase();
  return (
    CLUSTERS.find((c) => c.name.toLowerCase() === l || c.short.toLowerCase() === l || c.name.toLowerCase().startsWith(l))?.id ??
    (l.includes("case") ? "case-studies" : l.includes("custom") ? "custom-builds" : null)
  );
};

function table(markdown: string): Record<string, string>[] {
  const rows = markdown.split("\n").filter((line) => line.trim().startsWith("|") && !/^\|\s*-/.test(line.trim()));
  const [head, ...body] = rows.map((line) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim().replace(/^`|`$/g, "")),
  );
  return body.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""])));
}

const read = (file: string) => fs.readFile(path.join(AUTOMATION, file), "utf8").then((s) => s.replace(/\r\n/g, "\n"));

const VOLUME: Record<string, number> = { low: 30, med: 60, medium: 60, high: 85 };

function istNineAm(daysFromToday: number) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const date = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysFromToday, 3, 30));
  return date.toISOString();
}

const humanize = (slug: string) => slug.split("-").map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

async function main() {
  const legacy = await readLegacyBlog(LEGACY_BLOG);
  const schedule = table(await read("BATCH/SCHEDULE.md"));
  const linkMap = table(await read("BATCH/LINK-MAP.md"));
  const keywordRows: (Record<string, string> & { track: number })[] = [
    ...table(await read("KEYWORDS/TRACK1.md")).map((r) => Object.assign(r, { track: 1 })),
    ...table(await read("KEYWORDS/TRACK2.md")).map((r) => Object.assign(r, { track: 2 })),
  ];

  const batchId = id("batch", "2");
  const batches = [{ id: batchId, name: "Batch 2", approved_at: null, created_at: new Date().toISOString() }];

  // ── Topics: union of both keyword files, matched to real posts / schedule slots by query.
  const topics = new Map<string, Record<string, unknown>>();
  const byQuery = (q: string) => q.toLowerCase().trim();
  const postByQuery = new Map(legacy.map((p) => [byQuery(String(p.frontMatter.targetQuery ?? "")), p]));
  const slotByQuery = new Map(schedule.map((s) => [byQuery(s["Primary Query"]), s]));

  for (const row of keywordRows) {
    const query = row["Target Query"];
    const key = byQuery(query);
    if (topics.has(key)) continue;
    const post = postByQuery.get(key);
    const slot = slotByQuery.get(key);
    const slug = post?.slug ?? slot?.["Target Slug"] ?? row["Targeted Article Slug"];
    const track = Number(post?.frontMatter.track ?? (slot ? (slot.Track.includes("2") ? 2 : 1) : row.track));
    topics.set(key, {
      id: id("topic", slug),
      slug,
      query,
      cluster_id: clusterFor(row.Cluster),
      track,
      role: (post?.frontMatter.type as string) ?? (slug.startsWith("case-study") ? "case-study" : "spoke"),
      intent: (post?.frontMatter.intent as string) ?? null,
      audience: (post?.frontMatter.audience as string) ?? null,
      scores: {
        volume: { value: VOLUME[row.Vol.toLowerCase()] ?? 50, reason: `Keyword file: ${row.Vol} volume` },
        difficulty: { value: Number(row.Diff) || 50, reason: "Keyword file difficulty" },
        caseStudy: slug.startsWith("case-study"),
      },
      score: null,
      priority: null,
      filters: {},
      status: post ? "published" : slot ? "in_production" : row.Status === "Queued" ? "approved" : "candidate",
      reason: null,
      source: "seed",
    });
  }
  for (const slot of schedule) {
    const key = byQuery(slot["Primary Query"]);
    if (topics.has(key)) continue;
    topics.set(key, {
      id: id("topic", slot["Target Slug"]),
      slug: slot["Target Slug"],
      query: slot["Primary Query"],
      cluster_id: clusterFor(slot.Cluster),
      track: slot.Track.includes("2") ? 2 : 1,
      role: "spoke",
      intent: null,
      audience: null,
      scores: {},
      score: null,
      priority: null,
      filters: {},
      status: slot.Status === "published" ? "published" : "in_production",
      reason: null,
      source: "seed",
    });
  }
  const topicBySlug = new Map([...topics.values()].map((t) => [t.slug as string, t]));

  // ── Posts: live posts get production metadata; pending batch slots become brief-stage tickets.
  const posts: Record<string, unknown>[] = legacy.map((p) => ({
    id: id("post", p.slug),
    ...p.row,
    cover_image_url: null,
    topic_id: (topicBySlug.get(p.slug)?.id as string) ?? null,
    cluster_id: clusterFor(String(p.frontMatter.cluster ?? "")),
    track: Number(p.frontMatter.track) || null,
    role: (p.frontMatter.type as string) ?? null,
    stage: "live",
    batch_id: p.slug === "custom-web-development-pune" ? batchId : null,
    scheduled_for: null,
    approved_at: p.row.published_at,
    brief: {
      servicePage: String(p.frontMatter.servicePageLink ?? "").replace("https://www.pizzascript.com", "") || undefined,
      audience: p.frontMatter.audience,
      depth: p.frontMatter.depth,
    },
    audit: null,
    image_prompt: null,
    version: 1,
  }));

  let day = 1;
  for (const slot of schedule.filter((s) => s.Status !== "published")) {
    const slug = slot["Target Slug"];
    const topic = topicBySlug.get(slug);
    const links = linkMap.find((l) => l.Slug === slug);
    posts.push({
      id: id("post", slug),
      slug,
      status: "draft",
      title: humanize(slug),
      excerpt: "",
      body_html: "",
      cover_image_alt: null,
      cover_image_url: null,
      seo_title: null,
      seo_description: null,
      og_image_url: null,
      category: CLUSTERS.find((c) => c.id === clusterFor(slot.Cluster))?.name ?? null,
      tags: [],
      reading_minutes: null,
      word_count: null,
      seo_plan: { targetQuery: slot["Primary Query"] },
      published_at: null,
      topic_id: (topic?.id as string) ?? null,
      cluster_id: clusterFor(slot.Cluster),
      track: slot.Track.includes("2") ? 2 : 1,
      role: (topic?.role as string) ?? "spoke",
      stage: "brief",
      batch_id: batchId,
      // The original July/August dates have passed; keep the order, one per day from tomorrow.
      scheduled_for: istNineAm(day++),
      approved_at: null,
      brief: {
        servicePage: links?.["Service Page Link"] && links["Service Page Link"] !== "None" ? links["Service Page Link"] : undefined,
        linksTo:
          links?.["Links To"] && links["Links To"] !== "None"
            ? links["Links To"].split(",").map((l) => l.trim().replace(/`/g, "")).map((l) => (l.startsWith("/") ? l : `/blog/${l}`))
            : [],
      },
      audit: null,
      image_prompt: null,
      version: 0,
    });
  }

  // ── Planned links (LINK-MAP "Links To" + service page column).
  const linkPlan: Record<string, unknown>[] = [];
  for (const row of linkMap) {
    const targets = [
      ...(row["Links To"] && row["Links To"] !== "None" ? row["Links To"].split(",") : []),
      ...(row["Service Page Link"] && row["Service Page Link"] !== "None" ? [row["Service Page Link"]] : []),
    ]
      .map((t) => t.trim().replace(/`/g, ""))
      .filter(Boolean)
      .map((t) => (t.startsWith("/") ? t : `/blog/${t}`));
    for (const to of targets) {
      linkPlan.push({ id: id("link", row.Slug, to), from_slug: row.Slug, to_path: to, anchor: null, status: "planned" });
    }
  }

  // ── Facts the agent may cite. Mirrors the case-study pages; confirm before relying on them.
  const facts = CASE_STUDIES.flatMap((study) =>
    study.results.map((statement) => ({
      id: id("fact", study.slug, statement),
      subject: study.name,
      statement,
      source: `/portfolio/${study.slug} (unverified — confirm with client data)`,
    })),
  );

  // ── Signals from the last GSC logs: page-one pages that get impressions but no clicks.
  const signals: Record<string, unknown>[] = [];
  const signalSlugs = new Map<string, string>(); // signal id -> post slug, resolved to a real post_id at write-time
  for (const file of ["LOGS/GSC-BLOG.md", "LOGS/GSC-MAIN.md"]) {
    const pages = table((await read(file)).split("## Top Pages")[1] ?? "");
    for (const page of pages) {
      const impressions = Number(page.Impressions);
      const position = Number(page.Position);
      const ctr = parseFloat(page.CTR);
      const slug = page.Page.match(/^\/blog\/([a-z0-9-]+)/)?.[1];
      if (!slug || impressions < 20 || position > 10 || ctr >= 2) continue;
      const signalId = id("signal", "low_ctr", slug);
      signalSlugs.set(signalId, slug);
      signals.push({
        id: signalId,
        kind: "low_ctr",
        title: `${slug} ranks #${Math.round(position)} but gets ${ctr}% CTR on ${impressions} impressions`,
        detail: { page: page.Page, impressions, position, ctr },
        priority: "P1",
        // Placeholder — live posts get a DB-generated id from migrate-blog.ts, not this deterministic hash.
        // Resolved to the real post id by slug just before the --write upsert below.
        post_id: id("post", slug),
        topic_id: null,
        status: "open",
        dedupe_key: `low_ctr:${slug}`,
      });
    }
  }

  const seed = {
    generatedAt: new Date().toISOString(),
    clusters: CLUSTERS.map(({ id, name, audience, target_t1 }, position) => ({ id, name, audience, target_t1, position })),
    batches,
    topics: [...topics.values()],
    posts,
    link_plan: linkPlan,
    facts,
    signals,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(seed, null, 2));
  console.log(
    `clusters ${seed.clusters.length} · topics ${seed.topics.length} · posts ${posts.length} (${posts.length - legacy.length} planned) · links ${linkPlan.length} · facts ${facts.length} · signals ${signals.length}`,
  );
  console.log(`Wrote ${OUT}`);

  if (!WRITE) return;
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_EMAIL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !ADMIN_EMAIL) throw new Error("--write needs SUPABASE_URL, SUPABASE_SECRET_KEY and ADMIN_EMAIL");
  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const upsert = async (tableName: string, rows: object[], onConflict = "id") => {
    if (rows.length === 0) return;
    const { error } = await db.from(tableName).upsert(rows, { onConflict });
    if (error) throw new Error(`${tableName}: ${error.message}`);
    console.log(`upserted ${tableName} (${rows.length})`);
  };

  await upsert("admins", [{ email: ADMIN_EMAIL.toLowerCase() }], "email");
  await upsert("clusters", seed.clusters);
  await upsert("batches", batches);
  await upsert("topics", seed.topics, "slug");

  // Live posts already exist from migrate:blog (with cover URLs); only attach production metadata to them.
  for (const post of posts.filter((p) => p.stage === "live")) {
    const { error } = await db
      .from("posts")
      .update({
        topic_id: post.topic_id,
        cluster_id: post.cluster_id,
        track: post.track,
        role: post.role,
        stage: "live",
        batch_id: post.batch_id,
        approved_at: post.approved_at,
        brief: post.brief,
      })
      .eq("slug", post.slug as string);
    if (error) throw new Error(`posts ${post.slug}: ${error.message}`);
  }
  await upsert(
    "posts",
    posts.filter((p) => p.stage !== "live"),
    "slug",
  );
  await upsert("link_plan", linkPlan, "from_slug,to_path");
  await upsert("facts", facts);

  if (signals.length > 0) {
    const slugs = [...new Set(signalSlugs.values())];
    const { data: rows, error } = await db.from("posts").select("id,slug").in("slug", slugs);
    if (error) throw new Error(`signals: resolving post ids: ${error.message}`);
    const postIdBySlug = new Map((rows ?? []).map((r) => [r.slug as string, r.id as string]));
    const resolved = signals
      .map((s) => {
        const slug = signalSlugs.get(s.id as string);
        const postId = slug ? postIdBySlug.get(slug) : undefined;
        return postId ? { ...s, post_id: postId } : null;
      })
      .filter((s): s is Record<string, unknown> => s !== null);
    const skipped = signals.length - resolved.length;
    if (skipped > 0) console.log(`  (skipped ${skipped} signal(s) — post not found in DB yet)`);
    await upsert("signals", resolved, "dedupe_key");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
