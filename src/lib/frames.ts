import { SITE } from "./site";

const frame = (folder: string) => (index: number) =>
  `${SITE.framesBaseUrl}/${folder}/frame_${String(index + 1).padStart(4, "0")}.webp`;

export const heroFramePath = frame("entry");
export const menuFramePath = frame("order");
export const doughFramePath = frame("dough");
export const toppingsFramePath = frame("toppings");
export const bakingFramePath = frame("baking");
export const removingFramePath = frame("removing");
