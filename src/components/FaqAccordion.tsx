"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({ faqs }: { faqs: readonly { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const id = useId();

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {faqs.map((faq, index) => {
        const isOpen = open === index;
        const buttonId = `${id}-q${index}`;
        const panelId = `${id}-a${index}`;
        return (
          <div key={faq.q} className={`faq-accordion-card ${isOpen ? "is-open" : ""}`}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="w-full text-left p-5 flex justify-between items-center gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-serif font-bold text-base md:text-lg text-cream">{faq.q}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`shrink-0 text-primary-container transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`faq-accordion-content ${isOpen ? "is-open" : ""}`}
              inert={!isOpen}
            >
              <div className="p-5 pt-0 border-t border-white/5 text-stone-300 text-sm leading-relaxed">{faq.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
