import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { CASE_STUDIES, getCaseStudy } from "@/data/portfolio";
import { pageMetadata } from "@/lib/metadata";
import { ORGANIZATION_ID, breadcrumbSchema, graph } from "@/lib/schema";
import { absoluteUrl } from "@/lib/site";

export function generateStaticParams() {
  return CASE_STUDIES.map((study) => ({ slug: study.slug }));
}

export async function generateMetadata({ params }: PageProps<"/portfolio/[slug]">): Promise<Metadata> {
  const study = getCaseStudy((await params).slug);
  if (!study) return {};
  return pageMetadata({
    title: study.seoTitle,
    description: study.seoDescription,
    path: `/portfolio/${study.slug}`,
    openGraph: { type: "article", images: [{ url: study.screenshot, width: 1440, height: 900, alt: study.screenshotAlt }] },
  });
}

export default async function CaseStudyPage({ params }: PageProps<"/portfolio/[slug]">) {
  const study = getCaseStudy((await params).slug);
  if (!study) notFound();
  const path = `/portfolio/${study.slug}`;

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Portfolio", path: "/portfolio" },
            { name: study.name, path },
          ]),
          {
            "@type": "CreativeWork",
            name: `${study.name} — ${study.category}`,
            description: study.seoDescription,
            url: absoluteUrl(path),
            image: absoluteUrl(study.screenshot),
            creator: { "@id": ORGANIZATION_ID },
            about: { "@type": "Organization", name: study.client, url: study.liveUrl },
            keywords: study.tags.join(", "),
          },
        )}
      />

      <div className="min-h-screen pt-36 lg:pt-44 pb-16 px-4 md:px-12 lg:px-24 text-cream relative z-10">
        <article className="max-w-6xl mx-auto">
          <Breadcrumbs
            className="mb-8"
            items={[{ name: "Home", href: "/" }, { name: "Portfolio", href: "/portfolio" }, { name: study.name }]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7 space-y-6">
              <p className="cin-eyebrow text-xs tracking-widest block uppercase">{`// ${study.category}`}</p>
              <h1 className="cin-heading text-3xl md:text-4xl lg:text-5xl font-serif font-bold leading-tight">
                {study.name} <span className="italic text-oven-orange">Case Study</span>
              </h1>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-y border-white/5 font-mono text-xs">
                <div>
                  <dt className="text-stone-400 uppercase">Client</dt>
                  <dd className="text-stone-200 font-bold mt-1">{study.client}</dd>
                </div>
                <div>
                  <dt className="text-stone-400 uppercase">Duration</dt>
                  <dd className="text-stone-200 font-bold mt-1">{study.duration}</dd>
                </div>
                <div>
                  <dt className="text-stone-400 uppercase">Key Metric</dt>
                  <dd className="text-oven-orange font-bold mt-1">{study.metric}</dd>
                </div>
                <div>
                  <dt className="text-stone-400 uppercase">Live Site</dt>
                  <dd className="mt-1">
                    <a href={study.liveUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 font-bold hover:underline">
                      Visit <span aria-hidden="true">↗</span>
                      <span className="sr-only"> {study.name} (opens in a new tab)</span>
                    </a>
                  </dd>
                </div>
              </dl>

              <div className="pt-2">
                <h2 className="text-xs font-mono text-stone-400 uppercase tracking-widest mb-3">Technologies Deployed</h2>
                <ul className="flex flex-wrap gap-2">
                  {study.tags.map((tag) => (
                    <li key={tag} className="portfolio-tag">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="visual-container relative aspect-[16/10] overflow-hidden">
                <Image
                  src={study.screenshot}
                  alt={study.screenshotAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 460px, 100vw"
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-20 border-t border-white/5 pt-12">
            <section className="blueprint-card p-8">
              <h2 className="text-2xl font-serif font-bold text-cream mb-4">The Engineering Challenge</h2>
              <p className="text-stone-300 text-sm leading-relaxed">{study.challenge}</p>
            </section>
            <section className="blueprint-card p-8">
              <h2 className="text-2xl font-serif font-bold text-cream mb-4">Our Solution Strategy</h2>
              <p className="text-stone-300 text-sm leading-relaxed">{study.solution}</p>
            </section>
          </div>

          <section className="mt-16 blueprint-card p-8">
            <h2 className="text-2xl font-serif font-bold text-cream mb-6">Measurable Performance Results</h2>
            <ul className="space-y-4">
              {study.results.map((result) => (
                <li key={result} className="flex items-start gap-3 text-stone-200">
                  <span className="text-oven-orange font-mono font-bold mt-0.5" aria-hidden="true">
                    {"//"}
                  </span>
                  <span className="text-sm leading-relaxed">{result}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-24 pt-8 border-t border-white/5 flex flex-wrap gap-4 justify-between items-center">
            <Link href="/portfolio" className="text-stone-300 hover:text-cream font-mono text-xs">
              <span aria-hidden="true">←</span> BACK TO PORTFOLIO
            </Link>
            <Link
              href="/#order"
              className="bg-oven-orange hover:bg-oven-orange/95 text-black font-semibold font-mono text-xs px-6 py-3.5 rounded-lg transition-colors uppercase tracking-wider"
            >
              Start A Project
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
