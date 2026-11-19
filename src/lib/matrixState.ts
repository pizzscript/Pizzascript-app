// Shared between the matrix background and the hero mouse trail, which composites the matrix canvas.
export const matrixState = {
  canvas: null as HTMLCanvasElement | null,
  /** Current vertical offset of the canvas inside its fixed wrapper, in CSS px. */
  shift: 0,
  spotlightDisabled: false,
};
