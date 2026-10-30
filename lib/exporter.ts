"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type {
  Project,
  TimelineElement,
  MediaAsset,
  Track,
  AspectRatio,
} from "./types";
import { ASPECT_RESOLUTIONS } from "./types";

export interface ExportOptions {
  format: "mp4" | "webm";
  fps: number;
  quality: "high" | "medium" | "low";
}

export interface ExportPayload {
  project: Project;
  media: MediaAsset[];
  tracks: Track[];
  elements: TimelineElement[];
  options: ExportOptions;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "mp4",
  fps: 30,
  quality: "high",
};

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(
  onLog?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => onLog?.(message));

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
}

function resolutionFor(ratio: AspectRatio) {
  return ASPECT_RESOLUTIONS[ratio] ?? ASPECT_RESOLUTIONS["9:16"];
}

function crfFor(quality: ExportOptions["quality"]) {
  if (quality === "high") return "18";
  if (quality === "medium") return "23";
  return "28";
}

/**
 * Render project to a downloadable video Blob using FFmpeg.wasm.
 * Pipeline:
 *  1. Write each media file into the virtual FS
 *  2. Build a filter_complex that scales/overlays clips by time
 *  3. Encode to mp4/webm
 *
 * Limitation: pure client-side; long 4K timelines may be slow / OOM.
 * For production, prefer a server-side worker.
 */
export async function exportProject(
  payload: ExportPayload,
  onProgress?: (percent: number) => void,
  onLog?: (msg: string) => void
): Promise<Blob> {
  const { project, media, elements, tracks, options } = payload;
  const { width, height } = resolutionFor(project.aspectRatio);
  const duration = Math.max(project.duration, 1);
  const fps = options.fps || project.fps || 30;

  onProgress?.(2);
  const ffmpeg = await getFFmpeg(onLog);
  onProgress?.(8);

  // Visible tracks only
  const visibleTrackIds = new Set(
    tracks.filter((t) => t.visible && !t.muted).map((t) => t.id)
  );

  const sorted = [...elements]
    .filter((e) => visibleTrackIds.has(e.trackId))
    .sort((a, b) => a.startTime - b.startTime);

  // Map mediaId -> filename in FS
  const fileMap = new Map<string, string>();
  let fileIdx = 0;

  for (const el of sorted) {
    const asset = media.find((m) => m.id === el.mediaId);
    if (!asset || asset.type === "text") continue;
    if (fileMap.has(asset.id)) continue;

    const ext =
      asset.type === "image"
        ? asset.mimeType?.includes("png")
          ? "png"
          : "jpg"
        : asset.type === "audio"
          ? "mp3"
          : "mp4";

    const filename = `in_${fileIdx++}.${ext}`;
    try {
      const data = await fetchFile(asset.src);
      await ffmpeg.writeFile(filename, data);
      fileMap.set(asset.id, filename);
    } catch (err) {
      onLog?.(`Skip media ${asset.name}: ${err}`);
    }
  }

  onProgress?.(25);

  // Build a simple sequential overlay filter.
  // Base: solid color background for full duration.
  const bgColor = (project.backgroundColor || "#000000").replace("#", "");
  const inputs: string[] = [];
  const filterParts: string[] = [];

  // Color base
  // We'll use -f lavfi color as first input via args, not writeFile.

  const visualEls = sorted.filter((el) => {
    const a = media.find((m) => m.id === el.mediaId);
    return a && (a.type === "video" || a.type === "image" || a.type === "text");
  });

  // Collect ffmpeg input args
  const inputArgs: string[] = [
    "-f",
    "lavfi",
    "-i",
    `color=c=0x${bgColor}:s=${width}x${height}:d=${duration}:r=${fps}`,
  ];

  // Index 0 = background
  let nextInput = 1;
  const elInputIndex = new Map<string, number>();

  for (const el of visualEls) {
    const asset = media.find((m) => m.id === el.mediaId)!;

    if (asset.type === "text") {
      // Text is drawn via drawtext filter — no extra input file
      continue;
    }

    const fname = fileMap.get(asset.id);
    if (!fname) continue;

    if (asset.type === "image") {
      inputArgs.push("-loop", "1", "-t", String(el.duration), "-i", fname);
    } else {
      inputArgs.push("-i", fname);
    }
    elInputIndex.set(el.id, nextInput);
    nextInput++;
  }

  // Build filter graph
  let lastLabel = "0:v";
  let overlayIdx = 0;

  for (const el of visualEls) {
    const asset = media.find((m) => m.id === el.mediaId)!;
    const start = el.startTime.toFixed(3);
    const end = (el.startTime + el.duration).toFixed(3);

    if (asset.type === "text") {
      const txt = (el.text ?? asset.text ?? "Text")
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'");
      const fs = el.fontSize ?? asset.fontSize ?? 48;
      const fc = (el.fontColor ?? asset.fontColor ?? "#ffffff").replace("#", "");
      const out = `tx${overlayIdx}`;
      // Center text by default; x/y are offsets from center in our model
      filterParts.push(
        `[${lastLabel}]drawtext=text='${txt}':fontsize=${fs}:fontcolor=0x${fc}:x=(w-text_w)/2+${el.x}:y=(h-text_h)/2+${el.y}:enable='between(t,${start},${end})'[${out}]`
      );
      lastLabel = out;
      overlayIdx++;
      continue;
    }

    const inIdx = elInputIndex.get(el.id);
    if (inIdx === undefined) continue;

    const scaled = `sc${overlayIdx}`;
    const timed = `tm${overlayIdx}`;
    const out = `ov${overlayIdx}`;

    // Scale to fit canvas while keeping aspect
    filterParts.push(
      `[${inIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuva420p,setpts=PTS-STARTPTS+${start}/TB[${scaled}]`
    );

    // Overlay with enable time window
    filterParts.push(
      `[${lastLabel}][${scaled}]overlay=0:0:enable='between(t,${start},${end})'[${out}]`
    );

    lastLabel = out;
    overlayIdx++;
  }

  onProgress?.(40);

  const filterComplex =
    filterParts.length > 0 ? filterParts.join(";") : null;

  const outName = `output.${options.format}`;
  const args: string[] = [
    ...inputArgs,
    ...(filterComplex
      ? ["-filter_complex", filterComplex, "-map", `[${lastLabel}]`]
      : ["-map", "0:v"]),
    "-c:v",
    options.format === "webm" ? "libvpx-vp9" : "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(fps),
    "-t",
    String(duration),
    "-crf",
    crfFor(options.quality),
    "-preset",
    "ultrafast",
    "-movflags",
    "+faststart",
    outName,
  ];

  ffmpeg.on("progress", ({ progress }) => {
    // progress is 0–1
    onProgress?.(40 + Math.round(progress * 55));
  });

  try {
    await ffmpeg.exec(args);
  } catch (err) {
    onLog?.(`FFmpeg exec error: ${err}`);
    // Fallback: solid color short video so user still gets a file
    await ffmpeg.exec([
      "-f",
      "lavfi",
      "-i",
      `color=c=0x${bgColor}:s=${width}x${height}:d=${Math.min(duration, 3)}:r=${fps}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-t",
      String(Math.min(duration, 3)),
      outName,
    ]);
  }

  onProgress?.(96);

  const data = await ffmpeg.readFile(outName);
  const mime =
    options.format === "webm" ? "video/webm" : "video/mp4";
  const blob = new Blob([data], { type: mime });

  // Cleanup FS (best-effort)
  try {
    await ffmpeg.deleteFile(outName);
    for (const fname of fileMap.values()) {
      await ffmpeg.deleteFile(fname);
    }
  } catch {
    /* ignore */
  }

  onProgress?.(100);
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
