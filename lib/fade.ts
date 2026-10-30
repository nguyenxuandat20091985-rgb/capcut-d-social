import type { TimelineElement } from "./types";

/** Effective opacity at local time within a clip (0..duration), applying fade in/out */
export function fadedOpacity(
  el: TimelineElement,
  localTime: number
): number {
  const base = el.opacity;
  let factor = 1;

  if (el.fadeIn > 0 && localTime < el.fadeIn) {
    factor = Math.min(factor, localTime / el.fadeIn);
  }
  if (el.fadeOut > 0 && localTime > el.duration - el.fadeOut) {
    const t = el.duration - localTime;
    factor = Math.min(factor, Math.max(0, t / el.fadeOut));
  }

  // Simple dissolve / fade transition at start
  if (
    el.transitionIn !== "none" &&
    el.transitionIn !== "slide-left" &&
    el.transitionIn !== "slide-right" &&
    el.transitionDuration > 0 &&
    localTime < el.transitionDuration
  ) {
    factor = Math.min(factor, localTime / el.transitionDuration);
  }

  return base * factor;
}

/** Horizontal offset for slide transitions as a percentage of canvas width. */
export function slideOffset(
  el: TimelineElement,
  localTime: number,
  _canvasWidth: number
): number {
  if (
    el.transitionIn !== "slide-left" &&
    el.transitionIn !== "slide-right"
  ) {
    return 0;
  }
  if (localTime >= el.transitionDuration || el.transitionDuration <= 0) {
    return 0;
  }
  const t = 1 - localTime / el.transitionDuration;
  const dir = el.transitionIn === "slide-left" ? 1 : -1;
  return dir * t * 100;
}
