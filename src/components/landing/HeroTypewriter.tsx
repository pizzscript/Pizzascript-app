"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";

interface State {
  heading: number;
  chars: number;
  deleting: boolean;
}

/**
 * Cycles through headings with a typing effect. The first heading is rendered in full for
 * crawlers and screen readers; the animated copy is aria-hidden.
 */
export function HeroTypewriter({ headings }: { headings: string[] }) {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<State>({ heading: 0, chars: headings[0].length, deleting: false });

  useEffect(() => {
    if (reduced) return;
    const full = headings[state.heading];
    let delay: number;
    let next: State;
    if (!state.deleting) {
      if (state.chars < full.length) {
        delay = 12;
        next = { ...state, chars: state.chars + 1 };
      } else {
        delay = 4000;
        next = { ...state, deleting: true };
      }
    } else if (state.chars > 0) {
      delay = 4;
      next = { ...state, chars: state.chars - 1 };
    } else {
      delay = 300;
      next = { heading: (state.heading + 1) % headings.length, chars: 0, deleting: false };
    }
    const timer = setTimeout(() => setState(next), delay);
    return () => clearTimeout(timer);
  }, [state, reduced, headings]);

  const full = headings[state.heading];
  const words = full.split(" ");
  const lastWord = words[words.length - 1];
  const main = `${words.slice(0, -1).join(" ")} `;
  const complete = state.chars === full.length && !state.deleting;

  return (
    <h1 className="fp-display fp-hero-title fp-reveal fp-delay-1">
      <span className="sr-only">{headings[0]}</span>
      <span aria-hidden="true">
        {full.substring(0, Math.min(state.chars, main.length))}
        {complete ? <em>{lastWord}</em> : state.chars > main.length ? full.substring(main.length, state.chars) : ""}
      </span>
    </h1>
  );
}
