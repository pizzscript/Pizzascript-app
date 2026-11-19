"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMediaQuery } from "@/hooks/useMediaQuery";

gsap.registerPlugin(ScrollTrigger);

interface ScrollToOptions {
  duration?: number;
  immediate?: boolean;
  offset?: number;
}

interface ScrollContextValue {
  /** The active Lenis instance; null on touch/narrow screens and with reduced motion. */
  getLenis: () => Lenis | null;
  scrollTo: (target: HTMLElement | number | string, options?: ScrollToOptions) => void;
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function resolveTarget(target: HTMLElement | number | string) {
  if (typeof target !== "string") return target;
  return document.getElementById(target.replace(/^#/, ""));
}

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const smoothEnabled = useMediaQuery("(min-width: 769px) and (prefers-reduced-motion: no-preference)");
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!smoothEnabled) return;
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    lenisRef.current = lenis;
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [smoothEnabled]);

  const value = useMemo<ScrollContextValue>(
    () => ({
      getLenis: () => lenisRef.current,
      scrollTo: (target, options = {}) => {
        const resolved = resolveTarget(target);
        if (resolved === null) return;
        const lenis = lenisRef.current;
        if (lenis) {
          lenis.scrollTo(resolved, {
            duration: options.duration,
            immediate: options.immediate,
            offset: options.offset,
            easing: options.duration ? easeInOutCubic : undefined,
          });
          return;
        }
        const behavior: ScrollBehavior =
          options.immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        const top =
          typeof resolved === "number"
            ? resolved
            : resolved.getBoundingClientRect().top + window.scrollY + (options.offset ?? 0);
        window.scrollTo({ top, behavior });
      },
    }),
    [],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.location.hash) value.scrollTo(window.location.hash);
      else lenisRef.current?.scrollTo(0, { immediate: true });
      ScrollTrigger.refresh();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, value]);

  return <ScrollContext value={value}>{children}</ScrollContext>;
}

export function useScroll() {
  const context = useContext(ScrollContext);
  if (!context) throw new Error("useScroll must be used inside <ScrollProvider>");
  return context;
}
