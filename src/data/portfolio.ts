export interface CaseStudy {
  slug: string;
  name: string;
  client: string;
  liveUrl: string;
  screenshot: string;
  screenshotAlt: string;
  summary: string;
  tags: string[];
  duration: string;
  flavor: string;
  category: string;
  metric: string;
  seoTitle: string;
  seoDescription: string;
  challenge: string;
  solution: string;
  results: string[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "my-design-academia",
    name: "My Design Academia",
    client: "My Design Academia",
    liveUrl: "https://mydesignacademia.com/",
    screenshot: "/images/portfolio/my-design-academia.webp",
    screenshotAlt: "My Design Academia homepage showing course listings and an enquiry call-to-action",
    summary:
      "A fully developed educational website built with responsive design, enquiry functionality, SEO optimization, and a clean user journey crafted for student conversions.",
    tags: ["HTML", "CSS", "JavaScript", "PHP", "MySQL", "SEO"],
    duration: "5 weeks",
    flavor: "Bold & Modern",
    category: "Full-Stack Development / SEO",
    metric: "99% SEO Index Rate",
    seoTitle: "My Design Academia Case Study — Educational Portal",
    seoDescription:
      "How we rebuilt My Design Academia as a fast, responsive, SEO-optimized educational portal built for student enquiries and admissions.",
    challenge:
      "The client needed an accessible portal to drive admissions. The existing WordPress site suffered from slow load times (>4.5s), rendering failures on mobile screens, and a complex enrollment checkout route.",
    solution:
      "We engineered a bespoke, lightweight system using optimized code pathways and semantic templates. We restructured the registration form into a multi-step component, cleaned up asset requests, and wrote strict canonical markup.",
    results: [
      "Largest Contentful Paint reduced from 4.5s to 1.1s.",
      "Mobile conversion rates increased by 42% in the first 60 days.",
      "100% of target service pages indexed on the first search engine crawl wave.",
      "Eliminated layout shift (CLS score reduced to 0.01).",
    ],
  },
  {
    slug: "orion-pharma-india",
    name: "Orion Pharma India",
    client: "Orion Pharma India",
    liveUrl: "https://www.orionpharmaindia.org/",
    screenshot: "/images/portfolio/orion-pharma-india.webp",
    screenshotAlt: "Orion Pharma India homepage with product categories for infertility, oncology and critical care medicines",
    summary:
      "A professional, search-optimized corporate website for a leading exporter of human infertility, gynecology, oncology, and critical care medicines.",
    tags: ["HTML", "CSS", "JavaScript", "SEO", "Responsive"],
    duration: "4 weeks",
    flavor: "Clean & Corporate",
    category: "Corporate Website / SEO",
    metric: "100% Mobile Responsiveness",
    seoTitle: "Orion Pharma India Case Study — Pharmaceutical Platform",
    seoDescription:
      "How we redesigned Orion Pharma India's corporate website and export catalog for global speed, mobile responsiveness and search visibility.",
    challenge:
      "The existing corporate website suffered from outdated templates, non-responsive layouts on mobile viewports, slow loading speeds across global networks, and poor SEO indexing of critical pharma catalogs.",
    solution:
      "We redesigned the website into a modern, lightning-fast responsive interface. We optimized catalog tables, added high-performance metadata tags, and simplified inquiry pathways for international clients.",
    results: [
      "Page load times reduced globally by 65%.",
      "Achieved 100% responsive test completion across all major mobile/tablet devices.",
      "Streamlined catalog layout leading to a 35% increase in international inquiries.",
      "All key drug category landing pages successfully indexed on major search engines.",
    ],
  },
];

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((study) => study.slug === slug) ?? null;
}
