"use client";

import { useCallback, useRef, useState } from "react";
import { useImageSequence } from "@/hooks/useImageSequence";

export type StageIndex = 0 | 1 | 2;

export interface Stage {
  title: string;
  summary: string;
  detail: string;
  icon: React.ReactNode;
}

export interface CardContext {
  stage: StageIndex;
  progress: number;
  variant: "mobile" | "desktop";
}

interface SequenceSectionProps {
  id: string;
  eyebrow: string;
  heading: React.ReactNode;
  description: string;
  stages: [Stage, Stage, Stage];
  frameCount: number;
  framePath: (index: number) => string;
  /** Desktop: which side the canvas sits on. */
  visualSide: "left" | "right";
  visualClassName?: (stage: StageIndex) => string;
  visualOverlay?: React.ReactNode;
  renderCard: (ctx: CardContext) => React.ReactNode;
}

const THRESHOLDS = [0.35, 0.7] as const;

function stageFor(progress: number): StageIndex {
  if (progress < THRESHOLDS[0]) return 0;
  if (progress < THRESHOLDS[1]) return 1;
  return 2;
}

const DEFAULT_VISUAL = (stage: StageIndex) => (stage === 1 ? "css-active" : stage === 2 ? "js-active" : "");

export function SequenceSection({
  id,
  eyebrow,
  heading,
  description,
  stages,
  frameCount,
  framePath,
  visualSide,
  visualClassName = DEFAULT_VISUAL,
  visualOverlay,
  renderCard,
}: SequenceSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const mobileCanvasRef = useRef<HTMLCanvasElement>(null);
  const desktopCanvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);

  const onProgress = useCallback((p: number) => setProgress(Math.round(p * 50) / 50), []);
  useImageSequence(sectionRef, [mobileCanvasRef, desktopCanvasRef], { frameCount, framePath, scrub: 0.8, onProgress });

  const stage = stageFor(progress);
  const current = stages[stage];
  const textOrder = visualSide === "left" ? "lg:order-2" : "lg:order-1";
  const visualOrder = visualSide === "left" ? "lg:order-1" : "lg:order-2";
  const columns = visualSide === "left" ? "lg:grid-cols-[11fr_9fr]" : "lg:grid-cols-[9fr_11fr]";

  return (
    <section id={id} className="sequence-scroll-driver cin-bg-dark border-t border-brown-800/10" ref={sectionRef}>
      <div className="sequence-sticky">
        <div className="w-full h-full flex items-center justify-center">
          <div className="sequence-mobile-card seq-mobile">
            <div className="sequence-mobile-header">
              <p className="cin-eyebrow sequence-mobile-eyebrow">{eyebrow}</p>
              <h2 className="cin-heading sequence-mobile-heading font-serif font-bold">{heading}</h2>
            </div>
            <div
              className={`sequence-mobile-canvas ${stage === 1 ? "stage2-active" : ""} ${stage === 2 ? "stage3-active" : ""}`}
            >
              <canvas ref={mobileCanvasRef} className="w-full h-full object-cover" aria-hidden="true" />
            </div>
            <div className="sequence-mobile-stage-text">
              <div className="sequence-mobile-stage-block" key={current.title}>
                <h3 className="sequence-mobile-stage-title flex items-center justify-center gap-1.5">
                  {current.icon}
                  <span>{current.title}</span>
                </h3>
                <p className="sequence-mobile-paragraph">{current.detail}</p>
              </div>
            </div>
            <div className="sequence-mobile-blueprint" aria-hidden="true">
              {renderCard({ stage, progress, variant: "mobile" })}
            </div>
          </div>

          <div
            className={`seq-desktop container max-w-7xl lg:max-w-[1440px] xl:max-w-[1600px] mx-auto px-4 lg:px-12 xl:px-16 w-full h-full ${columns} gap-16 items-center select-none overflow-hidden`}
          >
            <div className={`flex flex-col space-y-6 justify-center w-full ${textOrder}`}>
              <div className="text-left">
                <p className="cin-eyebrow text-sm">{eyebrow}</p>
                <h2 className="cin-heading text-5xl xl:text-6xl font-serif font-bold leading-none">{heading}</h2>
                <p className="cin-text text-base xl:text-lg text-smoke-light block mt-3">{description}</p>
              </div>
              <ol className="progress-steps flex flex-col gap-3">
                {stages.map((s, i) => (
                  <li
                    key={s.title}
                    className={`progress-step ${stage === i ? "active" : ""} ${i < 2 && progress >= THRESHOLDS[i] ? "completed" : ""}`}
                    aria-current={stage === i ? "step" : undefined}
                  >
                    <span className="step-number" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="step-details">
                      <h3 className="step-title text-base xl:text-lg">{s.title}</h3>
                      <p className="step-desc text-sm xl:text-base">{s.summary}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className={`flex flex-col justify-center space-y-10 mobile-canvas-top w-full ${visualOrder}`}>
              <div className={`visual-container w-full ${visualClassName(stage)}`}>
                <canvas ref={desktopCanvasRef} className="w-full h-full object-cover" aria-hidden="true" />
                {visualOverlay}
              </div>
              <div className="w-full blueprint-wrapper" aria-hidden="true">
                {renderCard({ stage, progress, variant: "desktop" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STATE_CLASS = ["html-state", "css-state", "js-state"] as const;

export function BlueprintCard({
  stage,
  variant,
  file,
  fileClassName,
  comment,
  className = "",
  children,
}: {
  stage: StageIndex;
  variant: "mobile" | "desktop";
  file: string;
  fileClassName: string;
  comment?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const mobile = variant === "mobile";
  return (
    <div
      className={`blueprint-card ${STATE_CLASS[stage]} ${mobile ? "sequence-mobile-bp-card" : "animate-fade-in"} ${className}`}
    >
      <div className="blueprint-header">
        <div className="blueprint-dots">
          <div className="blueprint-dot" />
          <div className="blueprint-dot" />
          <div className="blueprint-dot" />
        </div>
        <span className={`${fileClassName} font-mono ${mobile ? "text-[9.5px]" : "text-[12px] lg:text-sm"}`}>{file}</span>
      </div>
      {mobile && comment && <div className="blueprint-comment text-[9.5px]">{comment}</div>}
      {children}
    </div>
  );
}

export function StageIcon({ d, strokeWidth = 2 }: { d: string | string[]; strokeWidth?: number }) {
  return (
    <svg
      className="w-4.5 h-4.5 text-oven-orange"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
    >
      {(Array.isArray(d) ? d : [d]).map((path) => (
        <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />
      ))}
    </svg>
  );
}
