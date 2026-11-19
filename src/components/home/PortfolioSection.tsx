import Link from "next/link";
import { PortfolioCard } from "@/components/PortfolioCard";
import { CASE_STUDIES } from "@/data/portfolio";

export function PortfolioSection() {
  return (
    <section id="chef-specials" className="section" aria-labelledby="chef-specials-title">
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
          <p className="cin-eyebrow" style={{ justifyContent: "center" }}>
            <span aria-hidden="true" style={{ width: 32, height: 1, background: "var(--color-oven-orange)", display: "inline-block" }} />
            Our Work
          </p>
          <h2 id="chef-specials-title" className="section-title" data-animate="fade-up">
            Chef&apos;s Specials
          </h2>
          <p className="section-subtitle" data-animate="fade-up" data-animate-delay="1">
            Our finest creations. Made with love and late nights.
          </p>
        </div>

        <div className="portfolio-grid">
          {CASE_STUDIES.map((study, index) => (
            <PortfolioCard key={study.slug} study={study} delay={index + 1} />
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: 48 }}>
          <Link href="/portfolio" className="btn btn-secondary">
            View all case studies
          </Link>
        </p>
      </div>
    </section>
  );
}
