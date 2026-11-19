"use client";

import { useEffect, useRef, useState } from "react";
import { useScroll } from "@/components/motion/ScrollProvider";

const ICONS: Record<string, React.ReactNode> = {
  menu: (
    <>
      <rect x="3" y="1.5" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 1V2.5H8.5V1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M5.5 5H8.5M5.5 7.5H8.5M5.5 10H7" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </>
  ),
  dough: (
    <>
      <path d="M4.5 2L1 7L4.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 2L13 7L9.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  toppings: (
    <path
      d="M9 1.5C9 2.33 8.33 3 7.5 3H6.5C5.67 3 5 2.33 5 1.5M3 5H2.5C1.67 5 1 5.67 1 6.5C1 7.33 1.67 8 2.5 8H3M11 5H11.5C12.33 5 13 5.67 13 6.5C13 7.33 12.33 8 11.5 8H11M5 13C5 12.17 5.67 11.5 6.5 11.5H7.5C8.33 11.5 9 12.17 9 13M3 3H11V11H3V3Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  baking: (
    <>
      <path
        d="M7 1C7 1 3 5 3 8.5C3 10.71 4.79 12.5 7 12.5C9.21 12.5 11 10.71 11 8.5C11 5 7 1 7 1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 9.5C7 9.5 5.5 8 5.5 6.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </>
  ),
  removing: (
    <>
      <path d="M8.5 5.5L12 2M12 2H9.5M12 2V4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 7L2.5 9.5L4.5 9.5L4.5 11.5L7 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 8C4.5 6.5 4.5 4 6 2.5C7.5 4 10 4 11.5 2.5C11.5 4 10 6.5 8 8L6 8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  aroma: (
    <>
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 9L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="0.8" />
    </>
  ),
  "chef-specials": (
    <>
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
    </>
  ),
  reviews: (
    <>
      <path d="M2 2H12V9H6L3 12V9H2V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4L7.6 5.5H9L7.9 6.5L8.3 8L7 7.2L5.7 8L6.1 6.5L5 5.5H6.4L7 4Z" fill="currentColor" />
    </>
  ),
  order: (
    <>
      <rect x="1.5" y="3" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 4L7 8L12.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

const SECTIONS = [
  { id: "menu", label: "Stack" },
  { id: "dough", label: "Foundation" },
  { id: "toppings", label: "Features" },
  { id: "baking", label: "Process" },
  { id: "removing", label: "Launch" },
  { id: "aroma", label: "SEO" },
  { id: "chef-specials", label: "Work" },
  { id: "reviews", label: "Reviews" },
  { id: "order", label: "Order" },
];

export function SectionNav() {
  const { scrollTo } = useScroll();
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<HTMLDivElement>(null);
  const offsets = useRef<number[]>([]);
  const heroEnd = useRef(0);

  useEffect(() => {
    const measure = () => {
      const y = window.scrollY;
      offsets.current = SECTIONS.map(({ id }) => (document.getElementById(id)?.getBoundingClientRect().top ?? 0) + y);
      heroEnd.current = document.getElementById("kitchen")?.offsetHeight ?? window.innerHeight;
      const footer = document.querySelector("footer");
      trackerRef.current?.style.setProperty("--footer-height", `${footer?.offsetHeight ?? 0}px`);
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const isMobile = window.innerWidth < 768;
      const max = document.documentElement.scrollHeight - vh;
      const percent = max > 0 ? (y / max) * 100 : 0;
      if (fillRef.current) {
        fillRef.current.style.height = isMobile ? "100%" : `${percent}%`;
        fillRef.current.style.width = isMobile ? `${percent}%` : "100%";
      }
      setVisible(isMobile ? y >= vh * 1.2 : y >= heroEnd.current - vh * 0.3);
      const trigger = y + vh * (isMobile ? 0.5 : 0.3);
      let index = 0;
      offsets.current.forEach((top, i) => {
        if (trigger >= top) index = i;
      });
      setActive(y >= max - 5 ? SECTIONS.length - 1 : index);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    measure();
    update();
    const resizeObserver = new ResizeObserver(() => {
      measure();
      onScroll();
    });
    resizeObserver.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const go = (index: number) => {
    const target = SECTIONS[index];
    if (!target) return;
    const distance = Math.abs(index - active);
    scrollTo(target.id, { duration: Math.min(0.8 + distance * 0.4, 3.2) });
  };

  return (
    <div className="section-nav-tracker" ref={trackerRef}>
      <nav
        className={`section-nav${visible ? " section-nav--visible" : ""}`}
        aria-label="Home page sections"
        aria-hidden={!visible}
        style={{ "--active-index": active } as React.CSSProperties}
      >
        <button
          type="button"
          className="section-nav__btn section-nav__arrow"
          aria-label="Previous section"
          onClick={() => go(active - 1)}
          disabled={active === 0}
          tabIndex={visible ? undefined : -1}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 2L2 9H12L7 2Z" fill="currentColor" />
          </svg>
        </button>

        <div className="section-nav__progress-track">
          <div className="section-nav__progress-fill" ref={fillRef} />
        </div>

        <div className="section-nav__dots-viewport">
          <div className="section-nav__dots">
            {SECTIONS.map((section, index) => (
              <button
                type="button"
                key={section.id}
                className={`section-nav__dot${active === index ? " section-nav__dot--active" : ""}`}
                aria-label={`Go to ${section.label}`}
                aria-current={active === index ? "true" : undefined}
                data-tooltip={section.label}
                style={{ "--distance": Math.abs(index - active) } as React.CSSProperties}
                onClick={() => go(index)}
                tabIndex={visible ? undefined : -1}
              >
                <span className="section-nav__dot-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    {ICONS[section.id]}
                  </svg>
                </span>
                <span className="section-nav__dot-dot" />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="section-nav__btn section-nav__arrow"
          aria-label="Next section"
          onClick={() => go(active + 1)}
          disabled={active >= SECTIONS.length - 1}
          tabIndex={visible ? undefined : -1}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 12L12 5H2L7 12Z" fill="currentColor" />
          </svg>
        </button>

        <div className="section-nav__divider" />

        <button
          type="button"
          className="section-nav__btn section-nav__home"
          aria-label="Scroll to top"
          onClick={() => scrollTo(0, { duration: 1.2 })}
          tabIndex={visible ? undefined : -1}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1L1 8H4V14H7V10H9V14H12V8H15L8 1Z" fill="currentColor" />
          </svg>
        </button>
      </nav>
    </div>
  );
}
