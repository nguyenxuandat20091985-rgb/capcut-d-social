"use client";

import type { ProjectFile, MediaAsset, TimelineElement, Track, Project } from "./types";

const STORAGE_KEY = "capcut-d-social-autosave";

export function buildProjectFile(
  project: Project,
  tracks: Track[],
  elements: TimelineElement[],
  media: MediaAsset[]
): ProjectFile {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    project,
    tracks,
    elements,
    // Keep object URLs when still valid in same session; strip for pure JSON download of structure
    media: media.map(({ src, ...rest }) => ({
      ...rest,
      src: src?.startsWith("blob:") ? undefined : src,
    })),
  };
}

export function downloadProjectJson(file: ProjectFile, filename?: string) {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${file.project.name || "project"}.cds.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function parseProjectFile(json: string): ProjectFile {
  const data = JSON.parse(json) as ProjectFile;
  if (!data || data.version !== 1 || !data.project || !Array.isArray(data.elements)) {
    throw new Error("File dự án không hợp lệ");
  }
  return data;
}

export function autosaveToLocalStorage(file: ProjectFile) {
  try {
    // Store full media with blob urls for same-session restore
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch {
    // quota exceeded — ignore
  }
}

export function loadAutosave(): ProjectFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseProjectFile(raw);
  } catch {
    return null;
  }
}

export function clearAutosave() {
  localStorage.removeItem(STORAGE_KEY);
}
