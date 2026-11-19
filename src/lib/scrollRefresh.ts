import { ScrollTrigger } from "gsap/ScrollTrigger";

let timer: ReturnType<typeof setTimeout> | undefined;

// Many sections mount at once; coalesce their layout recalculations into one refresh.
export function requestScrollRefresh(delay = 150) {
  clearTimeout(timer);
  timer = setTimeout(() => ScrollTrigger.refresh(), delay);
}
