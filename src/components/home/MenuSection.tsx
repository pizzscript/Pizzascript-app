"use client";

import { useCallback, useRef, useState } from "react";
import { useImageSequence } from "@/hooks/useImageSequence";
import { menuFramePath } from "@/lib/frames";

const TECH = [
  { label: "HTML", color: "#E34F26", icon: "<>", delay: 0 },
  { label: "CSS", color: "#1572B6", icon: "{ }", delay: 0.4 },
  { label: "React", color: "#61DAFB", icon: "⚛", delay: 0.8 },
  { label: "Node", color: "#339933", icon: "⬢", delay: 1.2 },
  { label: "API", color: "#E87040", icon: "⇋", delay: 1.6 },
  { label: "SEO", color: "#FFC107", icon: "◎", delay: 2.0 },
];

export function MenuSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0);

  const onProgress = useCallback((p: number) => setStage(p < 0.35 ? 0 : p < 0.7 ? 1 : 2), []);
  useImageSequence(sectionRef, [canvasRef], {
    frameCount: 100,
    framePath: menuFramePath,
    fit: "contain",
    zoom: 1.05,
    scrub: 0.8,
    onProgress,
  });

  return (
    <section id="menu" className="sequence-scroll-driver cin-bg-dark border-t border-brown-800/10" ref={sectionRef}>
      <div className="sequence-sticky">
        <div className="w-full h-full flex items-center justify-center">
          <div className="menu-container container max-w-7xl lg:max-w-[1440px] xl:max-w-[1600px] mx-auto px-4 lg:px-12 xl:px-16 w-full h-full select-none overflow-hidden">
            <div className="menu-content flex flex-col justify-center space-y-4 text-left">
              <div>
                <p className="cin-eyebrow text-xs lg:text-sm">Choosing the Stack</p>
                <h2 className="cin-heading text-4xl lg:text-5xl xl:text-6xl font-serif font-bold leading-tight lg:leading-none mt-1">
                  Read the <span className="italic text-oven-orange">Menu</span>
                </h2>
                <p className="cin-text text-sm lg:text-base xl:text-lg text-smoke-light mt-3 hidden lg:block">
                  Before writing a single line of code, we study the project requirements and select the right tech
                  stack — HTML, CSS, React, Next.js, Node.js, APIs, and SEO tooling — tailored to your vision.
                </p>
              </div>
            </div>

            <div className="menu-visual flex items-center justify-center">
              <div
                className={`visual-container-vertical ${stage === 1 ? "css-active" : ""} ${stage === 2 ? "js-active" : ""}`}
              >
                <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />
              </div>
            </div>

            <div className="menu-sidebar flex flex-col justify-center items-center lg:items-end w-full">
              <ul
                className="menu-tech-icons-vertical w-full max-w-[240px] lg:max-w-none flex flex-col gap-3 lg:gap-4"
                aria-label="Core technologies"
              >
                {TECH.map((tech) => (
                  <li
                    key={tech.label}
                    className="menu-tech-icon-item"
                    style={{ "--icon-color": tech.color, animationDelay: `${tech.delay}s` } as React.CSSProperties}
                  >
                    <span className="menu-tech-icon-symbol" aria-hidden="true">
                      {tech.icon}
                    </span>
                    <span className="menu-tech-icon-label">{tech.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
