export type ServiceIcon =
  | "terminal" | "bolt" | "palette" | "mail" | "forum" | "map" | "ads_click" | "edit_note" | "query_stats"
  | "rate_review" | "link" | "view_in_ar" | "code" | "history_edu" | "alt_route" | "backup" | "gavel"
  | "security" | "image" | "javascript" | "flash_on";

export type StepIcon = "architecture" | "view_quilt" | "speed";

export interface Service {
  slug: string;
  name: string;
  hub: { keyword: string; metric: string; description: string };
  seo: { title: string; description: string };
  schemaDescription: string;
  heading: [string, string];
  intro: string;
  tags: [string, string];
  image: string;
  imageAlt: string;
  heroProgress: number;
  cards: [
    { eyebrow: string; heading: string; items: { icon: ServiceIcon; label: string }[] },
    { eyebrow: string; heading: string; metrics: { label: string; value: string; percent: number }[]; quote: string },
    { eyebrow: string; heading: string; badges: string[]; checks: string[] },
  ];
  steps: { label: string; title: string; description: string; icon: StepIcon }[];
  faqs: { q: string; a: string }[];
}

export const SERVICES: Service[] = [
  {
    slug: "custom-website-development",
    name: "Custom Website Development",
    hub: {
      keyword: "Custom Website Developer",
      metric: "100/100 Lighthouse Speed",
      description:
        "Unique, bespoke websites built from scratch. Bypassing slow, generic templates for hand-crafted React layouts that represent your brand and convert visitors.",
    },
    seo: {
      title: "Custom Website Development Services in Pune",
      description:
        "Custom websites designed and coded from scratch in Pune. No templates or page builders — fast, secure, SEO-ready sites built around your brand.",
    },
    schemaDescription:
      "Bespoke website design and development services built from scratch. High performance, unique branding, and modern architecture.",
    heading: ["Custom Website", "Development"],
    intro:
      "Unique, hand-crafted websites designed specifically for your brand. We bypass generic templates and frozen page-builders to code blazing-fast, secure interfaces designed to convert.",
    tags: ["No-Template Code", "Bespoke UI Layout"],
    image: "/images/services/custom-website-development.webp",
    imageAlt: "Illustration of a custom website layout being assembled from interface components",
    heroProgress: 66,
    cards: [
      {
        eyebrow: "// THE STACK",
        heading: "Modern Core",
        items: [
          { icon: "terminal", label: "React 19 Components" },
          { icon: "bolt", label: "Next.js App Router" },
          { icon: "palette", label: "Tailwind CSS Design Systems" },
        ],
      },
      {
        eyebrow: "// PERFORMANCE",
        heading: "Optimization",
        metrics: [
          { label: "FIRST CONTENTFUL PAINT", value: "0.6s", percent: 95 },
          { label: "LIGHTHOUSE SCORE", value: "100%", percent: 100 },
        ],
        quote: "Optimized code splitting, vector icons, and edge CDN cache routes.",
      },
      {
        eyebrow: "// QUALITY",
        heading: "Assurance",
        badges: ["STRICT TS", "SEMANTIC HTML", "CI/CD CHECK"],
        checks: ["Custom brand architecture maps", "Responsive design testing on real devices"],
      },
    ],
    steps: [
      {
        label: "01 / DISCOVERY",
        title: "Architecture & Wireframing",
        description:
          "We map your branding goals and content structure to custom components, resolving user flows before designing visual interfaces.",
        icon: "architecture",
      },
      {
        label: "02 / DEVELOPMENT",
        title: "Hand-Written Code Architecture",
        description:
          "Writing semantic HTML layouts and modular React components. We ensure clean files, zero bloated plugins, and fast loading.",
        icon: "view_quilt",
      },
      {
        label: "03 / LAUNCH",
        title: "Edge Speed Optimization",
        description:
          "Deploying assets to global edge CDNs, hardening cache controls, and wiring up structured data for search engines.",
        icon: "speed",
      },
    ],
    faqs: [
      {
        q: "Why should I choose custom website development over templates?",
        a: "Templates come with heavy stylesheet bloat, redundant JavaScript layers, and persistent plugin vulnerabilities. Bespoke websites are coded from scratch with optimized assets, resulting in faster loading speeds, better technical SEO, and custom designs that fit your brand.",
      },
      {
        q: "How long does a custom business website build take?",
        a: "A typical custom design and development cycle spans 4 to 8 weeks. This structured process covers research and architecture, interface prototyping, clean TypeScript development, and performance optimization before launch.",
      },
      {
        q: "Are custom websites secure and easily scalable?",
        a: "Yes. By avoiding off-the-shelf CMS installs and vulnerable third-party plugins, statically rendered custom sites have a very small attack surface, and they scale on edge networks without database bottlenecks.",
      },
    ],
  },
  {
    slug: "business-websites",
    name: "Business Website Development",
    hub: {
      keyword: "Corporate Website Design",
      metric: "Lead-Focused Layouts",
      description:
        "Establish digital credibility and capture continuous inquiries. Secure contact form routes, click-to-chat WhatsApp hooks, and Google Maps local integrations.",
    },
    seo: {
      title: "Business Website Development",
      description:
        "Professional business websites that build credibility and capture leads: fast contact forms, WhatsApp and Google Maps integration, and local SEO for Pune businesses.",
    },
    schemaDescription:
      "Professional website development for companies. Features lead generation tools, custom contact forms, WhatsApp and Google Maps integrations.",
    heading: ["Business Website", "Development"],
    intro:
      "Establish corporate credibility and capture more client inquiries. We construct custom company websites featuring lead capturing funnels, secure contact APIs, and maps integration tailored for growth.",
    tags: ["Lead Optimized", "Google Maps & WhatsApp"],
    image: "/images/services/business-websites.webp",
    imageAlt: "Illustration of a business website with contact form, map and chat widgets",
    heroProgress: 72,
    cards: [
      {
        eyebrow: "// FEATURES",
        heading: "Credibility Kits",
        items: [
          { icon: "mail", label: "Serverless Contact APIs" },
          { icon: "forum", label: "WhatsApp Widget Routing" },
          { icon: "map", label: "Google Maps Embeds" },
        ],
      },
      {
        eyebrow: "// TRAFFIC",
        heading: "Lead Channels",
        metrics: [
          { label: "MOBILE RETENTION", value: "98%", percent: 98 },
          { label: "FORM DELAY", value: "0ms", percent: 100 },
        ],
        quote: "Seamless CRM routing and instant automated email notifications.",
      },
      {
        eyebrow: "// RELIABILITY",
        heading: "Trust Factors",
        badges: ["SSL SECURED", "LOCAL SEO", "FAST FORMS"],
        checks: ["Structured reviews database", "GDPR-ready consent scripts"],
      },
    ],
    steps: [
      {
        label: "01 / DISCOVERY",
        title: "Goal Definition & Modeling",
        description:
          "Defining critical action metrics (phone calls, map directions, email signups) and planning form layout flow.",
        icon: "architecture",
      },
      {
        label: "02 / INTEGRATION",
        title: "Custom Lead Gateways",
        description:
          "Coding direct WhatsApp links, routing forms through serverless functions, and configuring Google Maps embeds.",
        icon: "view_quilt",
      },
      {
        label: "03 / VERIFICATION",
        title: "Local SEO & Security",
        description: "Adding structured JSON-LD schema, routing email notifications, and securing every connection.",
        icon: "speed",
      },
    ],
    faqs: [
      {
        q: "How does a custom business website generate more customer leads?",
        a: "We design conversion-focused forms, direct click-to-chat WhatsApp hooks, and clear, prominent action buttons. Combined with sub-second load times and optimized mobile layouts, this friction-free experience increases visitor inquiry rates.",
      },
      {
        q: "Can you sync contact form leads into our CRM software?",
        a: "Yes. We build secure API integrations to route customer inquiries directly into platforms like HubSpot, Salesforce, or Zoho, as well as Slack channels for real-time sales alerts.",
      },
      {
        q: "Do you manage domain configuration and hosting setups?",
        a: "Yes. We configure DNS routing and SSL certificates, and connect your custom domain to edge networks on Vercel or Cloudflare.",
      },
    ],
  },
  {
    slug: "landing-page-development",
    name: "Landing Page Development",
    hub: {
      keyword: "Campaign Landing Page",
      metric: "Sub-1.0s Load Time",
      description:
        "High-conversion single page platforms built to capture campaign traffic. Optimized heading layouts, minimal bounce friction, and fast serverless forms.",
    },
    seo: {
      title: "High-Converting Landing Page Development",
      description:
        "Fast, conversion-focused landing pages for Google and Meta ad campaigns. Sub-second loads, focused CTAs, tracking and A/B-ready components.",
    },
    schemaDescription:
      "High-converting landing page development for marketing campaigns. Features CTA optimizations, lead capturing systems, and sub-second loading speeds.",
    heading: ["Landing Page", "Development"],
    intro:
      "Maximize the returns of your marketing campaigns. We build conversion-focused, lightning-fast landing pages optimized to capture user intent and convert traffic into qualified leads.",
    tags: ["Conversion Focused", "A/B Testing Ready"],
    image: "/images/services/landing-page-development.webp",
    imageAlt: "Illustration of a landing page with conversion analytics charts",
    heroProgress: 75,
    cards: [
      {
        eyebrow: "// HIGHLIGHTS",
        heading: "Campaign Blocks",
        items: [
          { icon: "ads_click", label: "Conversion Focused CTAs" },
          { icon: "edit_note", label: "Optimized Capture Forms" },
          { icon: "query_stats", label: "A/B Split Test Modules" },
        ],
      },
      {
        eyebrow: "// FUNNELS",
        heading: "Ad Optimization",
        metrics: [
          { label: "BOUNCE RATE LOWERING", value: "-50%", percent: 88 },
          { label: "MOBILE SPEED VALUE", value: "0.5s", percent: 100 },
        ],
        quote: "Sub-second loading times retain mobile clicks before users bounce.",
      },
      {
        eyebrow: "// CAMPAIGNS",
        heading: "ROI Boosting",
        badges: ["GOOGLE ADS", "META RETARGETING", "ANALYTICS CAPTURE"],
        checks: ["High page quality scores", "Custom tracking pixels setup"],
      },
    ],
    steps: [
      {
        label: "01 / DISCOVERY",
        title: "Ad Match Analysis",
        description:
          "Aligning landing page content with your ad headlines to guarantee context match and improve quality scores.",
        icon: "architecture",
      },
      {
        label: "02 / INTERFACE",
        title: "CTA & Form Prototyping",
        description:
          "Designing frictionless form fields and high-contrast click paths to keep users focused on a single call to action.",
        icon: "view_quilt",
      },
      {
        label: "03 / TRACKING",
        title: "Conversion Hardening",
        description:
          "Deploying with Google Tag Manager, Meta Pixel triggers, and custom conversion tracking endpoints.",
        icon: "speed",
      },
    ],
    faqs: [
      {
        q: "What structural features make a landing page high-converting?",
        a: "A high-converting landing page removes navigation leaks, loads in under a second to retain paid mobile traffic, and centres on a single high-contrast call to action backed by trust-building proof.",
      },
      {
        q: "Are these custom landing pages compatible with Google and Meta ads?",
        a: "Yes. Fast, semantic pages earn better landing page experience ratings, which can lower your cost-per-click and lift conversion rates.",
      },
      {
        q: "How do you configure A/B testing variables?",
        a: "We build modular component layouts, so alternative variations (different headlines or button colors) can be compiled and linked to conversion tracking easily.",
      },
    ],
  },
  {
    slug: "website-redesign",
    name: "Website Redesign Services",
    hub: {
      keyword: "Website Revamp Services",
      metric: "Reduce Bounce Rate",
      description:
        "Modernize outdated layouts and regain lost visitors. User experience overhauls, Core Web Vitals optimization, and careful 301 URL redirect maps.",
    },
    seo: {
      title: "Website Redesign & Modernization Services",
      description:
        "Redesign a slow, outdated website without losing rankings. UX refresh, modern React/Next.js rebuild, Core Web Vitals fixes and 301 redirect mapping.",
    },
    schemaDescription:
      "Modernize outdated websites. Visual upgrades, mobile responsive redesigns, Core Web Vitals optimization, and 301 redirect management.",
    heading: ["Website Redesign", "Services"],
    intro:
      "Modernize your online presence and reclaim lost customers. We revamp slow, outdated websites using high-performance React architectures, optimizing UX and speed to boost inquiries.",
    tags: ["UX Refresh", "SEO Link Preservation"],
    image: "/images/services/website-redesign.webp",
    imageAlt: "Illustration of website wireframes being rebuilt into a modern layout",
    heroProgress: 68,
    cards: [
      {
        eyebrow: "// SYSTEM MAP",
        heading: "Revamp Core",
        items: [
          { icon: "rate_review", label: "UI/UX Interface Audits" },
          { icon: "link", label: "301 Redirect Mapping" },
          { icon: "view_in_ar", label: "Next-Gen Image Formats" },
        ],
      },
      {
        eyebrow: "// AUDITS",
        heading: "Speed Upgrades",
        metrics: [
          { label: "BOUNCE RATE DECREASE", value: "-45%", percent: 90 },
          { label: "SEO DATA RETENTION", value: "100%", percent: 100 },
        ],
        quote: "We secure sitemaps and configure URL redirects to protect existing traffic.",
      },
      {
        eyebrow: "// RESULTS",
        heading: "Modern Features",
        badges: ["ACCESSIBILITY", "CLEAN TSX", "ASSET MAPS"],
        checks: ["Clean semantic layout components", "Hardware accelerated animations"],
      },
    ],
    steps: [
      {
        label: "01 / AUDIT",
        title: "UX & SEO Investigation",
        description:
          "Auditing your current site for performance bottlenecks and mapping the pages and keywords that already rank.",
        icon: "architecture",
      },
      {
        label: "02 / RECONSTRUCTION",
        title: "React UI Rebuilding",
        description:
          "Rebuilding layouts into fully responsive components and removing obsolete plugin scripts.",
        icon: "view_quilt",
      },
      {
        label: "03 / REDIRECTION",
        title: "Traffic Preservation",
        description:
          "Setting up 301 redirect maps in your hosting configuration and validating structured data before launch.",
        icon: "speed",
      },
    ],
    faqs: [
      {
        q: "What are the main indicators that my website needs a redesign?",
        a: "Outdated visual styles, poor mobile responsiveness, slow load speeds, and high bounce rates are clear indicators. Modernizing your website addresses these issues to rebuild user trust and capture more inquiries.",
      },
      {
        q: "Will redirecting pages during a redesign impact our current search rankings?",
        a: "We create comprehensive URL maps and configure server-side 301 redirects, so search engines transfer authority to the new paths without ranking loss.",
      },
      {
        q: "Can we retain our current website copy and assets?",
        a: "Yes. We preserve your existing text, branding assets, and articles, and move them into optimized layouts for better readability and speed.",
      },
    ],
  },
  {
    slug: "seo-friendly-websites",
    name: "SEO-Friendly Website Development",
    hub: {
      keyword: "Technical SEO Development",
      metric: "Crawlable From Day One",
      description:
        "Build search engine authority from day one. Server-rendered HTML, complete metadata, and structured schema markup.",
    },
    seo: {
      title: "SEO-Friendly Website Development & Technical SEO",
      description:
        "Websites engineered for search from day one: server-rendered HTML, clean heading structure, JSON-LD schema, sitemaps and fast Core Web Vitals.",
    },
    schemaDescription:
      "Technical search engine optimization built into the core structure of custom websites. Server-rendered HTML, complete metadata, and JSON-LD schema integrations.",
    heading: ["SEO-Friendly", "Websites"],
    intro:
      "Build a website that ranks. We craft clean, search-engine-ready custom sites with server-rendered HTML, native metadata and structured JSON-LD schema so crawlers can index you immediately.",
    tags: ["Technical SEO Core", "Schema & Metadata"],
    image: "/images/services/seo-friendly-websites.webp",
    imageAlt: "Illustration of search engine crawlers indexing a website",
    heroProgress: 88,
    cards: [
      {
        eyebrow: "// STRATEGY",
        heading: "SEO Core",
        items: [
          { icon: "code", label: "JSON-LD Schemas" },
          { icon: "history_edu", label: "Semantic HTML5 Trees" },
          { icon: "alt_route", label: "XML Sitemap Automation" },
        ],
      },
      {
        eyebrow: "// CRAWLABILITY",
        heading: "Crawl Budgets",
        metrics: [
          { label: "ORGANIC RANKINGS", value: "+120%", percent: 92 },
          { label: "CRAWL BUDGET WASTE", value: "0%", percent: 100 },
        ],
        quote: "Server-rendered routes deliver complete content instantly to crawlers.",
      },
      {
        eyebrow: "// COMPLIANCE",
        heading: "Standard Tags",
        badges: ["ROBOTS RULES", "CANONICALS", "ALT LABELS"],
        checks: ["Correct heading hierarchy", "JSON-LD schema validation"],
      },
    ],
    steps: [
      {
        label: "01 / AUDIT",
        title: "Sitemap & Keyword Discovery",
        description:
          "Reviewing current indexing, finding missing metadata, and planning keyword targets for every page.",
        icon: "architecture",
      },
      {
        label: "02 / STRUCTURE",
        title: "Clean Semantic Architecture",
        description: "Coding standards-compliant HTML5 structure and per-route metadata for every page.",
        icon: "view_quilt",
      },
      {
        label: "03 / AUTOMATION",
        title: "Schema & Sitemap Hookups",
        description: "Generating XML sitemaps and robots rules, and adding structured JSON-LD for your business.",
        icon: "speed",
      },
    ],
    faqs: [
      {
        q: "What makes a custom website more SEO-friendly than builder websites?",
        a: "Generic builders ship heavy JavaScript, bloated DOM trees and weak semantic structure. Custom server-rendered builds deliver clean HTML with complete metadata, fast load times and structured data that search engines can parse immediately.",
      },
      {
        q: "How do you handle schema markup for local businesses?",
        a: "We write JSON-LD covering your organization, services, FAQs and breadcrumbs. This tells search engines about your services and location and makes pages eligible for rich results.",
      },
      {
        q: "Will my current search ranking fall during a migration?",
        a: "We build 301 redirect maps, carry over existing metadata, register XML sitemaps, and test performance so your existing search footprint is preserved while crawler access improves.",
      },
    ],
  },
  {
    slug: "website-maintenance",
    name: "Website Maintenance & Support",
    hub: {
      keyword: "Technical Support & Updates",
      metric: "Monitored 24/7",
      description:
        "Continuous protection for custom web applications. Automated backups, security monitoring, package updates, and quick content changes.",
    },
    seo: {
      title: "Website Maintenance & Technical Support",
      description:
        "Keep your website secure, fast and up to date: uptime monitoring, backups, dependency and security updates, and content changes via staging.",
    },
    schemaDescription:
      "Professional support and maintenance services for custom websites and legacy platforms. Uptime monitoring, security patching, and fast content updates.",
    heading: ["Website Maintenance", "& Support"],
    intro:
      "Protect your digital assets. We provide continuous monitoring, daily remote backups, and framework updates, so your web systems stay secure and supported.",
    tags: ["24/7 Monitoring", "Rapid Content Sync"],
    image: "/images/services/website-maintenance.webp",
    imageAlt: "Illustration of hosting infrastructure with security monitoring",
    heroProgress: 95,
    cards: [
      {
        eyebrow: "// PROTOCOLS",
        heading: "Safety Checks",
        items: [
          { icon: "backup", label: "Daily Database Backups" },
          { icon: "gavel", label: "Framework Updates" },
          { icon: "security", label: "Uptime Alerts Integration" },
        ],
      },
      {
        eyebrow: "// OPERATIONS",
        heading: "Uptime Targets",
        metrics: [
          { label: "UPTIME TARGET", value: "99.99%", percent: 99 },
          { label: "RESTORE TIME", value: "< 30 Mins", percent: 100 },
        ],
        quote: "Every change ships through a Git-based staging workflow.",
      },
      {
        eyebrow: "// SECURE HOSTS",
        heading: "Support Kits",
        badges: ["GIT STAGING", "API PATCHING", "DNS SECURE"],
        checks: ["Safe remote staging servers", "Package vulnerability checks"],
      },
    ],
    steps: [
      {
        label: "01 / MONITOR",
        title: "Real-Time Security Checks",
        description: "Setting up security scans, uptime alerts, and regular backups to remote storage.",
        icon: "architecture",
      },
      {
        label: "02 / UPDATE",
        title: "Dependencies & Code Patches",
        description:
          "Updating libraries, patching framework security advisories, and keeping layouts compatible with current browsers.",
        icon: "view_quilt",
      },
      {
        label: "03 / UPGRADE",
        title: "Content & Feature Updates",
        description: "Shipping content additions, design edits, or new pages on staging before going live.",
        icon: "speed",
      },
    ],
    faqs: [
      {
        q: "What does your website maintenance service cover?",
        a: "We monitor your site for security and uptime issues, update packages and libraries, run automated backups, and handle content updates, copy edits, or layout adjustments as your brand grows.",
      },
      {
        q: "How quickly do you resolve website issues or execute updates?",
        a: "We aim to respond within 2 hours to critical outages and complete standard content update requests within 24 to 48 hours, tested on staging first.",
      },
      {
        q: "Can you help maintain our legacy WordPress website?",
        a: "Yes. We handle server updates, database optimization, and plugin audits on WordPress, and can plan a migration to a faster custom stack when you're ready.",
      },
    ],
  },
  {
    slug: "website-speed-optimization",
    name: "Website Speed Optimization",
    hub: {
      keyword: "Core Web Vitals Optimizer",
      metric: "Sub-1.0s Paint LCP",
      description:
        "Achieve lightning-fast load times. Image compression, CSS tree shaking, browser caching, and Google Core Web Vitals optimization.",
    },
    seo: {
      title: "Website Speed Optimization & Core Web Vitals",
      description:
        "Speed up a slow website and pass Core Web Vitals: image optimization, code splitting, caching, CLS fixes and Lighthouse audits.",
    },
    schemaDescription:
      "Performance optimization services to boost website speeds and pass Core Web Vitals checks. Image compression, asset cache routing, and Lighthouse score fixes.",
    heading: ["Website Speed", "Optimization"],
    intro:
      "Eliminate page load delays. We refactor source scripts, compress assets, configure edge caching, and eliminate layout shifts to make your interfaces load instantly.",
    tags: ["Lighthouse 100%", "Core Web Vitals Pass"],
    image: "/images/services/website-speed-optimization.webp",
    imageAlt: "Illustration of a speedometer and Lighthouse performance scores",
    heroProgress: 90,
    cards: [
      {
        eyebrow: "// SPEED TOOLKIT",
        heading: "Speed Core",
        items: [
          { icon: "image", label: "Modern AVIF/WebP Compression" },
          { icon: "javascript", label: "Code Splitting & Deferral" },
          { icon: "flash_on", label: "CLS Layout Rectifications" },
        ],
      },
      {
        eyebrow: "// VITALS",
        heading: "Paint Speeds",
        metrics: [
          { label: "FIRST CONTENTFUL PAINT", value: "0.3s", percent: 98 },
          { label: "LARGEST CONTENTFUL PAINT", value: "< 0.9s", percent: 95 },
        ],
        quote: "Optimized static assets served globally from edge networks.",
      },
      {
        eyebrow: "// AUDITS",
        heading: "Optimization",
        badges: ["BROTLI ASSETS", "CSS CLEANUP", "EDGE CACHING"],
        checks: ["Fast desktop & mobile speed", "Lazy loaded rendering routes"],
      },
    ],
    steps: [
      {
        label: "01 / AUDIT",
        title: "Core Web Vitals Assessment",
        description:
          "Identifying performance bottlenecks, render-blocking scripts, oversized images, and slow server routes.",
        icon: "architecture",
      },
      {
        label: "02 / OPTIMIZE",
        title: "Asset Compression & Splitting",
        description: "Minifying scripts, serving modern image formats, and eliminating cumulative layout shift.",
        icon: "view_quilt",
      },
      {
        label: "03 / CACHE",
        title: "CDN Routing Configurations",
        description: "Setting browser cache headers and routing static resources through global edge networks.",
        icon: "speed",
      },
    ],
    faqs: [
      {
        q: "Why is website speed so important for my business?",
        a: "Slow websites lose customers: every extra second of load time measurably reduces conversions. Page experience also feeds into Google's ranking signals, so speed affects both sales and visibility.",
      },
      {
        q: "How do you achieve a 100/100 Lighthouse speed score?",
        a: "We compress images into modern formats, split and defer non-critical JavaScript, set long-lived cache headers, inline critical CSS, and keep the DOM lean so pages pass Core Web Vitals.",
      },
      {
        q: "Will optimizing my site speed break existing website features?",
        a: "No. We optimize on a staging branch first and verify that every script, form, and interactive tool works before going live.",
      },
    ],
  },
];

export function getService(slug: string) {
  return SERVICES.find((service) => service.slug === slug) ?? null;
}
