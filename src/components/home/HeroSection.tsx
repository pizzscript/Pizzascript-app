"use client";

/* eslint-disable @next/next/no-img-element -- poster frame comes from the same CDN as the canvas frames. */
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useScroll } from "@/components/motion/ScrollProvider";
import { useHeroMouseTrail } from "@/hooks/useHeroMouseTrail";
import { useImageSequence } from "@/hooks/useImageSequence";
import { heroFramePath } from "@/lib/frames";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const { scrollTo } = useScroll();

  useImageSequence(sectionRef, [canvasRef], {
    frameCount: 96,
    framePath: heroFramePath,
    scrub: 0.4,
    eager: true,
  });
  useHeroMouseTrail(trailRef, sectionRef);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const ctx = gsap.context(() => {
      gsap.to([".hero-scroll-hint", ".hero-mobile-scroll-hint"], {
        opacity: 0,
        pointerEvents: "none",
        scrollTrigger: { trigger: section, start: "top top", end: "top+=100 top", scrub: true },
      });
    }, section);
    return () => ctx.revert();
  }, []);

  const explore = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    scrollTo("menu", { duration: 1.6 });
  };
  const order = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    scrollTo("order", { duration: 2.4 });
  };

  return (
    <section id="kitchen" className="hero-scroll-driver" ref={sectionRef} aria-labelledby="hero-title">
      <div className="hero-sticky">
        <div className="hero-canvas-wrap">
          <img
            className="hero-poster"
            src={heroFramePath(0)}
            alt=""
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
          />
          <canvas ref={canvasRef} id="hero-canvas" aria-hidden="true" style={{ position: "relative" }} />
          <canvas ref={trailRef} className="hero-trail-canvas" aria-hidden="true" />
        </div>

        <div className="hero-mobile-overlay">
          <div className="hero-mobile-content">
            <h1 id="hero-title" className="hero-mobile-title">
              Pizza<span className="hero-mobile-title-script">Script</span>
              <span className="sr-only"> — hand-crafted websites and web apps, built from scratch in Pune</span>
            </h1>
            <p className="hero-mobile-tagline">
              Hand-crafted websites,
              <br />
              made from scratch.
            </p>
            <div className="hero-mobile-ctas">
              <a href="#menu" className="btn btn-primary hero-mobile-btn" onClick={explore}>
                Explore the Kitchen
              </a>
              <a href="#order" className="btn btn-secondary hero-mobile-btn" onClick={order}>
                Place an Order
              </a>
            </div>
          </div>
        </div>

        <div className="hero-mobile-scroll-hint" aria-hidden="true">
          <span>Scroll to explore</span>
          <span className="scroll-arrow">↓</span>
        </div>
        <div className="hero-scroll-hint" aria-hidden="true">
          <span>Scroll to explore</span>
          <span className="scroll-arrow">↓</span>
        </div>
      </div>
    </section>
  );
}
