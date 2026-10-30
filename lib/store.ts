import { create } from "zustand";
import type { ProjectState, MediaItem, TimelineClip } from "./types";

interface EditorStore extends ProjectState {
  addMedia: (item: MediaItem) => void;
  removeMedia: (id: string) => void;
  addClip: (clip: TimelineClip) => void;
  removeClip: (id: string) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  media: [],
  clips: [],
  currentTime: 0,
  duration: 0,
  isPlaying: false,

  addMedia: (item) =>
    set((state) => ({ media: [...state.media, item] })),

  removeMedia: (id) =>
    set((state) => ({
      media: state.media.filter((m) => m.id !== id),
      clips: state.clips.filter((c) => c.mediaId !== id),
    })),

  addClip: (clip) =>
    set((state) => ({ clips: [...state.clips, clip] })),

  removeClip: (id) =>
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) })),

  setCurrentTime: (time) => set({ currentTime: time }),

  setPlaying: (playing) => set({ isPlaying: playing }),

  setDuration: (duration) => set({ duration }),
}));
