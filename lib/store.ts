"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  MediaAsset,
  TimelineElement,
  Track,
  Project,
  PlaybackState,
  SelectionState,
  AspectRatio,
} from "./types";

interface EditorStore extends PlaybackState, SelectionState {
  project: Project;
  media: MediaAsset[];
  tracks: Track[];
  elements: TimelineElement[];

  setProjectName: (name: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setBackgroundColor: (color: string) => void;

  addMedia: (asset: Omit<MediaAsset, "id">) => string;
  removeMedia: (id: string) => void;
  addTextAsset: (text?: string) => string;

  addTrack: (type: Track["type"]) => string;
  removeTrack: (id: string) => void;
  toggleTrackMute: (id: string) => void;
  toggleTrackVisibility: (id: string) => void;

  addElement: (el: Omit<TimelineElement, "id">) => string;
  removeElements: (ids: string[]) => void;
  updateElement: (id: string, patch: Partial<TimelineElement>) => void;
  moveElement: (id: string, startTime: number, trackId?: string) => void;
  resizeElement: (
    id: string,
    edge: "start" | "end",
    newTime: number
  ) => void;
  splitElement: (id: string, atTime: number) => void;

  selectElements: (ids: string[]) => void;
  selectTrack: (id: string | null) => void;
  clearSelection: () => void;

  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;

  getSelectedElements: () => TimelineElement[];
  recalculateDuration: () => void;
}

const defaultTracks: Track[] = [
  {
    id: "track-v1",
    type: "video",
    name: "Video 1",
    muted: false,
    visible: true,
    locked: false,
    order: 0,
  },
  {
    id: "track-t1",
    type: "text",
    name: "Text 1",
    muted: false,
    visible: true,
    locked: false,
    order: 1,
  },
  {
    id: "track-a1",
    type: "audio",
    name: "Audio 1",
    muted: false,
    visible: true,
    locked: false,
    order: 2,
  },
];

export const useEditorStore = create<EditorStore>((set, get) => ({
  project: {
    id: nanoid(),
    name: "Untitled Project",
    aspectRatio: "9:16",
    fps: 30,
    duration: 30,
    backgroundColor: "#000000",
  },
  media: [],
  tracks: defaultTracks,
  elements: [],
  currentTime: 0,
  isPlaying: false,
  volume: 1,
  selectedElementIds: [],
  selectedTrackId: null,

  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name } })),

  setAspectRatio: (ratio) =>
    set((s) => ({ project: { ...s.project, aspectRatio: ratio } })),

  setBackgroundColor: (color) =>
    set((s) => ({ project: { ...s.project, backgroundColor: color } })),

  addMedia: (asset) => {
    const id = nanoid();
    set((s) => ({ media: [...s.media, { ...asset, id }] }));
    return id;
  },

  removeMedia: (id) =>
    set((s) => ({
      media: s.media.filter((m) => m.id !== id),
      elements: s.elements.filter((e) => e.mediaId !== id),
      selectedElementIds: s.selectedElementIds.filter(
        (eid) => s.elements.find((e) => e.id === eid)?.mediaId !== id
      ),
    })),

  addTextAsset: (text = "Your text here") => {
    const id = nanoid();
    set((s) => ({
      media: [
        ...s.media,
        {
          id,
          type: "text",
          name: text.slice(0, 24) || "Text",
          src: "",
          duration: 5,
          text,
          fontSize: 48,
          fontColor: "#ffffff",
          fontFamily: "Arial",
        },
      ],
    }));
    return id;
  },

  addTrack: (type) => {
    const id = nanoid();
    const count = get().tracks.filter((t) => t.type === type).length + 1;
    const label =
      type === "video" ? "Video" : type === "audio" ? "Audio" : "Text";
    set((s) => ({
      tracks: [
        ...s.tracks,
        {
          id,
          type,
          name: `${label} ${count}`,
          muted: false,
          visible: true,
          locked: false,
          order: s.tracks.length,
        },
      ],
    }));
    return id;
  },

  removeTrack: (id) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      elements: s.elements.filter((e) => e.trackId !== id),
    })),

  toggleTrackMute: (id) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, muted: !t.muted } : t
      ),
    })),

  toggleTrackVisibility: (id) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, visible: !t.visible } : t
      ),
    })),

  addElement: (el) => {
    const id = nanoid();
    set((s) => {
      const elements = [...s.elements, { ...el, id }];
      const maxEnd = Math.max(
        s.project.duration,
        ...elements.map((e) => e.startTime + e.duration)
      );
      return {
        elements,
        project: { ...s.project, duration: Math.max(maxEnd, 10) },
      };
    });
    return id;
  },

  removeElements: (ids) =>
    set((s) => ({
      elements: s.elements.filter((e) => !ids.includes(e.id)),
      selectedElementIds: s.selectedElementIds.filter(
        (id) => !ids.includes(id)
      ),
    })),

  updateElement: (id, patch) =>
    set((s) => ({
      elements: s.elements.map((e) =>
        e.id === id ? { ...e, ...patch } : e
      ),
    })),

  moveElement: (id, startTime, trackId) =>
    set((s) => ({
      elements: s.elements.map((e) =>
        e.id === id
          ? {
              ...e,
              startTime: Math.max(0, startTime),
              ...(trackId ? { trackId } : {}),
            }
          : e
      ),
    })),

  resizeElement: (id, edge, newTime) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el) return;

    if (edge === "start") {
      const end = el.startTime + el.duration;
      const clamped = Math.max(0, Math.min(newTime, end - 0.1));
      const delta = clamped - el.startTime;
      set((s) => ({
        elements: s.elements.map((e) =>
          e.id === id
            ? {
                ...e,
                startTime: clamped,
                duration: end - clamped,
                trimStart: Math.max(0, e.trimStart + delta),
              }
            : e
        ),
      }));
    } else {
      const clamped = Math.max(el.startTime + 0.1, newTime);
      set((s) => ({
        elements: s.elements.map((e) =>
          e.id === id
            ? { ...e, duration: clamped - e.startTime }
            : e
        ),
      }));
    }
  },

  splitElement: (id, atTime) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el) return;
    const relative = atTime - el.startTime;
    if (relative <= 0.1 || relative >= el.duration - 0.1) return;

    const leftDuration = relative;
    const rightDuration = el.duration - relative;

    set((s) => ({
      elements: [
        ...s.elements.filter((e) => e.id !== id),
        {
          ...el,
          id: nanoid(),
          duration: leftDuration,
          trimEnd: el.trimEnd + rightDuration,
        },
        {
          ...el,
          id: nanoid(),
          startTime: atTime,
          duration: rightDuration,
          trimStart: el.trimStart + leftDuration,
        },
      ],
      selectedElementIds: [],
    }));
  },

  selectElements: (ids) => set({ selectedElementIds: ids }),
  selectTrack: (id) => set({ selectedTrackId: id }),
  clearSelection: () => set({ selectedElementIds: [], selectedTrackId: null }),

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
  seek: (time) =>
    set({
      currentTime: Math.max(0, Math.min(time, get().project.duration)),
      isPlaying: false,
    }),

  getSelectedElements: () => {
    const { elements, selectedElementIds } = get();
    return elements.filter((e) => selectedElementIds.includes(e.id));
  },

  recalculateDuration: () => {
    const { elements, project } = get();
    const maxEnd = elements.reduce(
      (max, e) => Math.max(max, e.startTime + e.duration),
      10
    );
    set({ project: { ...project, duration: maxEnd } });
  },
}));
