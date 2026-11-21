import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { plainText } from "../../src/lib/studio/content";
import type { StudioPost, Topic } from "../../src/lib/studio/types";
import { allPosts, allTopics, check, db } from "../db";

export const DUPLICATE_SIMILARITY = 0.82;
export const RELATED_SIMILARITY = 0.45;

export interface Match {
  owner_type: "post" | "topic";
  owner_id: string;
  similarity: number;
}

export function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "worker", "embed-child.mjs")], { stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => child.kill(), 180_000);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err = (err + d).slice(-500)));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`embedding process exited ${code}: ${err}`));
      try {
        resolve(JSON.parse(out) as number[][]);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(texts));
  });
}

export const postText = (p: Pick<StudioPost, "title" | "excerpt" | "body_html" | "seo_plan">) =>
  [p.seo_plan?.targetQuery, p.title, p.excerpt, plainText(p.body_html).slice(0, 1200)].filter(Boolean).join(". ");

export const topicText = (t: Pick<Topic, "query" | "research">) => [t.query, t.research?.title, t.research?.angle].filter(Boolean).join(". ");

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

async function store(rows: { owner_type: "post" | "topic"; owner_id: string; text: string }[]) {
  if (!rows.length) return;
  const vectors = await embed(rows.map((r) => r.text));
  check(
    await db.from("content_embeddings").upsert(
      rows.map((r, i) => ({
        owner_type: r.owner_type,
        owner_id: r.owner_id,
        content_hash: hash(r.text),
        embedding: JSON.stringify(vectors[i]),
        updated_at: new Date().toISOString(),
      })),
    ),
    "embeddings",
  );
}

/** Embeds only what changed since the last run, so a quiet day costs nothing. */
export async function syncEmbeddings() {
  const [posts, topics, existing] = await Promise.all([
    allPosts(),
    allTopics(),
    db.from("content_embeddings").select("owner_id,content_hash"),
  ]);
  const known = new Map((existing.data ?? []).map((e) => [e.owner_id as string, e.content_hash as string]));
  const rows = [
    ...posts.filter((p) => p.body_html).map((p) => ({ owner_type: "post" as const, owner_id: p.id, text: postText(p) })),
    ...topics
      .filter((t) => !["rejected", "archived", "published"].includes(t.status))
      .map((t) => ({ owner_type: "topic" as const, owner_id: t.id, text: topicText(t) })),
  ].filter((r) => known.get(r.owner_id) !== hash(r.text));
  await store(rows);
  return rows.length;
}

export async function matchesFor(owner_type: "post" | "topic", owner_id: string, text: string, count = 5): Promise<Match[]> {
  await store([{ owner_type, owner_id, text }]);
  return storedMatches(owner_type, owner_id, count);
}

/** Uses the saved vector only, so it also works on the publish runner, which doesn't load the model. */
export async function storedMatches(owner_type: "post" | "topic", owner_id: string, count = 5): Promise<Match[]> {
  const { data } = await db.from("content_embeddings").select("embedding").eq("owner_type", owner_type).eq("owner_id", owner_id).maybeSingle();
  if (!data) return [];
  const { data: matches, error } = await db.rpc("match_content", { query_embedding: data.embedding, exclude_id: owner_id, match_count: count });
  if (error) throw new Error(`match_content: ${error.message}`);
  return (matches ?? []) as Match[];
}
