/**
 * Imports the legacy static blog (blogs/blog/blog/<slug>/index.html) into Supabase.
 *
 *   npm run migrate:blog -- --dry-run          # parse + print, no network
 *   npm run migrate:blog                        # upload banners + upsert posts
 *
 * Requires SUPABASE_URL and SUPABASE_SECRET_KEY (service role) in .env.local.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readLegacyBlog } from "./lib/legacy-blog";

const LEGACY_BLOG = path.resolve(process.argv.find((a) => a.startsWith("--source="))?.slice(9) ?? "../blogs/blog");
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "blog-images";

async function main() {
  const posts = await readLegacyBlog(LEGACY_BLOG);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!DRY_RUN && (!url || !key)) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY, or pass --dry-run.");
  const supabase = DRY_RUN ? null : createClient(url!, key!, { auth: { persistSession: false } });

  const rows = [];
  for (const post of posts) {
    let coverUrl: string | null = null;
    if (supabase) {
      const objectPath = `${post.slug}/banner.webp`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, await fs.readFile(post.bannerFile), { contentType: "image/webp", upsert: true });
      if (error) throw new Error(`${post.slug}: banner upload failed: ${error.message}`);
      coverUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
    }
    rows.push({ ...post.row, cover_image_url: coverUrl });
    console.log(`${DRY_RUN ? "[dry-run] " : ""}${post.slug}: ${post.row.word_count} words, category "${post.row.category}"`);
  }

  if (!supabase) {
    const out = path.resolve(".migrate-blog-preview.json");
    await fs.writeFile(out, JSON.stringify(rows, null, 2));
    console.log(`\nWrote ${rows.length} posts to ${out}`);
    return;
  }

  const { error } = await supabase.from("posts").upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`Upsert failed: ${error.message}`);
  console.log(`\nUpserted ${rows.length} posts. Run "npm run seed:studio -- --write" next.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
