import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock, Tag } from "lucide-react";
import { CodeCopyButtons } from "@/components/blog/CodeCopyButtons";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { formatPostDate, getPostBySlug, getPublishedPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { ORGANIZATION_ID, breadcrumbSchema, graph } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";

// Cache Components requires at least one param; the placeholder resolves to a 404 when the blog is empty.
const PLACEHOLDER = "__no-posts__";

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.length > 0 ? posts.map((post) => ({ slug: post.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await getPostBySlug((await params).slug);
  if (!post) return {};
  const image = post.ogImageUrl ?? post.coverImageUrl;
  return pageMetadata({
    title: post.seoTitle,
    description: post.seoDescription,
    path: `/blog/${post.slug}`,
    openGraph: {
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      ...(image ? { images: [{ url: image, alt: post.coverImageAlt ?? post.title }] } : {}),
    },
  });
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = (await getPublishedPosts()).filter((p) => p.slug !== post.slug).slice(0, 3);
  const path = `/blog/${post.slug}`;

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path },
          ]),
          {
            "@type": "BlogPosting",
            "@id": absoluteUrl(`${path}#article`),
            headline: post.title,
            description: post.seoDescription,
            image: post.coverImageUrl ?? undefined,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            author: { "@id": ORGANIZATION_ID },
            publisher: { "@id": ORGANIZATION_ID },
            mainEntityOfPage: absoluteUrl(path),
            articleSection: post.category ?? undefined,
            keywords: post.tags.join(", ") || undefined,
            wordCount: post.wordCount ?? undefined,
            inLanguage: "en-IN",
          },
        )}
      />

      <div className="min-h-screen pt-36 lg:pt-44 pb-16 px-4 md:px-12 lg:px-24 text-cream relative z-10">
        <article className="max-w-6xl mx-auto">
          <header className="mb-12">
            <Breadcrumbs className="mb-8" items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }, { name: post.title }]} />
            <h1 className="cin-heading text-3xl md:text-5xl font-serif font-bold leading-tight max-w-4xl">{post.title}</h1>
            <ul className="flex flex-wrap items-center gap-6 font-mono text-xs uppercase tracking-wider text-oven-orange mt-6">
              <li className="flex items-center gap-2">
                <Calendar size={16} aria-hidden="true" />
                <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
              </li>
              {post.readingMinutes && (
                <li className="flex items-center gap-2">
                  <Clock size={16} aria-hidden="true" />
                  {post.readingMinutes} min read
                </li>
              )}
              {post.category && (
                <li className="flex items-center gap-2">
                  <Tag size={16} aria-hidden="true" />
                  {post.category}
                </li>
              )}
            </ul>
            {post.coverImageUrl && (
              <div className="relative w-full aspect-video md:aspect-[21/9] overflow-hidden rounded-xl border border-white/10 mt-10">
                <Image
                  src={post.coverImageUrl}
                  alt={post.coverImageAlt ?? ""}
                  fill
                  priority
                  sizes="(min-width: 1152px) 1152px, 100vw"
                  className="object-cover"
                />
              </div>
            )}
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div
              id="post-body"
              className="prose-blog lg:col-span-8 svc-panel"
              dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
            />
            <CodeCopyButtons containerId="post-body" />

            <aside className="lg:col-span-4 space-y-8" aria-label="More from PizzaScript">
              <div className="glass-card p-6 rounded-lg">
                <h2 className="font-headline-sm text-xl text-cream mb-3">Need custom web engineering?</h2>
                <p className="text-sm text-stone-300 mb-6">
                  We build fast, secure websites and applications that load instantly and rank.
                </p>
                <Link
                  href="/#order"
                  className="block w-full text-center bg-oven-orange text-black py-3 rounded-lg font-bold hover:bg-oven-amber transition-colors"
                >
                  Start a project
                </Link>
              </div>

              {related.length > 0 && (
                <nav aria-label="Related articles" className="border-t border-white/10 pt-6">
                  <h2 className="font-mono text-xs text-stone-400 uppercase tracking-widest mb-4">Related articles</h2>
                  <ul className="space-y-4">
                    {related.map((item) => (
                      <li key={item.slug}>
                        <Link href={`/blog/${item.slug}`} className="group block">
                          <span className="block font-semibold text-cream group-hover:text-oven-orange transition-colors">
                            {item.title}
                          </span>
                          {item.category && <span className="text-xs text-stone-400">{item.category}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </aside>
          </div>
        </article>
      </div>
    </>
  );
}
