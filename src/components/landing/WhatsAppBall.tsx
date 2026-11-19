"use client";

import { useEffect, useRef } from "react";
import { SITE } from "@/lib/site";

const GRAVITY = 980;
const BOUNCE = 0.65;
const OBSTACLE_BOUNCE = 1.25;
const AIR_DRAG = 0.999;
const SIZE = 60;
const FLOOR_THRESHOLD = 2;
const STUCK_FRAME_LIMIT = 24;
const CLICK_DIST = 6;
const CLICK_TIME = 250;
const OBSTACLES =
  ".fp-btn-primary, .fp-btn-secondary, .fp-nav-cta, .fp-split-image, .fp-service-card, .fp-blog-card, .fp-project-image-wrap, .fp-project-sidebar, .fp-btn-sidebar";

export function WhatsAppBall() {
  const ballRef = useRef<HTMLAnchorElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ball = ballRef.current;
    const pop = popRef.current;
    const body = bodyRef.current;
    if (!ball || !pop || !body) return;

    const pos = { x: 0, y: 0 };
    const vel = { x: 0, y: 0 };
    let rotation = 0;
    let raf = 0;
    let last = 0;
    let running = false;
    let disposed = false;
    let dragging = false;
    let popping = false;
    let stuck = 0;
    let suppressClick = false;
    let obstacles: HTMLElement[] = [];
    let ceiling = 0;
    const dragStart = { x: 0, y: 0, t: 0 };
    const dragPrev = { x: 0, y: 0, t: 0 };

    const apply = () => {
      ball.style.left = `${pos.x}px`;
      ball.style.top = `${pos.y}px`;
      body.style.transform = `rotate(${rotation}deg)`;
    };

    const scan = () => {
      obstacles = Array.from(document.querySelectorAll<HTMLElement>(OBSTACLES));
      ceiling = Math.max(0, document.querySelector(".fp-nav")?.getBoundingClientRect().bottom ?? 0);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pos.x = window.innerWidth - SIZE - 24;
      pos.y = window.innerHeight - SIZE - 24;
      apply();
      const onResize = () => {
        pos.x = window.innerWidth - SIZE - 24;
        pos.y = window.innerHeight - SIZE - 24;
        apply();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const start = () => {
      if (running || disposed) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    };

    const respawn = () => {
      if (popping) return;
      popping = true;
      stuck = 0;
      pop.classList.add("wa-ball-popped");
      setTimeout(() => {
        if (disposed) return;
        pos.x = Math.random() * (window.innerWidth - SIZE);
        pos.y = -SIZE - 40;
        vel.x = (Math.random() - 0.5) * 80;
        vel.y = 0;
        rotation = 0;
        pop.classList.remove("wa-ball-popped");
        popping = false;
        start();
      }, 350);
    };

    function tick(now: number) {
      if (disposed) return;
      if (popping) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(last ? (now - last) / 1000 : 0, 0.05);
      last = now;
      const maxX = window.innerWidth - SIZE;
      const maxY = window.innerHeight - SIZE;

      if (!dragging) {
        const wind = Math.sin(now * 0.0004) * 80 + Math.cos(now * 0.0011) * 40;
        vel.x += (wind - vel.x) * 0.55 * dt;
        vel.y += GRAVITY * dt;
        vel.x *= AIR_DRAG;
        vel.y *= AIR_DRAG;
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;

        const r = SIZE / 2;
        const cx = pos.x + r;
        const cy = pos.y + r;
        let colliding = false;
        if (window.innerWidth >= 768) {
          for (const el of obstacles) {
            if (el.offsetWidth === 0) continue;
            const rect = el.getBoundingClientRect();
            if (cx + r < rect.left || cx - r > rect.right || cy + r < rect.top || cy - r > rect.bottom) continue;
            const closestX = Math.max(rect.left, Math.min(cx, rect.right));
            const closestY = Math.max(rect.top, Math.min(cy, rect.bottom));
            const dx = cx - closestX;
            const dy = cy - closestY;
            const distSq = dx * dx + dy * dy;
            if (distSq >= r * r) continue;
            colliding = true;
            let nx = 0;
            let ny = 0;
            let pen: number;
            if (distSq === 0) {
              const edges = [cx - rect.left, rect.right - cx, cy - rect.top, rect.bottom - cy];
              const min = Math.min(...edges);
              if (min === edges[0]) [nx, pen] = [-1, r + edges[0]];
              else if (min === edges[1]) [nx, pen] = [1, r + edges[1]];
              else if (min === edges[2]) [ny, pen] = [-1, r + edges[2]];
              else [ny, pen] = [1, r + edges[3]];
            } else {
              const dist = Math.sqrt(distSq);
              nx = dx / dist;
              ny = dy / dist;
              pen = r - dist;
            }
            pos.x += nx * pen;
            pos.y += ny * pen;
            const skew = (Math.random() - 0.5) * 0.5;
            const rx = nx * Math.cos(skew) - ny * Math.sin(skew);
            const ry = nx * Math.sin(skew) + ny * Math.cos(skew);
            const vn = vel.x * rx + vel.y * ry;
            if (vn < 0) {
              const impulse = -(1 + OBSTACLE_BOUNCE) * vn;
              vel.x += rx * impulse;
              vel.y += ry * impulse;
            }
          }
        }
        stuck = colliding ? stuck + 1 : 0;
        if (stuck > STUCK_FRAME_LIMIT) respawn();

        if (pos.y >= maxY) {
          pos.y = maxY;
          vel.y = Math.abs(vel.y) > FLOOR_THRESHOLD ? -vel.y * BOUNCE : 0;
          vel.x *= Math.pow(0.85, dt * 60);
        }
        if (pos.y < ceiling && vel.y < 0) {
          pos.y = ceiling;
          vel.y = -vel.y * BOUNCE;
        }
        if (pos.x < 0) {
          pos.x = 0;
          vel.x = -vel.x * BOUNCE;
        }
        if (pos.x > maxX) {
          pos.x = maxX;
          vel.x = -vel.x * BOUNCE;
        }
        rotation += vel.x * dt * 0.5;
      }

      apply();

      if (!dragging && pos.y >= maxY && vel.y === 0 && Math.abs(vel.x) < 0.1) {
        vel.x = 0;
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    const onPointerDown = (e: PointerEvent) => {
      if (popping) return;
      e.preventDefault();
      dragging = true;
      stuck = 0;
      ball.setPointerCapture(e.pointerId);
      Object.assign(dragStart, { x: e.clientX, y: e.clientY, t: performance.now() });
      Object.assign(dragPrev, dragStart);
      vel.x = vel.y = 0;
      ball.classList.add("wa-ball-grabbed");
      start();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dtMs = now - dragPrev.t;
      if (dtMs > 0) {
        vel.x = ((e.clientX - dragPrev.x) / dtMs) * 1000 * 0.4 + vel.x * 0.6;
        vel.y = ((e.clientY - dragPrev.y) / dtMs) * 1000 * 0.4 + vel.y * 0.6;
      }
      pos.x = e.clientX - SIZE / 2;
      pos.y = e.clientY - SIZE / 2;
      Object.assign(dragPrev, { x: e.clientX, y: e.clientY, t: now });
      apply();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      ball.classList.remove("wa-ball-grabbed");
      const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
      const isClick = moved < CLICK_DIST && performance.now() - dragStart.t < CLICK_TIME;
      suppressClick = !isClick;
      if (isClick) vel.x = vel.y = 0;
    };
    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      suppressClick = false;
    };

    let scanTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleScan = () => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, 200);
    };
    const onResize = () => {
      const maxY = window.innerHeight - SIZE;
      if (pos.y >= maxY - 5 || pos.y > maxY) pos.y = maxY;
      pos.x = Math.min(pos.x, window.innerWidth - SIZE);
      apply();
      scheduleScan();
      start();
    };

    pos.x = Math.random() * (window.innerWidth - SIZE);
    pos.y = -SIZE - 20;
    vel.x = (Math.random() - 0.5) * 100;
    apply();
    scan();
    start();

    ball.addEventListener("pointerdown", onPointerDown);
    ball.addEventListener("click", onClick);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", scheduleScan, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(scanTimer);
      ball.removeEventListener("pointerdown", onPointerDown);
      ball.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", scheduleScan);
    };
  }, []);

  return (
    <a
      ref={ballRef}
      href={SITE.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="wa-ball-wrapper"
      aria-label="Chat with PizzaScript on WhatsApp (opens in a new tab)"
      title="Chat on WhatsApp — or throw it around!"
      draggable={false}
    >
      <div ref={popRef} className="wa-ball-pop-container">
        <div ref={bodyRef} className="wa-ball">
          <svg className="wa-ball-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
              fill="white"
            />
            <path
              d="M12.05 2C6.532 2 2.05 6.478 2.05 11.992c0 1.94.556 3.747 1.516 5.278L2 22l4.844-1.535A9.953 9.953 0 0012.05 22C17.565 22 22.05 17.522 22.05 12.008 22.05 6.494 17.565 2 12.05 2zm0 18.054a8.078 8.078 0 01-4.228-1.19l-.29-.178-3.1.983.993-3.044-.198-.305A8.004 8.004 0 014.004 12c0-4.41 3.588-7.994 8.002-7.994 4.41 0 8.003 3.583 8.003 7.994 0 4.41-3.592 8.054-8.003 8.054h.044z"
              fill="white"
            />
          </svg>
        </div>
      </div>
      <span className="wa-ball-tooltip" aria-hidden="true">
        Throw it around!
      </span>
    </a>
  );
}
