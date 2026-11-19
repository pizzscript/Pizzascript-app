"use client";

import { useEffect } from "react";
import { matrixState } from "@/lib/matrixState";

interface Particle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  decay: number;
}

const MIN_WIDTH = 1024;
const SPACING = 24;

/** Reveals the live matrix background through the hero wherever the mouse moves (desktop only). */
export function useHeroMouseTrail(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = [];
    let running = false;
    let disposed = false;
    let last: { x: number; y: number } | null = null;
    let rect = canvas.getBoundingClientRect();

    const brush = document.createElement("canvas");
    brush.width = brush.height = 256;
    const brushCtx = brush.getContext("2d")!;
    const gradient = brushCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.4)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    brushCtx.fillStyle = gradient;
    brushCtx.fillRect(0, 0, 256, 256);

    const resize = () => {
      rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const frame = () => {
      if (disposed) return;
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (particles.length === 0) {
        running = false;
        return;
      }
      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(brush, p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      }
      ctx.globalAlpha = 1;

      const matrix = matrixState.canvas;
      if (matrix && matrix.width > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "source-in";
        ctx.drawImage(matrix, 0, matrixState.shift, matrix.width, rect.height, 0, 0, rect.width, rect.height);
        ctx.restore();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].alpha -= particles[i].decay;
        if (particles[i].alpha <= 0) particles.splice(i, 1);
      }
      requestAnimationFrame(frame);
    };

    const spawn = (x: number, y: number) =>
      particles.push({ x, y, radius: Math.random() * 60 + 100, alpha: 0.5, decay: Math.random() * 0.04 + 0.07 });

    const onMove = (e: MouseEvent) => {
      if (window.innerWidth < MIN_WIDTH) return;
      matrixState.spotlightDisabled = true;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!last) {
        spawn(x, y);
      } else {
        const dx = x - last.x;
        const dy = y - last.y;
        const steps = Math.floor(Math.hypot(dx, dy) / SPACING);
        if (steps === 0) spawn(x, y);
        for (let i = 1; i <= steps; i++) spawn(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
      }
      last = { x, y };
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    };
    const onLeave = () => {
      last = null;
      matrixState.spotlightDisabled = false;
    };
    const onScroll = () => (rect = canvas.getBoundingClientRect());

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      disposed = true;
      matrixState.spotlightDisabled = false;
      resizeObserver.disconnect();
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [canvasRef, containerRef]);
}
