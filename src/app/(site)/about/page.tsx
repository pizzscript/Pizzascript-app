import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon, type IconName } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { ORGANIZATION_ID, breadcrumbSchema, graph } from "@/lib/schema";
import { SITE, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: "About the Studio", description: "PizzaScript is a custom web engineering studio in Pune, India, focused on web performance, React and Next.js architecture, and technical SEO.", path: "/about" });

const DIFFERENTIATORS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "bolt",
    title: "Performance First",
    text: "We optimize every kilobyte. Our custom builds consistently target 95+ Google Lighthouse performance scores.",
  },
  {
    icon: "terminal",
    title: "Custom Code",
    text: "No template page builders or plugin bloat. Pure, hand-crafted engineering tailored to your business and brand.",
  },
  {
    icon: "campaign",
    title: "Direct Access",
    text: "You speak directly to the engineers building your site. No non-technical project managers, no translation errors.",
  },
];

const WORKFLOW = [
  {
    title: "Mobile-First Architecture",
    text: "Every interaction is designed for the thumb first, ensuring fast, seamless experiences across all mobile devices.",
  },
  {
    title: "Conversion-Focused UX",
    text: "We don't just build pages; we build clear paths to enquiry, designed to turn visitors into leads.",
  },
  {
    title: "SEO Integrity",
    text: "Semantic HTML, fast paint times, and rich structured data are baked into the core of every project.",
  },
];

const INDUSTRIES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "clinical_notes",
    title: "PHARMA & HEALTH",
    text: "Secure, compliant, and lightning-fast platforms for healthcare clinics and medical suppliers.",
  },
  { icon: "hub", title: "B2B SAAS", text: "High-conversion campaign landing pages, modern marketing sites, and product dashboards." },
  {
    icon: "groups",
    title: "COACHING & CONSULTING",
    text: "Authoritative personal-brand websites designed to capture bookings and establish trust.",
  },
  {
    icon: "shopping_cart",
    title: "E-COMMERCE",
    text: "Custom, lightweight storefronts and fast catalog layouts that improve cart retention.",
  },
];

function Panel({ src, alt, width, height, className = "" }: { src: string; alt: string; width: number; height: number; className?: string }) {
  return (
    <div className={`glass-card p-2 rounded-lg border border-white/10 ${className}`}>
      <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1024px) 480px, 100vw" className="w-full h-auto rounded" />
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          { "@type": "AboutPage", url: absoluteUrl("/about"), name: "About PizzaScript", about: { "@id": ORGANIZATION_ID } },
        )}
      />

      <div className="min-h-screen pt-40 lg:pt-52 pb-16 px-4 md:px-12 lg:px-24 text-cream relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-24">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "About" }]} />

          <section className="svc-panel grid grid-cols-1 lg:grid-cols-12 gap-16 items-center pt-8">
            <div className="lg:col-span-7 space-y-6" data-animate="fade-up">
              <p className="cin-eyebrow text-xs tracking-widest block uppercase">{"// ENGINEERING THE FUTURE"}</p>
              <h1 className="cin-heading text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-tight">
                Building Fast, Modern Websites That Help Businesses Grow
              </h1>
              <p className="cin-text text-stone-300 text-base leading-relaxed">
                We don&apos;t just build sites; we architect digital engines — focused on extreme performance, search
                visibility, and conversion-centric UX.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/services"
                  className="bg-primary-container hover:bg-ember text-black font-bold px-8 py-4 rounded-sm text-xs font-mono uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Explore Our Services
                </Link>
                <Link
                  href="/portfolio"
                  className="border border-white/20 text-cream px-8 py-4 rounded-sm text-xs font-mono uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  View Projects
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5 relative group" data-animate="fade-left" data-animate-delay="2">
              <div className="absolute -inset-4 bg-primary-container/10 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="glass-card p-2 border border-white/10 relative overflow-hidden aspect-square">
                <Image
                  src="/images/about/hero.webp"
                  alt="A developer workstation with code on multiple monitors"
                  fill
                  priority
                  sizes="(min-width: 1024px) 420px, 100vw"
                  className="object-cover opacity-80 grayscale hover:grayscale-0 transition-all duration-700 rounded"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
              </div>
            </div>
          </section>

          <section className="svc-panel grid grid-cols-1 lg:grid-cols-12 gap-16 items-center border-t border-white/5 pt-8">
            <div className="lg:col-span-5 order-2 lg:order-1" data-animate="fade-right">
              <Panel src="/images/about/timeline.webp" alt="Timeline of the PizzaScript studio's journey" width={512} height={343} />
            </div>
            <div className="lg:col-span-7 order-1 lg:order-2 space-y-6" data-animate="fade-up" data-animate-delay="1">
              <p className="cin-eyebrow text-xs tracking-widest block uppercase">{"// THE GENESIS"}</p>
              <h2 className="cin-heading text-3xl md:text-4xl font-serif font-bold text-cream">Born from Frustration, Built for Speed</h2>
              <div className="space-y-6 text-stone-300 text-sm md:text-base leading-relaxed">
                <p>
                  We grew tired of seeing businesses trapped in slow, bloated templates that killed their conversion rates
                  and search rankings. Most agencies deliver &quot;pretty&quot; sites that fail under the hood.
                </p>
                <p>
                  PizzaScript was founded on a simple premise: engineering excellence is non-negotiable. We stripped back the
                  bloat and focused on the fundamentals — performance, architecture, and results.
                </p>
                <div className="flex items-center gap-4 py-4">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="font-serif italic text-primary-container text-xl md:text-2xl">The pizza is in the script.</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              </div>
            </div>
          </section>

          <section className="svc-panel border-t border-white/5 pt-8">
            <div className="text-center mb-16" data-animate="fade-up">
              <p className="cin-eyebrow text-xs tracking-widest block uppercase justify-center">{"// 01. THE DIFFERENCE"}</p>
              <h2 className="cin-heading text-3xl md:text-4xl font-serif font-bold text-cream">What Makes PizzaScript Different</h2>
            </div>
            <div className="max-w-4xl mx-auto space-y-12">
              <Panel
                src="/images/about/comparison.webp"
                alt="Comparison of a slow, bloated template site against a lean custom-coded PizzaScript site"
                width={512}
                height={382}
                className="overflow-hidden"
              />
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {DIFFERENTIATORS.map((item, index) => (
                  <li
                    key={item.title}
                    className="glass-card p-8 border-t-2 border-t-primary-container"
                    data-animate="fade-up"
                    data-animate-delay={index + 1}
                  >
                    <Icon name={item.icon} size={36} className="text-primary-container mb-4" />
                    <h3 className="font-headline-sm text-xl mb-3 text-cream">{item.title}</h3>
                    <p className="text-stone-300 text-sm leading-relaxed">{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="svc-panel grid grid-cols-1 lg:grid-cols-12 gap-16 items-center mt-16 border-t border-white/5 pt-16 lg:pt-24">
            <div className="lg:col-span-7 space-y-8" data-animate="fade-up">
              <div>
                <p className="cin-eyebrow text-xs tracking-widest block uppercase">{"// OUR WORKFLOW"}</p>
                <h2 className="cin-heading text-3xl md:text-4xl font-serif font-bold text-cream mt-4">Engineering for the Modern Web</h2>
              </div>
              <ol className="space-y-6">
                {WORKFLOW.map((step, index) => (
                  <li key={step.title} className="flex gap-6 group">
                    <span
                      className="h-12 w-12 rounded-full border border-primary-container/30 flex items-center justify-center text-primary-container group-hover:bg-primary-container group-hover:text-black transition-all shrink-0"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="font-headline-sm text-lg mb-2 text-cream">{step.title}</h3>
                      <p className="text-stone-300 text-sm leading-relaxed">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lg:col-span-5" data-animate="fade-left" data-animate-delay="2">
              <Panel src="/images/about/workflow.webp" alt="Diagram of the PizzaScript web development workflow" width={512} height={512} />
            </div>
          </section>

          <section className="svc-panel mt-16 border-t border-white/5 pt-16 lg:pt-24">
            <div className="text-center mb-16" data-animate="fade-up">
              <p className="cin-eyebrow text-xs tracking-widest block uppercase justify-center">{"// 02. EXPERTISE"}</p>
              <h2 className="cin-heading text-3xl md:text-4xl font-serif font-bold text-cream">Industries We Build For</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6" data-animate="fade-right">
                <Panel src="/images/about/dashboard.webp" alt="Web performance dashboard showing speed metrics" width={512} height={286} />
              </div>
              <ul className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {INDUSTRIES.map((item, index) => (
                  <li
                    key={item.title}
                    className="glass-card p-6 flex flex-col justify-between min-h-[180px] border-t-2 border-t-primary-container"
                    data-animate="fade-up"
                    data-animate-delay={index + 1}
                  >
                    <div>
                      <h3 className="font-eyebrow-mono text-xs text-primary-container mb-2">{`// ${item.title}`}</h3>
                      <p className="text-sm text-stone-300 leading-relaxed">{item.text}</p>
                    </div>
                    <Icon name={item.icon} size={24} className="self-end text-stone-400 mt-4" />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="svc-panel mt-16 border-t border-white/5 pt-16 lg:pt-24">
            <div className="glass-card p-8 md:p-12 relative overflow-hidden rounded-xl border border-white/10" data-animate="fade-up">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 space-y-6">
                  <p className="bg-primary-container/10 border border-primary-container/30 text-primary-container px-3 py-1 font-mono text-xs uppercase inline-block">
                    CASE STUDY: ORION PHARMA INDIA
                  </p>
                  <h2 className="cin-heading text-2xl md:text-3xl font-serif font-bold text-cream">
                    A Faster Global Catalog for a Pharma Exporter
                  </h2>
                  <p className="text-stone-300 text-base md:text-lg leading-relaxed border-l-4 border-primary-container pl-4">
                    We rebuilt Orion Pharma India&apos;s outdated corporate site into a responsive, search-optimized
                    platform with a streamlined product catalog and simpler inquiry paths for international buyers.
                  </p>
                  <ul className="grid grid-cols-2 gap-6 pt-4">
                    {[
                      ["65%", "Faster page loads"],
                      ["35%", "More international inquiries"],
                    ].map(([value, label]) => (
                      <li key={label} className="bg-white/[0.02] border border-white/5 p-4 rounded">
                        <span className="block text-primary-container font-serif font-bold text-3xl">{value}</span>
                        <span className="block text-xs text-stone-400 font-mono uppercase tracking-wider mt-1">{label}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/portfolio/orion-pharma-india" className="inline-block text-sm font-mono text-oven-orange hover:underline">
                    Read the full case study <span aria-hidden="true">→</span>
                  </Link>
                </div>
                <div className="lg:col-span-5">
                  <Panel src="/images/about/case-study.webp" alt="Orion Pharma India website analytics mockup" width={512} height={382} />
                </div>
              </div>
            </div>
          </section>

          <section className="svc-panel mt-16 border-t border-white/5 pt-16 lg:pt-24" data-animate="fade-up">
            <div className="glass-card p-8 md:p-12 rounded-xl border border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 space-y-4">
                <p className="cin-eyebrow text-xs tracking-widest block uppercase">{"// THE STUDIO"}</p>
                <h2 className="cin-heading text-2xl md:text-3xl font-serif font-bold text-cream">About PizzaScript</h2>
              </div>
              <div className="lg:col-span-8 space-y-6 text-stone-300 text-sm md:text-base leading-relaxed">
                <p>
                  We are PizzaScript, a custom web engineering studio based in Pune, Maharashtra. Over the past 5 years, we
                  have collaborated with design agencies, software studios, and businesses to build scalable layouts and
                  performance-focused frontends.
                </p>
                <p>
                  We specialize in the React and Next.js ecosystem — automated workflows, edge deployments, and
                  interactive animations that bridge creative visual design and clean computer science.
                </p>
                <div className="pt-4 flex flex-wrap gap-6">
                  <a
                    href={SITE.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary-container hover:underline uppercase tracking-wider"
                  >
                    GitHub Profile <span aria-hidden="true">↗</span>
                  </a>
                  <Link href="/#order" className="text-xs font-mono text-stone-200 hover:underline uppercase tracking-wider">
                    Work With Us <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="svc-panel mt-16 border-t border-white/5 pt-16 lg:pt-24 pb-12 text-center" data-animate="fade-up">
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="cin-heading text-4xl md:text-5xl font-serif font-bold text-cream leading-tight">
                Ready to Build Something Exceptional?
              </h2>
              <p className="cin-text text-stone-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                Stop settling for average visual builders. Let&apos;s engineer a digital experience that actually moves the
                needle for your speed and search visibility.
              </p>
              <div className="pt-4">
                <Link
                  href="/#order"
                  className="bg-primary-container hover:bg-ember text-black font-bold px-12 py-5 rounded-sm text-sm font-mono uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] inline-block shadow-[0_0_40px_rgba(255,87,51,0.25)]"
                >
                  Start Your Project
                </Link>
              </div>
            </div>
            <div className="mt-20 max-w-4xl mx-auto group" data-animate="fade-up" data-animate-delay="2">
              <div className="glass-card p-4 rounded-xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                <Image
                  src="/images/about/cta.webp"
                  alt=""
                  width={512}
                  height={286}
                  sizes="(min-width: 1024px) 860px, 100vw"
                  className="w-full h-auto opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-90 transition-all duration-700 rounded-lg"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
