import { Suspense } from "react";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { PostEditor } from "@/components/studio/PostEditor";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { SANITIZE_OPTIONS } from "@/lib/blog";
import { SERVICE_PATHS, auditPost, internalLinks, splitSections, wordRangeFor } from "@/lib/studio/content";
import { loadVersions } from "@/lib/studio/server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Edit post" };

async function Editor({ params }: { params: PageProps<"/admin/posts/[id]">["params"] }) {
  const [{ id }, { studio, data }] = await Promise.all([params, getStudio()]);
  const post = data.posts.find((p) => p.id === id);
  if (!post) notFound();

  const versions = await loadVersions(studio, post.id);
  const topic = data.topics.find((t) => t.id === post.topic_id) ?? null;
  // Article HTML is agent/admin written; sanitise before it renders inside the authenticated admin.
  const sections = splitSections(post.body_html).map((s) => ({ ...s, html: sanitizeHtml(s.html, SANITIZE_OPTIONS) }));
  const wordRange = post.brief?.wordRange ?? wordRangeFor(post, data.wordRanges);
  const audit = post.body_html ? auditPost(post, { posts: data.posts, bannedPhrases: data.bannedPhrases, wordRange }) : null;

  const present = new Set(internalLinks(post.body_html).map((l) => l.href));
  const required = [
    ...(post.brief.linksTo ?? []),
    ...(post.brief.servicePage ? [post.brief.servicePage] : []),
    ...data.linkPlan.filter((l) => l.from_slug === post.slug && l.status === "planned").map((l) => l.to_path),
  ];
  const links = [...new Set(required)].map((path) => ({ path, present: present.has(path), service: (SERVICE_PATHS as readonly string[]).includes(path) }));

  return (
    <PostEditor
      post={{ ...post, body_html: sanitizeHtml(post.body_html, SANITIZE_OPTIONS) }}
      sections={sections}
      topic={topic}
      clusters={data.clusters}
      audit={audit}
      links={links}
      versions={versions}
      facts={data.facts.filter((f) => f.verified)}
      messages={data.messages.filter((m) => m.thread === `post:${post.id}`)}
      wordRange={wordRange}
    />
  );
}

export default function EditPostPage(props: PageProps<"/admin/posts/[id]">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Editor params={props.params} />
    </Suspense>
  );
}
