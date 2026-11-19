import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { CASE_STUDIES } from "@/data/portfolio";
import { SERVICES, getService } from "@/data/services";
import { pageMetadata } from "@/lib/metadata";
import { breadcrumbSchema, faqSchema, graph, serviceSchema } from "@/lib/schema";

export function generateStaticParams() {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const service = getService((await params).slug);
  if (!service) return {};
  return pageMetadata({ title: service.seo.title, description: service.seo.description, path: `/services/${service.slug}` });
}

// cacheComponents requires `params` to be read inside a Suspense boundary; see the default export below.
async function ServiceContent({ params }: PageProps<"/services/[slug]">) {
  const service = getService((await params).slug);
  if (!service) notFound();

  const path = `/services/${service.slug}`;
  const [features, metrics, quality] = service.cards;

  return (
    <>
      <JsonLd
        data={graph(
          serviceSchema(service.name, service.schemaDescription, path),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.name, path },
          ]),
          faqSchema(service.faqs),
        )}
      />

      <div className="min-h-screen pt-36 lg:pt-44 pb-16 px-4 md:px-12 lg:px-24 text-cream relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-24">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Services", href: "/services" }, { name: service.name }]} />

          <section className="svc-panel grid grid-cols-1 lg:grid-cols-12 gap-16 items-center" aria-labelledby="service-title">
            <div className="lg:col-span-7 space-y-6">
              <p className="cin-eyebrow text-xs tracking-widest block uppercase">{"// SERVICE DETAIL"}</p>
              <h1 id="service-title" className="cin-heading text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-tight">
                {service.heading[0]} <span className="italic text-primary-container font-serif">{service.heading[1]}</span>
              </h1>
              <p className="cin-text text-stone-300 text-base leading-relaxed">{service.intro}</p>
              <div className="flex flex-wrap gap-4 pt-2">
                <span className="bg-primary-container/10 border border-primary-container/30 text-primary-container px-4 py-1 font-mono text-xs uppercase">
                  {service.tags[0]}
                </span>
                <span className="border border-white/10 text-stone-300 px-4 py-1 font-mono text-xs uppercase">{service.tags[1]}</span>
              </div>
              <div className="pt-4">
                <Link
                  href="/#order"
                  className="inline-block bg-primary-container hover:bg-ember text-black font-bold px-8 py-4 rounded-sm text-xs font-mono uppercase tracking-widest transition-colors"
                >
                  Start a project
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 relative group">
              <div className="absolute -inset-4 bg-primary-container/10 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="glass-card p-2 border border-white/10 terminal-glow relative overflow-hidden aspect-square flex items-center justify-center">
                <Image
                  src={service.image}
                  alt={service.imageAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 420px, 100vw"
                  className="object-cover opacity-80 grayscale contrast-125 brightness-75 rounded"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8" aria-hidden="true">
                  <div className="font-eyebrow-mono text-xs text-primary/60 mb-2 uppercase tracking-widest">System Visualization</div>
                  <div className="h-1 w-full bg-white/10">
                    <div className="h-full bg-primary-container shadow-[0_0_8px_#ff5733]" style={{ width: `${service.heroProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="svc-panel grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="What's included">
            <div className="glass-card p-8 border-t-2 border-t-primary-container">
              <p className="font-eyebrow-mono text-eyebrow-mono text-primary-container mb-4">{features.eyebrow}</p>
              <h2 className="font-headline-sm text-headline-sm mb-6 text-cream">{features.heading}</h2>
              <ul className="space-y-4">
                {features.items.map((item) => (
                  <li key={item.label} className="flex items-center gap-3 text-stone-300 font-mono text-xs">
                    <Icon name={item.icon} className="text-primary-container shrink-0" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-card p-8 border-t-2 border-t-primary-container">
              <p className="font-eyebrow-mono text-eyebrow-mono text-primary-container mb-4">{metrics.eyebrow}</p>
              <h2 className="font-headline-sm text-headline-sm mb-6 text-cream">{metrics.heading}</h2>
              <div className="space-y-6">
                {metrics.metrics.map((metric) => (
                  <div key={metric.label}>
                    <div className="flex justify-between mb-2">
                      <span className="font-mono text-xs text-stone-300">{metric.label}</span>
                      <span className="font-mono text-xs text-primary-container">{metric.value}</span>
                    </div>
                    <div className="h-1 bg-white/5 w-full" aria-hidden="true">
                      <div className="h-full bg-primary-container" style={{ width: `${metric.percent}%` }} />
                    </div>
                  </div>
                ))}
                <div className="bg-primary-container/10 p-4 border-l-2 border-primary-container">
                  <p className="font-mono text-xs text-primary-container italic">{metrics.quote}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 border-t-2 border-t-primary-container">
              <p className="font-eyebrow-mono text-eyebrow-mono text-primary-container mb-4">{quality.eyebrow}</p>
              <h2 className="font-headline-sm text-headline-sm mb-6 text-cream">{quality.heading}</h2>
              <ul className="flex flex-wrap gap-2 mb-6">
                {quality.badges.map((badge) => (
                  <li key={badge} className="bg-white/5 px-2.5 py-1 font-mono text-xs text-stone-300 border border-white/5">
                    {badge}
                  </li>
                ))}
              </ul>
              <ul className="text-stone-300 font-mono text-xs space-y-3">
                {quality.checks.map((check) => (
                  <li key={check} className="flex items-start gap-2">
                    <Icon name="check_circle" size={16} className="text-primary-container shrink-0" />
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="svc-panel py-20" aria-labelledby="process-title">
            <div className="text-center mb-16">
              <p className="font-eyebrow-mono text-eyebrow-mono text-primary-container mb-4">{"// WORKFLOW"}</p>
              <h2 id="process-title" className="font-display-lg text-display-lg text-cream">
                The Engineering Process
              </h2>
            </div>
            <div className="relative">
              <div className="absolute left-1/2 top-16 bottom-16 w-px bg-white/10 -translate-x-1/2 hidden md:block" aria-hidden="true" />
              <ol className="space-y-16">
                {service.steps.map((step, index) => {
                  const textFirst = index % 2 === 0;
                  return (
                    <li key={step.label} className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                      <div className={textFirst ? "md:text-right md:pr-12 lg:pr-16" : "md:order-2 md:pl-12 lg:pl-16"}>
                        <span className="font-eyebrow-mono text-eyebrow-mono text-primary-container">{step.label}</span>
                        <h3 className="font-headline-md text-headline-md text-cream mt-2 mb-4">{step.title}</h3>
                        <p className={`font-body-md text-body-md text-stone-300 max-w-lg leading-relaxed ${textFirst ? "ml-auto" : ""}`}>
                          {step.description}
                        </p>
                      </div>
                      <div
                        className={`flex justify-center ${textFirst ? "md:pl-12 lg:pl-16" : "md:order-1 md:pr-12 lg:pr-16"}`}
                        aria-hidden="true"
                      >
                        <div className="glass-card p-6 border-primary-container/30">
                          <Icon name={step.icon} size={48} className="text-primary-container" />
                        </div>
                      </div>
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block" aria-hidden="true">
                        <div className={`w-4 h-4 bg-primary-container rotate-45 ${index === 0 ? "shadow-[0_0_10px_#ff5733]" : ""}`} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <section aria-labelledby="related-work-title">
            <div className="glass-card p-10 relative overflow-hidden rounded-xl">
              <p className="font-eyebrow-mono text-eyebrow-mono text-primary-container mb-4">{"// RECENT WORK"}</p>
              <h2 id="related-work-title" className="font-headline-md text-headline-md text-cream mb-8">
                See how we&apos;ve delivered for real clients
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CASE_STUDIES.map((study) => (
                  <li key={study.slug}>
                    <Link href={`/portfolio/${study.slug}`} className="group block">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/10">
                        <Image
                          src={study.screenshot}
                          alt=""
                          fill
                          sizes="(min-width: 768px) 480px, 100vw"
                          className="object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                      <p className="mt-4 font-serif font-bold text-lg text-cream group-hover:text-oven-orange transition-colors">
                        {study.name} case study <span aria-hidden="true">→</span>
                      </p>
                      <p className="text-sm text-stone-400">{study.category}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="svc-panel border-t border-white/5 pt-16" aria-labelledby="faq-title">
            <h2 id="faq-title" className="cin-heading text-3xl font-serif font-bold text-cream text-center mb-12">
              Frequently Asked <span className="italic text-primary-container">Questions</span>
            </h2>
            <FaqAccordion faqs={service.faqs} />
          </section>

          <nav aria-label="Other services" className="border-t border-white/5 pt-12">
            <h2 className="font-eyebrow-mono text-sm text-stone-400 uppercase tracking-widest mb-6">Other services</h2>
            <ul className="flex flex-wrap gap-3">
              {SERVICES.filter((s) => s.slug !== service.slug).map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="inline-block border border-white/10 rounded-full px-4 py-2 text-sm text-stone-300 hover:text-oven-orange hover:border-oven-orange/40 transition-colors"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}

export default function ServicePage(props: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={null}>
      <ServiceContent {...props} />
    </Suspense>
  );
}
