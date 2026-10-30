export type MediaType = "video" | "audio" | "image" | "text";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export type TransitionType = "none" | "dissolve" | "fade" | "slide-left" | "slide-right";

export type ExportResolution = "720p" | "1080p";

export interface MediaAsset {
  id: string;
  type: MediaType;
  name: string;
  src: string;
  duration: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  fileSize?: number;
  mimeType?: string;
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
}

export interface ClipKeyframe {
  /** Time in seconds relative to the start of its clip. */
  time: number;
  x: number;
  y: number;
  scale: number;
  /** Optional for backward compatibility with earlier saved projects. */
  rotation?: number;
}

export interface TimelineElement {
  id: string;
  mediaId: string;
  trackId: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  opacity: number;
  scale: number;
  x: number;
  y: number;
  rotation: number;
  /** Non-destructive image/video adjustments */
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  speed: number;
  keyframes?: ClipKeyframe[];
  name?: string;
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
  /** Fade in duration (seconds) */
  fadeIn: number;
  /** Fade out duration (seconds) */
  fadeOut: number;
  /** Transition at the start of this clip */
  transitionIn: TransitionType;
  transitionDuration: number;
}

export interface Track {
  id: string;
  type: "video" | "audio" | "text";
  name: string;
  muted: boolean;
  visible: boolean;
  locked: boolean;
  order: number;
  /** Track-level volume 0–1 */
  volume: number;
}

export interface Project {
  id: string;
  name: string;
  aspectRatio: AspectRatio;
  fps: number;
  duration: number;
  backgroundColor: string;
}

export interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
}

export interface SelectionState {
  selectedElementIds: string[];
  selectedTrackId: string | null;
}

/** Serializable project file */
export interface ProjectFile {
  version: 1;
  savedAt: string;
  project: Project;
  tracks: Track[];
  elements: TimelineElement[];
  /** Media metadata only — binary src re-attached on load when possible */
  media: Array<Omit<MediaAsset, "src"> & { src?: string }>;
}

export const ASPECT_RESOLUTIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

export function resolutionPixels(
  aspect: AspectRatio,
  res: ExportResolution
): { width: number; height: number } {
  const base = ASPECT_RESOLUTIONS[aspect] ?? ASPECT_RESOLUTIONS["9:16"];
  if (res === "1080p") return { ...base };
  // 720p scale
  const scale = 720 / Math.min(base.width, base.height);
  // Prefer height-based for vertical
  if (base.height >= base.width) {
    return {
      width: Math.round(base.width * (720 / base.height)),
      height: 720,
    };
  }
  return {
    width: 1280,
    height: Math.round(base.height * (1280 / base.width)),
  };
}

export function defaultElementProps(): Pick<
  TimelineElement,
  | "fadeIn"
  | "fadeOut"
  | "transitionIn"
  | "transitionDuration"
  | "volume"
  | "opacity"
  | "scale"
  | "x"
  | "y"
  | "rotation"
  | "brightness"
  | "contrast"
  | "saturation"
  | "hue"
  | "blur"
  | "speed"
  | "keyframes"
  | "trimStart"
  | "trimEnd"
> {
  return {
    fadeIn: 0,
    fadeOut: 0,
    transitionIn: "none",
    transitionDuration: 0.5,
    volume: 1,
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    blur: 0,
    speed: 1,
    trimStart: 0,
    trimEnd: 0,
  };
}
