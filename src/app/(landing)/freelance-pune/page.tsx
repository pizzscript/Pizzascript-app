import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Image from "next/image";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { BrandMark } from "@/components/BrandMark";
import { JsonLd } from "@/components/JsonLd";
import { HeroTypewriter } from "@/components/landing/HeroTypewriter";
import { LandingContactForm } from "@/components/landing/LandingContactForm";
import { LandingInteractions } from "@/components/landing/LandingInteractions";
import { LandingProjects } from "@/components/landing/LandingProjects";
import { WhatsAppBall } from "@/components/landing/WhatsAppBall";
import { WinBox, WinTitlebar } from "@/components/landing/WinBox";
import { CASE_STUDIES } from "@/data/portfolio";
import { getPublishedPosts } from "@/lib/blog";
import { ORGANIZATION_ID, breadcrumbSchema, faqSchema, graph } from "@/lib/schema";
import { SITE, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: "Freelance Web Developer & Web Software in Pune", description: "Custom websites, web applications and web software for startups and businesses in Pune. Clean code, technical SEO, no templates — from the PizzaScript studio.", path: "/freelance-pune" });

const FAQ_ITEMS = [
  {
    q: "Do you work with clients in Pune?",
    a: "Yes. PizzaScript is based in Pune and actively works with local startups, SMEs, and enterprises across the city. Fully remote collaboration is also available for clients across India and internationally.",
  },
  {
    q: "What is the difference between a website and web software?",
    a: "A website is a digital presence, informational or marketing-focused. Web software is a functional platform: SaaS tools, dashboards, booking systems, CRMs, custom portals, or internal applications. PizzaScript builds both.",
  },
  {
    q: "How long does a web development project take?",
    a: "Most websites ship in 3 to 5 weeks. Custom web software applications typically take 6 to 12 weeks depending on scope and complexity. A clear project timeline is defined and agreed upon before any development begins.",
  },
  {
    q: "Do you work with startups?",
    a: "Yes. PizzaScript regularly partners with early-stage startups and growing businesses in Pune. From MVPs to full product builds, every project starts with a clear scope and a realistic delivery timeline.",
  },
  {
    q: "Is SEO included in web development projects?",
    a: "Yes. Technical SEO is built into every project: semantic HTML structure, Core Web Vitals optimisation, meta tags, schema markup, and crawlability. Search visibility is never an afterthought.",
  },
  {
    q: "Can I hire you for a single project or ongoing work?",
    a: "Both. Fixed-scope projects and ongoing retainer arrangements are available for businesses that need continued development, feature updates, and maintenance support.",
  },
];

const HERO_HEADINGS = [
  "Freelance web development and custom web software, built in Pune, built to last.",
  "High-performance digital products built from scratch with clean, maintainable code.",
  "Product engineering from scope to launch, helping startups build MVPs that scale.",
  "Custom SaaS portals, booking engines, and databases built to streamline your business.",
];

const MARQUEE = ["React", "Next.js", "TypeScript", "Node.js", "Web Software", "Tailwind CSS", "Framer Motion", "Figma", "Technical SEO", "E-Commerce"];

const PROCESS = [
  {
    phase: "Discovery Phase",
    title: "Definition and Scope",
    desc: "You leave this phase with a clear project scope, defined timeline, and fixed cost — all agreed before a single line of code is written.",
    file: "discovery-phase.exe",
  },
  {
    phase: "Design Phase",
    title: "Prototyping and Layouts",
    desc: "Every layout and visual direction is approved by you before production development begins. No redesigns mid-build, no late surprises.",
    file: "design-phase.exe",
  },
  {
    phase: "Development Phase",
    title: "Clean Engineering",
    desc: "Your codebase is clean, documented, and fully owned by you. No lock-in, no proprietary builders — code written to last and easy to extend.",
    file: "development-phase.exe",
  },
  {
    phase: "Deployment Phase",
    title: "Launch and Audit",
    desc: "Your site or application goes live with complete performance and SEO audits already done. Post-launch support is included in every engagement.",
    file: "deployment-phase.exe",
  },
];

const SERVICES = [
  {
    file: "custom-web-apps.exe",
    tag: "Engineering",
    name: "Custom Web Applications",
    desc: "Maintainable web applications and software platforms built from the ground up using React, Next.js, and TypeScript, designed for Pune startups and growing businesses.",
  },
  {
    file: "technical-seo.exe",
    tag: "Visibility",
    name: "Technical SEO",
    desc: "Semantic structures, Core Web Vitals optimisation, and clean indexable architectures. Built to rank in Pune and across India without ongoing agency dependency.",
  },
  {
    file: "interface-design.exe",
    tag: "Design",
    name: "Interface Design",
    desc: "Functional, responsive design matched precisely to code execution. Design systems, accessible components, and clean layouts built to convert and perform.",
  },
  {
    file: "modern-commerce.exe",
    tag: "Commerce",
    name: "Modern Commerce",
    desc: "Headless Shopify, WooCommerce, and custom storefront builds. Faster load times, better Core Web Vitals, and checkout flows optimised for conversion.",
  },
];

const INDUSTRIES = [
  "IT & SaaS Startups",
  "Real Estate",
  "Healthcare & Clinics",
  "Education & EdTech",
  "Retail & E-Commerce",
  "Manufacturing & B2B",
  "Professional Services",
  "Hospitality & Events",
];

const ABOUT = [
  {
    file: "engineering.txt",
    title: "Custom Engineering",
    desc: "Every project is built from the ground up. React, Next.js, TypeScript, and Node.js — selected for the right reason, not because they are trendy. A codebase you own, understand, and can extend.",
  },
  {
    file: "pune-location.txt",
    title: "Pune-Based, India-Ready",
    desc: "Based in Pune with deep familiarity in the local business landscape. From Kothrud to Baner, Hinjewadi to Viman Nagar — available for in-person discovery sessions or fully remote collaboration.",
  },
  {
    file: "seo-core.txt",
    title: "SEO as a Core Discipline",
    desc: "Technical SEO is not a plugin or an afterthought. Semantic HTML, schema markup, Core Web Vitals, and crawl architecture are engineered into every project from day one.",
  },
  {
    file: "collaboration.txt",
    title: "Direct Collaboration",
    desc: "You work directly with the developer building your product. No account managers, no communication layers, no misunderstood briefs. Honest timelines, transparent pricing, and daily progress visibility.",
  },
];

const STATS = [
  { value: "5+", label: "Years Building", file: "years.log" },
  { value: "30+", label: "Projects Delivered", file: "projects.log" },
  { value: "95+", label: "Lighthouse Score Avg.", file: "lighthouse.log" },
  { value: "100%", label: "Code You Own", file: "ownership.log" },
];

const NAV = [
  ["process", "Process"],
  ["services", "Services"],
  ["work", "Work"],
  ["about", "About"],
  ["blog", "Blog"],
  ["faq", "FAQ"],
  ["contact", "Contact"],
] as const;

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

const delay = (i: number) => `fp-delay-${Math.min(i + 1, 3)}`;

export default async function FreelancePunePage() {
  const posts = (await getPublishedPosts()).slice(0, 4);

  return (
    <>
      <JsonLd
        data={graph(
          {
            "@type": "WebPage",
            "@id": absoluteUrl("/freelance-pune#webpage"),
            url: absoluteUrl("/freelance-pune"),
            name: "Freelance Web Developer & Web Software in Pune",
            about: { "@id": ORGANIZATION_ID },
            inLanguage: "en-IN",
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Freelance Web Developer Pune", path: "/freelance-pune" },
          ]),
          faqSchema(FAQ_ITEMS),
        )}
      />
      <LandingInteractions />

      <div className="fp-page">
        <header>
          <nav className="fp-nav" aria-label="Main">
            <div className="fp-container">
              <div className="fp-nav-inner">
                <Link href="/" className="fp-nav-logo" aria-label="PizzaScript home">
                  <BrandMark />
                  <span className="logo-text">PizzaScript</span>
                </Link>
                <ul className="fp-nav-links">
                  {NAV.map(([id, label]) => (
                    <li key={id}>
                      <a href={`#${id}`}>{label}</a>
                    </li>
                  ))}
                </ul>
                <a href="#contact" className="fp-nav-cta">
                  Start a Project
                </a>
              </div>
            </div>
          </nav>
        </header>

        <main id="main-content" tabIndex={-1}>
          <section className="fp-hero" aria-label="Introduction">
            <div className="fp-hero-inner">
              <div className="fp-container">
                <div className="fp-hero-content">
                  <div className="fp-hero-eyebrow fp-reveal">
                    <span className="fp-label">Freelance · Pune-based · Available for new projects</span>
                  </div>
                  <HeroTypewriter headings={HERO_HEADINGS} />
                  <p className="fp-hero-sub fp-reveal fp-delay-2">
                    Custom websites, web applications, and software platforms for startups and businesses. Based in Pune,
                    working with clients across India, Europe, and North America.
                  </p>
                  <div className="fp-hero-actions fp-reveal fp-delay-3">
                    <a href="#contact" className="fp-btn-primary">
                      Start a project conversation
                    </a>
                    <a href="#work" className="fp-btn-secondary">
                      View selected work
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="fp-crossing-marquees" aria-hidden="true">
              {["tape-1", "tape-2"].map((tape, t) => (
                <div className={`fp-marquee-tape ${tape}`} key={tape}>
                  <div className={`fp-marquee-track${t === 1 ? " reverse" : ""}`}>
                    {[...MARQUEE, ...MARQUEE].map((item, i) => (
                      <span key={i}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="fp-section" id="process" aria-labelledby="process-title">
            <div className="fp-container">
              <div className="fp-section-header fp-reveal">
                <div>
                  <span className="fp-label fp-mb-4">Methodology</span>
                  <h2 id="process-title" className="fp-headline">
                    Structured Process
                  </h2>
                </div>
                <p className="fp-body">
                  A focused process built for clarity, predictability, and high quality output. Every phase establishes the
                  foundation for the next, with no surprises at any stage.
                </p>
              </div>
              <ol className="fp-process-list">
                {PROCESS.map((step, i) => (
                  <li key={step.file} className={`fp-win-box fp-reveal ${delay(i)}`}>
                    <WinTitlebar title={step.file} />
                    <div className="fp-process-step">
                      <div className="fp-process-phase">{step.phase}</div>
                      <div>
                        <h3 className="fp-process-title">{step.title}</h3>
                        <p className="fp-process-desc">{step.desc}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="fp-section" id="services" aria-labelledby="services-title">
            <div className="fp-container">
              <div className="fp-section-header fp-reveal">
                <div>
                  <span className="fp-label fp-mb-4">Services in Pune</span>
                  <h2 id="services-title" className="fp-headline">
                    Engineering and Design
                  </h2>
                </div>
                <p className="fp-body">
                  Full-cycle web development and web software, without the agency overhead. Direct developer communication,
                  reliable updates, and production code built to scale.
                </p>
              </div>
              <ul className="fp-services-grid fp-reveal">
                {SERVICES.map((service) => (
                  <li key={service.file}>
                    <WinBox title={service.file}>
                      <div className="fp-service-card">
                        <div className="fp-service-tag">{service.tag}</div>
                        <h3 className="fp-service-name">{service.name}</h3>
                        <p className="fp-service-desc">{service.desc}</p>
                      </div>
                    </WinBox>
                  </li>
                ))}
              </ul>
              <div className="fp-section-actions fp-reveal">
                <Link href="/services" className="fp-btn-secondary">
                  Review All Services
                </Link>
              </div>

              <div className="fp-industries-wrap fp-reveal">
                <span className="fp-label fp-mb-4">Industries Served in Pune</span>
                <ul className="fp-industries-row">
                  {INDUSTRIES.map((industry) => (
                    <li key={industry} className="fp-industry-tag">
                      {industry}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="fp-section" aria-labelledby="location-title">
            <div className="fp-container">
              <div className="fp-split">
                <WinBox title="pune-map.png" className="fp-reveal">
                  <div className="fp-split-image" style={{ position: "relative" }}>
                    <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", height: "100%" }}>
                      <Image
                        src="/images/pune-map.webp"
                        alt="Map of Pune showing the PizzaScript studio location (opens Google Maps)"
                        width={1000}
                        height={1414}
                        sizes="(min-width: 1024px) 560px, 100vw"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </a>
                  </div>
                </WinBox>
                <div className="fp-split-text fp-reveal fp-delay-2">
                  <span className="fp-label">Location</span>
                  <h2 id="location-title" className="fp-headline">
                    Based in Pune, delivering globally.
                  </h2>
                  <p className="fp-body">
                    Based in Pune, Maharashtra, working remotely with clients across India, Europe, and North America.
                    Partnering with startups building new products and businesses looking to rebuild or improve their
                    digital platforms.
                  </p>
                  <p className="fp-body">
                    Consistent daily progress updates for all active projects. Aligned communication schedules for clients
                    across time zones. Transparent timelines, no agency middlemen.
                  </p>
                  <a href="#contact" className="fp-btn-primary" style={{ alignSelf: "flex-start" }}>
                    Start a conversation
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="fp-studio-section" aria-labelledby="studio-title">
            <div className="fp-container">
              <div className="fp-studio-grid fp-reveal" style={{ marginBottom: 0 }}>
                <div className="fp-studio-logo-wrap">
                  <span className="fp-label fp-mb-4">Parent Studio</span>
                  <h2 id="studio-title" className="fp-studio-logo-text">
                    PizzaScript
                  </h2>
                  <p className="fp-studio-clarification">
                    This freelance practice operates under PizzaScript, an independent web development and web software
                    studio based in Pune.
                  </p>
                </div>
                <div className="fp-studio-content">
                  <p className="fp-body">
                    Custom websites and web software, built without templates, page builders, or shortcuts. Every project is
                    engineered from the ground up for speed, reliability, and long-term maintainability.
                  </p>
                  <p className="fp-body">
                    Explore the main studio to review engineering principles, the full service list, and the complete
                    developer portfolio.
                  </p>
                  <Link href="/" className="fp-btn-primary">
                    Explore Main Studio
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="fp-section" id="work" aria-labelledby="work-title">
            <div className="fp-container">
              <div className="fp-section-header fp-reveal">
                <div>
                  <span className="fp-label fp-mb-4">Selected Work</span>
                  <h2 id="work-title" className="fp-headline">
                    Recent Releases
                  </h2>
                </div>
                <p className="fp-body">
                  A selection of digital products built to perform: clean code, optimised delivery, and measurable results.
                  Open a live preview or read the full case study.
                </p>
              </div>
              <LandingProjects studies={CASE_STUDIES} />
              <div className="fp-section-actions fp-reveal">
                <Link href="/portfolio" className="fp-btn-secondary">
                  Explore Full Portfolio
                </Link>
              </div>
            </div>
          </section>

          <section className="fp-section" id="about" aria-labelledby="about-title">
            <div className="fp-container">
              <div className="fp-section-header fp-reveal">
                <div>
                  <span className="fp-label fp-mb-4">About the Studio</span>
                  <h2 id="about-title" className="fp-headline">
                    Who Is PizzaScript?
                  </h2>
                </div>
                <p className="fp-body">
                  An independent web development studio based in Pune, Maharashtra. Building custom websites and web
                  software for startups, SMEs, and enterprises across India — no templates, no shortcuts, no lock-in.
                </p>
              </div>

              <ul className="fp-about-grid fp-reveal">
                {ABOUT.map((item) => (
                  <li key={item.file}>
                    <WinBox title={item.file}>
                      <div className="fp-about-card">
                        <h3 className="fp-about-card-title">{item.title}</h3>
                        <p className="fp-about-card-desc">{item.desc}</p>
                      </div>
                    </WinBox>
                  </li>
                ))}
              </ul>

              <WinBox title="philosophy.txt" dark className="fp-about-mission-win fp-reveal">
                <figure className="fp-about-mission">
                  <div className="fp-about-mission-label">Philosophy</div>
                  <blockquote className="fp-about-mission-quote">
                    &ldquo;The internet deserves better than bloated templates and slow load times. Every Pune business
                    deserves a website that actually performs — technically and commercially.&rdquo;
                  </blockquote>
                  <figcaption className="fp-about-mission-author">— PizzaScript, Pune</figcaption>
                </figure>
              </WinBox>

              <ul className="fp-about-stats fp-reveal">
                {STATS.map((stat, i) => (
                  <li key={stat.file} className={`fp-win-box fp-reveal ${delay(i)}`}>
                    <WinTitlebar title={stat.file} />
                    <div className="fp-about-stat">
                      <div className="fp-about-stat-value">{stat.value}</div>
                      <div className="fp-about-stat-label">{stat.label}</div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="fp-section-actions fp-reveal">
                <Link href="/about" className="fp-btn-secondary">
                  Full Studio Profile
                </Link>
              </div>
            </div>
          </section>

          <section className="fp-section" id="blog" aria-labelledby="blog-title">
            <div className="fp-container">
              <div className="fp-section-header fp-reveal">
                <div>
                  <span className="fp-label fp-mb-4">Journal · Pune Web Dev</span>
                  <h2 id="blog-title" className="fp-headline">
                    Technical Writing
                  </h2>
                </div>
                <p className="fp-body">
                  Practical insights on frontend engineering, SEO strategy, web performance, and the craft of building
                  digital products in Pune. Written by the developers building it.
                </p>
              </div>
              {posts.length > 0 && (
                <ul className="fp-blog-grid fp-reveal">
                  {posts.map((post, i) => (
                    <li key={post.slug}>
                      <WinBox title={`article-0${i + 1}.md`}>
                        <Link href={`/blog/${post.slug}`} className="fp-blog-card">
                          <span className="fp-blog-card-tag">{post.category ?? "Engineering"}</span>
                          <h3 className="fp-blog-card-title">{post.title}</h3>
                          <p className="fp-blog-card-desc">{post.excerpt}</p>
                          <span className="fp-blog-card-cta" aria-hidden="true">
                            Read article →
                          </span>
                        </Link>
                      </WinBox>
                    </li>
                  ))}
                </ul>
              )}
              <div className="fp-section-actions fp-reveal">
                <Link href="/blog" className="fp-btn-secondary">
                  Read Entire Journal
                </Link>
              </div>
            </div>
          </section>

          <section className="fp-section" id="faq" aria-labelledby="faq-title">
            <div className="fp-container">
              <div className="fp-section-header fp-reveal">
                <div>
                  <span className="fp-label fp-mb-4">Common Questions</span>
                  <h2 id="faq-title" className="fp-headline">
                    Frequently Asked
                  </h2>
                </div>
                <p className="fp-body">
                  Answers to the most common questions about web development and web software projects in Pune.
                </p>
              </div>
              <ul className="fp-faq-list">
                {FAQ_ITEMS.map((item, i) => (
                  <li key={item.q} className={`fp-win-box fp-reveal ${delay(i % 3)}`}>
                    <WinTitlebar title={`faq-0${i + 1}.txt`} />
                    <div className="fp-faq-item">
                      <h3 className="fp-faq-question">{item.q}</h3>
                      <p className="fp-faq-answer">{item.a}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="fp-cta" id="contact" aria-labelledby="contact-title">
            <div className="fp-container">
              <div className="fp-cta-top fp-reveal">
                <div>
                  <span className="fp-cta-label">Currently accepting new Pune projects</span>
                  <h2 id="contact-title" className="fp-cta-display">
                    Start a new <em>collaboration</em>.
                  </h2>
                </div>
                <p className="fp-cta-body">
                  Open to new web development and web software projects: startups, SMEs, and enterprises in Pune and
                  beyond. Fill in the form below and expect a reply within 24 hours.
                </p>
              </div>
              <WinBox title="new-project-inquiry.exe" className="fp-reveal">
                <LandingContactForm />
              </WinBox>
            </div>
          </section>
        </main>

        <footer className="fp-footer">
          <div className="fp-container">
            <div className="fp-footer-grid fp-reveal">
              <div>
                <Link href="/" className="fp-footer-brand">
                  PizzaScript
                </Link>
                <p className="fp-footer-tagline">
                  Freelance web development, web software, and technical SEO, based in Pune, India.
                </p>
              </div>
              <nav aria-label="Page sections">
                <span className="fp-footer-col-label">Navigation</span>
                <ul className="fp-footer-links">
                  {NAV.map(([id, label]) => (
                    <li key={id}>
                      <a href={`#${id}`}>{label}</a>
                    </li>
                  ))}
                  <li>
                    <Link href="/">Main Site</Link>
                  </li>
                </ul>
              </nav>
              <div>
                <span className="fp-footer-col-label">Contact</span>
                <ul className="fp-footer-links">
                  <li>
                    <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                  </li>
                  <li>
                    <a href={SITE.whatsappUrl} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </li>
                  <li>
                    <a href={SITE.githubUrl} target="_blank" rel="noopener noreferrer">
                      GitHub Profile
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="fp-footer-bottom fp-reveal">
              <span className="fp-footer-copy">
                © <CopyrightYear /> PizzaScript. All rights reserved.
              </span>
              <span className="fp-footer-copy">Pune, Maharashtra, India</span>
            </div>
          </div>
        </footer>
      </div>

      <WhatsAppBall />
    </>
  );
}

