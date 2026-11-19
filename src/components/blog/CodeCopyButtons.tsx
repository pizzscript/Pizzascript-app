"use client";

import { useEffect } from "react";

const COPY_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const DONE_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** Adds a copy-to-clipboard button to every code block inside the given container. */
export function CodeCopyButtons({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container || !navigator.clipboard) return;
    const buttons: HTMLButtonElement[] = [];
    container.querySelectorAll("pre").forEach((pre) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy-btn";
      button.setAttribute("aria-label", "Copy code");
      button.innerHTML = COPY_ICON;
      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
        button.innerHTML = DONE_ICON;
        button.setAttribute("aria-label", "Copied");
        setTimeout(() => {
          button.innerHTML = COPY_ICON;
          button.setAttribute("aria-label", "Copy code");
        }, 2000);
      });
      pre.appendChild(button);
      buttons.push(button);
    });
    return () => buttons.forEach((button) => button.remove());
  }, [containerId]);

  return null;
}
