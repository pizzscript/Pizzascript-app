"use client";

import { useEffect, useRef, useState } from "react";
import { pressStart } from "@/app/fonts";
import { matrixState } from "@/lib/matrixState";

const WORD = "PIZZASCRIPT".split("");
const GLYPHS = Array.from(new Set(WORD));
const WRAP_ROWS = 40;
const PER_LETTER_STEP = 0.12;
const FRAME_INTERVAL = 1000 / 30;
const BAND_MARGIN_ROWS = 10;
const SPOTLIGHT_RADIUS = 220;
const STAMP = 64;

const STYLES = [
  { id: "dim_noise", color: "#3a1800", glow: 0, glowColor: "", alpha: 0.18 },
  { id: "mid_noise", color: "#993300", glow: 4, glowColor: "#993300", alpha: 0.75 },
  { id: "bright_noise", color: "#FF6A00", glow: 8, glowColor: "#FF6A00", alpha: 1 },
  { id: "spotlight_glow", color: "#FFCC00", glow: 24, glowColor: "#FF6A00", alpha: 1 },
  { id: "word_white", color: "#ffffff", glow: 22, glowColor: "#FF6A00", alpha: 1 },
  { id: "word_gold", color: "#ffcc77", glow: 14, glowColor: "#FF6A00", alpha: 1 },
  { id: "word_orange", color: "#FF6A00", glow: 6, glowColor: "#FF6A00", alpha: 1 },
] as const;

type StyleId = (typeof STYLES)[number]["id"];

interface Cell {
  char: string;
  isWord: boolean;
  dur: number;
  del: number;
  cycle: number;
  ddel: number;
  brightness: "dim" | "mid" | "bright";
}

function buildStamps(fontFamily: string) {
  const stamps = new Map<string, HTMLCanvasElement>();
  for (const char of GLYPHS) {
    for (const style of STYLES) {
      const canvas = document.createElement("canvas");
      canvas.width = STAMP;
      canvas.height = STAMP;
      const ctx = canvas.getContext("2d")!;
      ctx.font = `13px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = style.alpha;
      ctx.fillStyle = style.color;
      if (style.glow > 0) {
        ctx.shadowBlur = style.glow;
        ctx.shadowColor = style.glowColor;
      }
      ctx.fillText(char, STAMP / 2, STAMP / 2);
      stamps.set(`${char}_${style.id}`, canvas);
    }
  }
  return stamps;
}

function buildPattern(cols: number) {
  const letters = Array.from({ length: WRAP_ROWS }, () =>
    Array.from({ length: cols }, () => WORD[Math.floor(Math.random() * WORD.length)]),
  );
  const wordMeta: ({ id: number; idx: number } | null)[][] = Array.from({ length: WRAP_ROWS }, () =>
    Array(cols).fill(null),
  );
  const colRanges: [number, number][][] = Array.from({ length: cols }, () => []);
  const rowRanges: [number, number][][] = Array.from({ length: WRAP_ROWS }, () => []);
  let wordCount = 0;
  const blocked = (ranges: [number, number][], start: number, end: number) =>
    ranges.some(([s, e]) => start <= e + 2 && end >= s - 2);

  for (let band = 0; band < cols; band += 5) {
    const col = band + Math.floor(Math.random() * Math.min(5, cols - band));
    for (let attempt = 0; attempt < 20; attempt++) {
      const start = Math.floor(Math.random() * (WRAP_ROWS - WORD.length));
      if (blocked(colRanges[col], start, start + WORD.length - 1)) continue;
      const id = wordCount++;
      colRanges[col].push([start, start + WORD.length - 1]);
      WORD.forEach((ch, i) => {
        letters[start + i][col] = ch;
        wordMeta[start + i][col] = { id, idx: i };
      });
      break;
    }
  }
  if (cols > WORD.length) {
    for (let band = 0; band < WRAP_ROWS; band += 4) {
      const row = band + Math.floor(Math.random() * Math.min(4, WRAP_ROWS - band));
      for (let attempt = 0; attempt < 20; attempt++) {
        const start = Math.floor(Math.random() * (cols - WORD.length));
        if (blocked(rowRanges[row], start, start + WORD.length - 1)) continue;
        const id = wordCount++;
        rowRanges[row].push([start, start + WORD.length - 1]);
        WORD.forEach((ch, i) => {
          letters[row][start + i] = ch;
          wordMeta[row][start + i] = { id, idx: i };
        });
        break;
      }
    }
  }

  const cycles = Array.from({ length: wordCount }, () => 5 + Math.random() * 5);
  const bases = Array.from({ length: wordCount }, () => Math.random() * 5);
  const cells: Cell[][] = letters.map((row, r) =>
    row.map((char, c) => {
      const b = Math.random();
      const seed = (r * 73 + c * 37) % 100;
      const meta = wordMeta[r][c];
      return {
        char,
        isWord: meta !== null,
        dur: 3 + (seed % 8),
        del: (seed * 0.07) % 7,
        cycle: meta ? cycles[meta.id] : 0,
        ddel: meta ? bases[meta.id] + meta.idx * PER_LETTER_STEP : 0,
        brightness: b < 0.28 ? "dim" : b < 0.48 ? "mid" : "bright",
      };
    }),
  );
  return cells;
}

function styleFor(cell: Cell, time: number): StyleId {
  if (cell.isWord) {
    const drop = (((time * 2 - cell.ddel) % cell.cycle) + cell.cycle) % cell.cycle / cell.cycle;
    if (drop < 0.03) return "word_white";
    if (drop < 0.25) return "word_gold";
    if (drop < 0.55) return "word_orange";
  }
  const t = time * 0.125;
  const progress = ((((t - cell.del) % cell.dur) + cell.dur) % cell.dur) / cell.dur;
  const flicker = (progress >= 0.18 && progress <= 0.21) || (progress >= 0.56 && progress <= 0.565);
  if (flicker || cell.brightness === "dim") return "dim_noise";
  return cell.brightness === "mid" ? "mid_noise" : "bright_noise";
}

export function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let raf = 0;
    let stamps: Map<string, HTMLCanvasElement> | null = null;
    let pattern: Cell[][] = [];
    let cellSize = 26;
    let cols = 1;
    let viewportH = 0;
    let rows = 0;
    let time = 0;
    let lastTick = 0;
    let lastDraw = 0;
    let scrolling = false;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    let mouse: { x: number; y: number } | null = null;

    const layout = () => {
      const width = window.innerWidth;
      viewportH = window.innerHeight;
      cellSize = width < 768 ? 16 : 26;
      const nextCols = Math.max(1, Math.floor(width / cellSize));
      if (nextCols !== cols || pattern.length === 0) {
        cols = nextCols;
        pattern = buildPattern(cols);
      }
      const wrapHeight = WRAP_ROWS * cellSize;
      const logicalH = Math.ceil((viewportH + wrapHeight) / cellSize) * cellSize;
      rows = logicalH / cellSize;
      canvas.width = width;
      canvas.height = logicalH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${logicalH}px`;
    };

    const applyShift = () => {
      const shift = window.scrollY % (WRAP_ROWS * cellSize);
      matrixState.shift = shift;
      wrapper.style.transform = `translate3d(0, ${-shift}px, 0)`;
      return shift;
    };

    let drawnTop = 0;
    let drawnBottom = -1;

    const draw = () => {
      if (!stamps) return;
      const shift = matrixState.shift;
      const width = canvas.width;
      const cellW = width / cols;
      const scale = cellSize / 26;
      const firstRow = Math.max(0, Math.floor(shift / cellSize) - BAND_MARGIN_ROWS);
      const lastRow = Math.min(rows - 1, Math.ceil((shift + viewportH) / cellSize) + BAND_MARGIN_ROWS);
      const spotlight = !reduced && !matrixState.spotlightDisabled && cellSize === 26 ? mouse : null;
      drawnTop = firstRow * cellSize;
      drawnBottom = (lastRow + 1) * cellSize;

      ctx.clearRect(0, 0, width, canvas.height);
      for (let r = firstRow; r <= lastRow; r++) {
        const source = pattern[r % WRAP_ROWS];
        const baseY = r * cellSize + cellSize / 2;
        for (let c = 0; c < cols; c++) {
          const cell = source[c];
          let x = c * cellW + cellW / 2;
          let y = baseY;
          let size = STAMP * scale;
          let glow = 0;
          if (spotlight) {
            const dx = x - spotlight.x;
            const dy = y - shift - spotlight.y;
            if (Math.abs(dx) < SPOTLIGHT_RADIUS && Math.abs(dy) < SPOTLIGHT_RADIUS) {
              const dist = Math.hypot(dx, dy);
              if (dist < SPOTLIGHT_RADIUS) {
                glow = (1 + Math.cos((Math.PI * dist) / SPOTLIGHT_RADIUS)) / 2;
                size *= 1 + 0.18 * glow;
                if (dist > 0) {
                  const push = glow * (1 - glow) * 24;
                  x += (dx / dist) * push;
                  y += (dy / dist) * push;
                }
              }
            }
          }
          const stamp = stamps.get(`${cell.char}_${styleFor(cell, time)}`);
          if (stamp) ctx.drawImage(stamp, x - size / 2, y - size / 2, size, size);
          if (glow > 0) {
            const highlight = stamps.get(`${cell.char}_spotlight_glow`);
            if (highlight) {
              ctx.globalAlpha = Math.pow(glow, 1.2);
              ctx.drawImage(highlight, x - size / 2, y - size / 2, size, size);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    };

    const loop = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const delta = lastTick ? Math.min(now - lastTick, 100) : 0;
      lastTick = now;
      if (!scrolling) time += delta / 1000;
      if (now - lastDraw < FRAME_INTERVAL) return;
      const shift = matrixState.shift;
      const bandStillVisible = shift >= drawnTop && shift + viewportH <= drawnBottom;
      if (scrolling && !mouse && bandStillVisible) return;
      lastDraw = now;
      draw();
    };

    const start = () => {
      if (disposed || document.hidden || reduced || raf) return;
      lastTick = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onScroll = () => {
      applyShift();
      scrolling = true;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => (scrolling = false), 120);
      if (reduced) draw();
    };
    const onResize = () => {
      layout();
      applyShift();
      draw();
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMouseMove = (e: MouseEvent) => (mouse = { x: e.clientX, y: e.clientY });
    const onMouseLeave = () => (mouse = null);

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const onResizeDebounced = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 200);
    };

    const init = async () => {
      const fontFamily = pressStart.style.fontFamily;
      await Promise.race([
        document.fonts.load(`13px ${fontFamily}`),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]).catch(() => undefined);
      if (disposed) return;
      stamps = buildStamps(fontFamily);
      layout();
      applyShift();
      matrixState.canvas = canvas;
      draw();
      setReady(true);
      start();
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const idleHandle = idle(() => void init());

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResizeDebounced);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      stop();
      cancelIdle(idleHandle);
      clearTimeout(scrollTimer);
      clearTimeout(resizeTimer);
      matrixState.canvas = null;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResizeDebounced);
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -10,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: ready ? 0.55 : 0,
        transition: "opacity 1.5s ease-in-out",
      }}
    >
      <div ref={wrapperRef} style={{ position: "absolute", top: 0, left: 0, willChange: "transform" }}>
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>
    </div>
  );
}
