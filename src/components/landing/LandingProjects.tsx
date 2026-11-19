"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useScroll } from "@/components/motion/ScrollProvider";
import type { CaseStudy } from "@/data/portfolio";
import { WinTitlebar } from "./WinBox";

export function LandingProjects({ studies }: { studies: CaseStudy[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<CaseStudy | null>(null);
  const { getLenis } = useScroll();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (preview && !dialog.open) {
      dialog.showModal();
      getLenis()?.stop();
      document.body.style.overflow = "hidden";
    }
  }, [preview, getLenis]);

  const close = () => dialogRef.current?.close();
  const onClosed = () => {
    setPreview(null);
    getLenis()?.start();
    document.body.style.overflow = "";
  };

  return (
    <>
      <div className="fp-portfolio-list">
        {studies.map((study) => (
          <div className="fp-project fp-reveal" key={study.slug}>
            <div className="fp-project-layout">
              <div className="fp-win-box">
                <WinTitlebar title={`${study.slug}.png`} />
                <div className="fp-project-image-wrap" style={{ position: "relative", aspectRatio: "16 / 10" }}>
                  <Image
                    src={study.screenshot}
                    alt={study.screenshotAlt}
                    fill
                    sizes="(min-width: 1024px) 760px, 100vw"
                    className="fp-project-image"
                    style={{ objectFit: "cover", objectPosition: "top" }}
                  />
                </div>
              </div>
              <div className="fp-project-sidebar">
                <button type="button" className="fp-btn-sidebar fp-btn-live" onClick={() => setPreview(study)}>
                  Live View<span className="sr-only"> of {study.name}</span>
                </button>
                <a href={study.liveUrl} target="_blank" rel="noopener noreferrer" className="fp-btn-sidebar fp-btn-visit">
                  Visit Site<span className="sr-only"> {study.name} (opens in a new tab)</span>
                </a>
              </div>
            </div>
            <div className="fp-project-meta">
              <a href={`/portfolio/${study.slug}`} className="fp-project-name">
                {study.name}
              </a>
              <span className="fp-project-tags">{study.tags.join(" · ")}</span>
            </div>
          </div>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="fp-modal-overlay"
        aria-label={preview ? `Live preview of ${preview.name}` : "Live preview"}
        onClose={onClosed}
        onClick={(e) => e.target === e.currentTarget && close()}
        data-lenis-prevent
      >
        {preview && (
          <div className="fp-modal-window" data-lenis-prevent>
            <div className="fp-win-titlebar">
              <div className="fp-win-buttons">
                <button type="button" className="fp-win-btn fp-win-close" onClick={close} aria-label="Close preview">
                  ✕
                </button>
              </div>
              <span className="fp-win-title">PizzaOS v1.0 - Live Preview: {preview.name}</span>
            </div>
            <div className="fp-modal-body" data-lenis-prevent>
              <iframe
                src={preview.liveUrl}
                title={`${preview.name} live preview`}
                className="fp-modal-iframe"
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
