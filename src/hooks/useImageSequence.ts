"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { acquireFrame, releaseFrame, type FrameEntry } from "@/lib/frameLoader";
import { requestScrollRefresh } from "@/lib/scrollRefresh";
import { prefersReducedMotion } from "@/hooks/useMediaQuery";

gsap.registerPlugin(ScrollTrigger);

const MAX_DPR = 1.5;

export interface ImageSequenceOptions {
  frameCount: number;
  framePath: (index: number) => string;
  fit?: "cover" | "contain";
  zoom?: number;
  scrub?: number;
  /** Start loading immediately instead of when the section approaches the viewport. */
  eager?: boolean;
  /** With reduced motion, the canvas holds one key frame per step instead of scrubbing. */
  reducedMotionSteps?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Draws a scroll-scrubbed frame sequence into whichever of the given canvases is currently visible.
 * Several canvases are supported so mobile and desktop layouts can both be server-rendered.
 */
export function useImageSequence(
  sectionRef: React.RefObject<HTMLElement | null>,
  canvasRefs: React.RefObject<HTMLCanvasElement | null>[],
  options: ImageSequenceOptions,
) {
  const onProgressRef = useRef(options.onProgress);
  useEffect(() => {
    onProgressRef.current = options.onProgress;
  });

  const { frameCount, framePath, fit = "cover", zoom = 1, scrub = 0.6, eager = false, reducedMotionSteps = 3 } = options;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const canvases = canvasRefs.map((ref) => ref.current).filter((c): c is HTMLCanvasElement => c !== null);
    if (canvases.length === 0) return;

    const urls = Array.from({ length: frameCount }, (_, i) => framePath(i));
    const frames: (FrameEntry | null)[] = new Array(frameCount).fill(null);
    const reduced = prefersReducedMotion();
    let current = 0;
    let started = false;
    let disposed = false;
    let frameRequest = 0;

    const pickFrame = (index: number) => {
      for (let i = index; i >= 0; i--) {
        const entry = frames[i];
        if (entry?.loaded) return entry.img;
      }
      return null;
    };

    const draw = () => {
      frameRequest = 0;
      const img = pickFrame(current);
      if (!img) return;
      for (const canvas of canvases) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width === 0 || height === 0) continue;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const targetW = Math.round(width * dpr);
        const targetH = Math.round(height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        const scale =
          (fit === "contain"
            ? Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight)
            : Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight)) * zoom;
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h);
      }
    };

    const requestDraw = () => {
      if (!frameRequest && !disposed) frameRequest = requestAnimationFrame(draw);
    };

    const startLoading = () => {
      if (started || disposed) return;
      started = true;
      const first = acquireFrame(urls[0], true);
      frames[0] = first;
      first.promise.then(requestDraw);
      for (let i = 1; i < frameCount; i++) {
        const entry = acquireFrame(urls[i]);
        frames[i] = entry;
        if (i === current) entry.promise.then(requestDraw);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startLoading();
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    if (eager) startLoading();
    else io.observe(section);

    const resizeObserver = new ResizeObserver(requestDraw);
    canvases.forEach((canvas) => resizeObserver.observe(canvas));

    const toFrame = (progress: number) => {
      const p = reduced
        ? Math.min(Math.floor(progress * reducedMotionSteps), reducedMotionSteps - 1) / reducedMotionSteps + 0.5 / reducedMotionSteps
        : progress;
      return Math.min(frameCount - 1, Math.max(0, Math.round(p * (frameCount - 1))));
    };

    const ctx = gsap.context(() => {
      const proxy = { progress: 0 };
      gsap.to(proxy, {
        progress: 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: reduced ? true : scrub,
        },
        onUpdate: () => {
          const next = toFrame(proxy.progress);
          if (next !== current) {
            current = next;
            const entry = frames[next];
            if (entry && !entry.loaded) entry.promise.then(() => current === next && requestDraw());
            requestDraw();
          }
          onProgressRef.current?.(proxy.progress);
        },
      });
    }, section);
    requestScrollRefresh();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRequest);
      io.disconnect();
      resizeObserver.disconnect();
      ctx.revert();
      if (started) urls.forEach(releaseFrame);
      requestScrollRefresh();
    };
    // canvasRefs is a stable list of refs created by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionRef, frameCount, framePath, fit, zoom, scrub, eager, reducedMotionSteps]);
}
