import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { formatPostDate, getPublishedPosts } from "@/lib/blog";
import { ORGANIZATION_ID, breadcrumbSchema, graph } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: "Blog — Web Engineering, Performance & SEO", description: "Practical writing from PizzaScript on React and Next.js engineering, web performance, technical SEO and case studies from real client builds.", path: "/blog" });

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
          {
            "@type": "Blog",
            "@id": absoluteUrl("/blog#blog"),
            url: absoluteUrl("/blog"),
            name: "PizzaScript Blog",
            publisher: { "@id": ORGANIZATION_ID },
            blogPost: posts.map((post) => ({
              "@type": "BlogPosting",
              headline: post.title,
              url: absoluteUrl(`/blog/${post.slug}`),
              datePublished: post.publishedAt,
            })),
          },
        )}
      />

      <div className="min-h-screen pt-40 lg:pt-52 pb-16 px-4 md:px-12 lg:px-24 text-cream relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-16">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />

          <header className="max-w-3xl">
            <p className="cin-eyebrow text-xs tracking-widest block uppercase mb-2">{"// The Journal"}</p>
            <h1 className="cin-heading text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-tight">
              Notes from the <span className="italic text-oven-orange">Kitchen</span>
            </h1>
            <p className="cin-text text-stone-300 text-base mt-6 leading-relaxed">
              Engineering write-ups on performance, technical SEO, animation and the real projects we ship.
            </p>
          </header>

          {posts.length === 0 ? (
            <p className="svc-panel text-stone-300">New articles are in the oven. Check back soon.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, index) => (
                <li key={post.slug} className="flex">
                  <article className="glass-card rounded-xl flex flex-col w-full overflow-hidden group relative">
                    {post.coverImageUrl && (
                      <div className="relative aspect-[16/9] overflow-hidden rounded-lg mb-5">
                        <Image
                          src={post.coverImageUrl}
                          alt={post.coverImageAlt ?? ""}
                          fill
                          priority={index < 3}
                          sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                    )}
                    <div className="flex flex-col flex-grow">
                      <p className="font-mono text-xs text-oven-orange uppercase tracking-wider mb-2">
                        {post.category ?? "Engineering"}
                      </p>
                      <h2 className="font-headline-sm text-xl text-cream mb-3 leading-snug">
                        <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-oven-orange transition-colors">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="text-sm text-stone-300 leading-relaxed mb-6 flex-grow">{post.excerpt}</p>
                      <p className="font-mono text-xs text-stone-400">
                        <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
                        {post.readingMinutes && <> · {post.readingMinutes} min read</>}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
