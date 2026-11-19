import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { PortfolioCard } from "@/components/PortfolioCard";
import { CASE_STUDIES } from "@/data/portfolio";
import { breadcrumbSchema, graph } from "@/lib/schema";

export const metadata: Metadata = pageMetadata({ title: "Portfolio & Case Studies", description: "Web engineering case studies from PizzaScript: custom educational and pharmaceutical websites rebuilt for speed, mobile responsiveness and search visibility.", path: "/portfolio" });

export default function PortfolioPage() {
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Portfolio", path: "/portfolio" },
          ]),
        )}
      />
      <div className="min-h-screen pt-40 lg:pt-52 pb-16 px-4 md:px-12 lg:px-24 text-cream relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col gap-16">
          <Breadcrumbs className="text-center md:text-left" items={[{ name: "Home", href: "/" }, { name: "Portfolio" }]} />

          <header className="text-center md:text-left max-w-3xl">
            <p className="cin-eyebrow text-xs tracking-widest block uppercase mb-2">{"// Case Studies"}</p>
            <h1 className="cin-heading text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-tight">
              Our Web <span className="italic text-oven-orange">Engineering</span> Portfolio
            </h1>
            <p className="cin-text text-stone-300 text-base mt-6 leading-relaxed">
              Explore the technical implementation reports for our projects. We detail our architectural decisions,
              Core Web Vitals improvements, and client results.
            </p>
          </header>

          <div className="portfolio-grid">
            {CASE_STUDIES.map((study, index) => (
              <PortfolioCard key={study.slug} study={study} headingLevel="h2" delay={index + 1} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
