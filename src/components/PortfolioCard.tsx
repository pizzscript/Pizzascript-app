import Image from "next/image";
import Link from "next/link";
import type { CaseStudy } from "@/data/portfolio";

export function PortfolioCard({
  study,
  headingLevel: Heading = "h3",
  delay,
}: {
  study: CaseStudy;
  headingLevel?: "h2" | "h3";
  delay?: number;
}) {
  const href = `/portfolio/${study.slug}`;
  return (
    <article className="portfolio-card" data-animate="fade-up" data-animate-delay={delay}>
      <Link href={href} className="portfolio-card__image" tabIndex={-1} aria-hidden="true">
        <Image
          src={study.screenshot}
          alt=""
          fill
          sizes="(min-width: 1024px) 560px, 100vw"
          className="portfolio-card__shot"
        />
      </Link>
      <div className="portfolio-card__body">
        <Heading className="portfolio-card__title">
          <Link href={href}>{study.name}</Link>
        </Heading>
        <p className="portfolio-card__desc">{study.summary}</p>
        <ul className="portfolio-card__tags" aria-label="Technologies">
          {study.tags.map((tag) => (
            <li key={tag} className="portfolio-tag">
              {tag}
            </li>
          ))}
        </ul>
        <div className="portfolio-card__meta">
          <span>⏱️ {study.duration}</span>
          <a href={study.liveUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-oven-orange)" }}>
            Visit live site <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </article>
  );
}
