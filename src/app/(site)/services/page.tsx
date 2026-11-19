import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import Image from "next/image";
import { MoveRight } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { TiltLink } from "@/components/TiltLink";
import { SERVICES } from "@/data/services";
import { breadcrumbSchema, graph, serviceSchema } from "@/lib/schema";

export const metadata: Metadata = pageMetadata({ title: "Web Development Services", description: "Custom websites, landing pages, redesigns, technical SEO, speed optimization and maintenance — hand-built React and Next.js engineering from a Pune studio.", path: "/services" });

const TICKER = [
  ["SYSTEM_STATUS", "OPTIMIZED"],
  ["STACK", "NEXT.JS + REACT"],
  ["TEMPLATES", "0"],
  ["DEPLOY", "EDGE"],
];

export default function ServicesHubPage() {
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
          ]),
          {
            "@type": "ItemList",
            itemListElement: SERVICES.map((service, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: serviceSchema(service.name, service.schemaDescription, `/services/${service.slug}`),
            })),
          },
        )}
      />

      <div className="code-pattern-bg" aria-hidden="true">
        <div className="scrolling-code grid grid-cols-6 gap-8 w-full opacity-30">
          <div className="matrix-text">PIZZA SCRIPT PIZZA SCRIPT PIZZA SCRIPT PIZZA SCRIPT PIZZA SCRIPT PIZZA SCRIPT</div>
          <div className="matrix-text" style={{ animationDelay: "-20s" }}>DEPLOY REACT NEXT TAILWIND CLOUDFLARE VERCEL</div>
          <div className="matrix-text" style={{ animationDelay: "-40s" }}>01011010 11001010 10101010 00111100 11110000</div>
          <div className="matrix-text" style={{ animationDelay: "-60s" }}>ENGINEERING INFRASTRUCTURE PERFORMANCE OPTIMIZATION</div>
          <div className="matrix-text" style={{ animationDelay: "-10s" }}>COMPILING... RUNNING... CACHING... SCALING...</div>
          <div className="matrix-text" style={{ animationDelay: "-35s" }}>GSAP LENIS WEBGL SHADER CANVAS ANIMATION</div>
        </div>
      </div>

      <div className="services-hub-container pb-section-gap px-gutter max-w-container-max mx-auto relative">
        <Breadcrumbs className="mb-10 relative z-10" items={[{ name: "Home", href: "/" }, { name: "Services" }]} />

        <div className="mb-section-gap relative z-10">
          <p className="font-eyebrow-mono text-primary-container text-eyebrow-mono mb-4">{"// Capabilities"}</p>
          <h1 className="font-display-lg text-display-lg text-on-surface mb-6 max-w-4xl">
            Our Web <span className="font-display-lg-italic italic text-display-lg-italic text-primary-container">Engineering</span>{" "}
            Services
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            We build clean, standards-compliant frontends and fast edge infrastructure. No templates, no bloat — just
            high-performance digital systems crafted for results.
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((service) => (
            <li key={service.slug} className="flex">
              <TiltLink href={`/services/${service.slug}`} className="glass-card rounded-xl flex flex-col h-full w-full group/card">
                <div className="h-48 md:h-52 bg-surface-container-lowest overflow-hidden relative rounded-lg mb-5 group">
                  <Image
                    src={service.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
                    className="object-cover opacity-70 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0604]/80 to-transparent" />
                </div>
                <div className="flex flex-col flex-grow">
                  <p className="font-eyebrow-mono text-primary-container text-label-sm mb-2 uppercase">{`// ${service.hub.keyword}`}</p>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3 group-hover/card:text-primary-container transition-colors">
                    {service.name}
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6 flex-grow leading-relaxed">
                    {service.hub.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto gap-3">
                    <span className="perf-badge">{service.hub.metric}</span>
                    <span className="flex items-center gap-2 font-eyebrow-mono text-label-sm text-on-surface group-hover/card:text-primary-container transition-colors">
                      View details
                      <MoveRight aria-hidden="true" size={18} className="transition-transform group-hover/card:translate-x-1" />
                    </span>
                  </div>
                </div>
              </TiltLink>
            </li>
          ))}
        </ul>

        <div className="mt-section-gap border-y border-outline-variant/20 py-8 overflow-hidden" aria-hidden="true">
          <div className="flex whitespace-nowrap animate-marquee items-center gap-12 font-eyebrow-mono text-on-surface-variant text-label-sm">
            {[...TICKER, ...TICKER].map(([label, value], i) => (
              <span key={i} className="flex items-center gap-12">
                <span>
                  {label}: <span className="text-primary-container">{value}</span>
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
