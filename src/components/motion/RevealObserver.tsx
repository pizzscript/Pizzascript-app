"use client";

import { useEffect } from "react";

const SELECTOR = "[data-animate]:not(.animate-in)";

export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("animate-in");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    const observeAll = () => document.querySelectorAll(SELECTOR).forEach((el) => io.observe(el));
    // Deferred a frame: an element already in view can fire the observer in the same tick as this
    // effect, adding .animate-in before a still-streaming Suspense boundary finishes hydrating the
    // same subtree — React then reports a hydration mismatch for that later-resolving chunk.
    let startFrame = requestAnimationFrame(() => {
      startFrame = requestAnimationFrame(observeAll);
    });

    // Picks up elements from client navigations and streamed content.
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(observeAll);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(startFrame);
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
