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
  ProjectFile,
} from "./types";
import { defaultElementProps } from "./types";
import {
  buildProjectFile,
  autosaveToLocalStorage,
  loadAutosave,
} from "./project-io";

interface HistorySnapshot {
  media: MediaAsset[];
  tracks: Track[];
  elements: TimelineElement[];
  project: Project;
  selectedElementIds: string[];
}

const MAX_HISTORY = 50;

interface EditorStore extends PlaybackState, SelectionState {
  project: Project;
  media: MediaAsset[];
  tracks: Track[];
  elements: TimelineElement[];
  hydrated: boolean;

  past: HistorySnapshot[];
  future: HistorySnapshot[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setProjectName: (name: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setBackgroundColor: (color: string) => void;

  addMedia: (asset: Omit<MediaAsset, "id">) => string;
  removeMedia: (id: string) => void;
  addTextAsset: (text?: string) => string;
  detachAudio: (elementId: string) => void;

  addTrack: (type: Track["type"]) => string;
  removeTrack: (id: string) => void;
  setTrackName: (id: string, name: string) => void;
  toggleTrackLocked: (id: string) => void;
  toggleTrackMute: (id: string) => void;
  toggleTrackVisibility: (id: string) => void;
  setTrackVolume: (id: string, volume: number) => void;

  addElement: (el: Omit<TimelineElement, "id">) => string;
  removeElements: (ids: string[]) => void;
  updateElement: (id: string, patch: Partial<TimelineElement>) => void;
  moveElement: (id: string, startTime: number, trackId?: string) => void;
  resizeElement: (id: string, edge: "start" | "end", newTime: number) => void;
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

  /** Project IO */
  exportProjectFile: () => ProjectFile;
  importProjectFile: (file: ProjectFile) => void;
  hydrateFromAutosave: () => void;
  persistAutosave: () => void;
}

function snap(s: {
  media: MediaAsset[];
  tracks: Track[];
  elements: TimelineElement[];
  project: Project;
  selectedElementIds: string[];
}): HistorySnapshot {
  return {
    media: structuredClone(s.media),
    tracks: structuredClone(s.tracks),
    elements: structuredClone(s.elements),
    project: structuredClone(s.project),
    selectedElementIds: [...s.selectedElementIds],
  };
}

const defaultTracks: Track[] = [
  { id: "track-v1", type: "video", name: "Video 1", muted: false, visible: true, locked: false, order: 0, volume: 1 },
  { id: "track-t1", type: "text", name: "Text 1", muted: false, visible: true, locked: false, order: 1, volume: 1 },
  { id: "track-a1", type: "audio", name: "Audio 1", muted: false, visible: true, locked: false, order: 2, volume: 1 },
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
  hydrated: false,
  currentTime: 0,
  isPlaying: false,
  volume: 1,
  selectedElementIds: [],
  selectedTrackId: null,
  past: [],
  future: [],

  pushHistory: () => {
    const s = get();
    set({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snap(s)],
      future: [],
    });
  },

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const previous = s.past[s.past.length - 1];
    set({
      past: s.past.slice(0, -1),
      future: [snap(s), ...s.future].slice(0, MAX_HISTORY),
      ...previous,
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[0];
    set({
      future: s.future.slice(1),
      past: [...s.past, snap(s)].slice(-MAX_HISTORY),
      ...next,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),

  setAspectRatio: (ratio) => {
    get().pushHistory();
    set((s) => ({ project: { ...s.project, aspectRatio: ratio } }));
  },

  setBackgroundColor: (color) => {
    get().pushHistory();
    set((s) => ({ project: { ...s.project, backgroundColor: color } }));
  },

  addMedia: (asset) => {
    get().pushHistory();
    const id = nanoid();
    set((s) => ({ media: [...s.media, { ...asset, id }] }));
    return id;
  },

  removeMedia: (id) => {
    get().pushHistory();
    set((s) => ({
      media: s.media.filter((m) => m.id !== id),
      elements: s.elements.filter((e) => e.mediaId !== id),
      selectedElementIds: s.selectedElementIds.filter(
        (eid) => s.elements.find((e) => e.id === eid)?.mediaId !== id
      ),
    }));
  },

  addTextAsset: (text = "Nhập chữ tại đây") => {
    get().pushHistory();
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
          fontFamily: "Noto Sans",
        },
      ],
    }));
    return id;
  },

  detachAudio: (elementId) => {
    const s = get();
    const el = s.elements.find((e) => e.id === elementId);
    if (!el) return;
    const asset = s.media.find((m) => m.id === el.mediaId);
    if (!asset || asset.type !== "video" || !asset.src) return;

    s.pushHistory();

    const audioAssetId = nanoid();
    const audioElId = nanoid();
    let audioTrack = s.tracks.find((t) => t.type === "audio");
    if (!audioTrack) {
      const tid = nanoid();
      audioTrack = {
        id: tid,
        type: "audio",
        name: "Audio 1",
        muted: false,
        visible: true,
        locked: false,
        order: s.tracks.length,
        volume: 1,
      };
      set((st) => ({ tracks: [...st.tracks, audioTrack!] }));
    }

    set((st) => ({
      media: [
        ...st.media,
        {
          id: audioAssetId,
          type: "audio",
          name: `${asset.name} (audio)`,
          src: asset.src,
          duration: asset.duration,
          mimeType: asset.mimeType,
        },
      ],
      elements: [
        ...st.elements,
        {
          ...defaultElementProps(),
          id: audioElId,
          mediaId: audioAssetId,
          trackId: audioTrack!.id,
          startTime: el.startTime,
          duration: el.duration,
          trimStart: el.trimStart,
          trimEnd: el.trimEnd,
          volume: el.volume,
          speed: el.speed ?? 1,
          name: `${asset.name} (audio)`,
        },
      ],
    }));
  },

  addTrack: (type) => {
    get().pushHistory();
    const id = nanoid();
    const count = get().tracks.filter((t) => t.type === type).length + 1;
    const label = type === "video" ? "Video" : type === "audio" ? "Audio" : "Text";
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
          volume: 1,
        },
      ],
    }));
    return id;
  },

  removeTrack: (id) => {
    const current = get();
    if (!current.tracks.some((track) => track.id === id)) return;
    current.pushHistory();
    set((s) => {
      const removedElementIds = new Set(s.elements.filter((e) => e.trackId === id).map((e) => e.id));
      return {
        tracks: s.tracks.filter((t) => t.id !== id),
        elements: s.elements.filter((e) => e.trackId !== id),
        selectedElementIds: s.selectedElementIds.filter((elementId) => !removedElementIds.has(elementId)),
        selectedTrackId: s.selectedTrackId === id ? null : s.selectedTrackId,
      };
    });
  },

  setTrackName: (id, name) => {
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return;
    get().pushHistory();
    set((s) => ({
      tracks: s.tracks.map((track) => track.id === id ? { ...track, name: cleanName } : track),
    }));
  },

  toggleTrackLocked: (id) => {
    get().pushHistory();
    set((s) => ({
      tracks: s.tracks.map((track) => track.id === id ? { ...track, locked: !track.locked } : track),
    }));
  },

  toggleTrackMute: (id) => {
    get().pushHistory();
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, muted: !t.muted } : t
      ),
    }));
  },

  toggleTrackVisibility: (id) => {
    get().pushHistory();
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, visible: !t.visible } : t
      ),
    }));
  },

  setTrackVolume: (id, volume) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, volume: Math.min(1, Math.max(0, volume)) } : t
      ),
    }));
  },

  addElement: (el) => {
    get().pushHistory();
    const id = nanoid();
    const full = { ...defaultElementProps(), ...el, id };
    set((s) => {
      const elements = [...s.elements, full];
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

  removeElements: (ids) => {
    const s = get();
    const removableIds = s.elements
      .filter((element) => ids.includes(element.id) && !s.tracks.find((track) => track.id === element.trackId)?.locked)
      .map((element) => element.id);
    if (!removableIds.length) return;
    get().pushHistory();
    set((state) => ({
      elements: state.elements.filter((e) => !removableIds.includes(e.id)),
      selectedElementIds: state.selectedElementIds.filter((id) => !removableIds.includes(id)),
    }));
  },

  updateElement: (id, patch) => {
    get().pushHistory();
    set((s) => ({
      elements: s.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  },

  moveElement: (id, startTime, trackId) => {
    const current = get();
    const element = current.elements.find((item) => item.id === id);
    if (!element || current.tracks.find((track) => track.id === element.trackId)?.locked) return;
    if (trackId && current.tracks.find((track) => track.id === trackId)?.locked) return;
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
    }));
  },

  resizeElement: (id, edge, newTime) => {
    const state = get();
    const el = state.elements.find((e) => e.id === id);
    if (!el || state.tracks.find((track) => track.id === el.trackId)?.locked) return;
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
          e.id === id ? { ...e, duration: clamped - e.startTime } : e
        ),
      }));
    }
  },

  splitElement: (id, atTime) => {
    const state = get();
    const el = state.elements.find((e) => e.id === id);
    if (!el || state.tracks.find((track) => track.id === el.trackId)?.locked) return;
    const relative = atTime - el.startTime;
    if (relative <= 0.1 || relative >= el.duration - 0.1) return;
    get().pushHistory();
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
          fadeOut: 0,
        },
        {
          ...el,
          id: nanoid(),
          startTime: atTime,
          duration: rightDuration,
          trimStart: el.trimStart + leftDuration,
          fadeIn: 0,
          transitionIn: "none",
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

  exportProjectFile: () => {
    const s = get();
    return buildProjectFile(s.project, s.tracks, s.elements, s.media);
  },

  importProjectFile: (file) => {
    get().pushHistory();
    set({
      project: file.project,
      tracks: file.tracks.map((t) => ({
        ...t,
        volume: t.volume ?? 1,
      })),
      elements: file.elements.map((e) => ({
        ...defaultElementProps(),
        ...e,
      })),
      media: file.media.map((m) => ({
        src: "",
        ...m,
      })) as MediaAsset[],
      selectedElementIds: [],
      currentTime: 0,
      isPlaying: false,
    });
  },

  hydrateFromAutosave: () => {
    if (get().hydrated) return;
    const saved = loadAutosave();
    if (saved) {
      set({
        project: saved.project,
        tracks: saved.tracks.map((t) => ({ ...t, volume: t.volume ?? 1 })),
        elements: saved.elements.map((e) => ({
          ...defaultElementProps(),
          ...e,
        })),
        media: (saved.media as MediaAsset[]).map((m) => ({
          ...m,
          src: m.src || "",
        })),
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  persistAutosave: () => {
    const s = get();
    // Binary media is stored in IndexedDB; localStorage keeps only project metadata.
    const file = buildProjectFile(s.project, s.tracks, s.elements, s.media);
    autosaveToLocalStorage(file);
  },
}));
