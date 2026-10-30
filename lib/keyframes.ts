import type { ClipKeyframe, TimelineElement } from "./types";

export type MotionField = "x" | "y" | "scale" | "rotation";
export type MotionValues = { x: number; y: number; scale: number; rotation: number };

export function getMotionAtTime(
  element: TimelineElement,
  localTime: number
): MotionValues {
  const base = {
    x: element.x ?? 0,
    y: element.y ?? 0,
    scale: element.scale ?? 1,
    rotation: element.rotation ?? 0,
  };
  const keyframes = [...(element.keyframes ?? [])].sort((a, b) => a.time - b.time);
  if (keyframes.length === 0) return base;
  if (localTime < keyframes[0].time) return base;
  if (localTime === keyframes[0].time) return {
    x: keyframes[0].x,
    y: keyframes[0].y,
    scale: keyframes[0].scale,
    rotation: keyframes[0].rotation ?? base.rotation,
  };

  for (let i = 0; i < keyframes.length - 1; i++) {
    const left = keyframes[i];
    const right = keyframes[i + 1];
    if (localTime <= right.time) {
      const span = Math.max(0.001, right.time - left.time);
      const progress = Math.max(0, Math.min(1, (localTime - left.time) / span));
      return {
        x: left.x + (right.x - left.x) * progress,
        y: left.y + (right.y - left.y) * progress,
        scale: left.scale + (right.scale - left.scale) * progress,
        rotation: (left.rotation ?? base.rotation) + ((right.rotation ?? base.rotation) - (left.rotation ?? base.rotation)) * progress,
      };
    }
  }

  const last = keyframes[keyframes.length - 1];
  return { x: last.x, y: last.y, scale: last.scale, rotation: last.rotation ?? base.rotation };
}

/** Build a piecewise-linear FFmpeg expression using global timeline time t. */
export function motionExpression(
  element: TimelineElement,
  field: MotionField,
  fallback: number
): string {
  const keyframes = [...(element.keyframes ?? [])].sort((a, b) => a.time - b.time);
  if (keyframes.length === 0) return fallback.toFixed(4);

  let expression = keyframes[keyframes.length - 1][field].toFixed(4);
  for (let i = keyframes.length - 2; i >= 0; i--) {
    const left = keyframes[i];
    const right = keyframes[i + 1];
    const from = element.startTime + left.time;
    const to = element.startTime + right.time;
    const span = Math.max(0.001, right.time - left.time);
    const value = `(${left[field].toFixed(4)}+(${(right[field] - left[field]).toFixed(4)})*(t-${from.toFixed(3)})/${span.toFixed(3)})`;
    expression = `if(lt(t,${to.toFixed(3)}),${value},${expression})`;
  }

  const first = keyframes[0];
  const firstTime = element.startTime + first.time;
  return `if(lt(t,${firstTime.toFixed(3)}),${fallback.toFixed(4)},${expression})`;
}
