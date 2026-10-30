export type MediaType = "video" | "audio" | "image" | "text";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export interface MediaAsset {
  id: string;
  type: MediaType;
  name: string;
  src: string; // object URL or remote URL
  duration: number; // seconds (0 for images)
  width?: number;
  height?: number;
  thumbnail?: string;
  fileSize?: number;
  mimeType?: string;
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
  /** Position offset on canvas */
  x: number;
  y: number;
  /** Rotation degrees */
  rotation: number;
  name?: string;
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
  duration: number; // total timeline duration
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
