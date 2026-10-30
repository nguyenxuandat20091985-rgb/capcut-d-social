export type MediaType = "video" | "audio" | "image" | "text";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export interface MediaAsset {
  id: string;
  type: MediaType;
  name: string;
  src: string; // object URL or empty for pure text assets
  duration: number; // seconds (0 for images default handled elsewhere)
  width?: number;
  height?: number;
  thumbnail?: string;
  fileSize?: number;
  mimeType?: string;
  /** Text content when type === "text" */
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
}

export interface TimelineElement {
  id: string;
  mediaId: string;
  trackId: string;
  /** Start time on the timeline (seconds) */
  startTime: number;
  /** Duration on the timeline (seconds) */
  duration: number;
  /** Trim from media start */
  trimStart: number;
  /** Trim from media end */
  trimEnd: number;
  /** Volume 0–1 for audio/video */
  volume: number;
  /** Opacity 0–1 */
  opacity: number;
  /** Scale factor */
  scale: number;
  /** Position offset on canvas (normalized -0.5..0.5 relative to center works too; we use px in preview) */
  x: number;
  y: number;
  /** Rotation degrees */
  rotation: number;
  name?: string;
  /** Override text for text clips */
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
}

export interface Track {
  id: string;
  type: "video" | "audio" | "text";
  name: string;
  muted: boolean;
  visible: boolean;
  locked: boolean;
  order: number;
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

export const ASPECT_RESOLUTIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};
