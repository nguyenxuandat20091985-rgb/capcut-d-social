export type MediaType = "video" | "audio" | "image" | "text";

export interface MediaItem {
  id: string;
  type: MediaType;
  name: string;
  src: string;
  duration?: number; // seconds
  thumbnail?: string;
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  trackIndex: number;
  startTime: number; // seconds on timeline
  duration: number;
  trimStart?: number;
  trimEnd?: number;
}

export interface ProjectState {
  media: MediaItem[];
  clips: TimelineClip[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}
