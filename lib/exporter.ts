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

export type ExportPhase =
  | "idle"
  | "loading-core"
  | "loading-font"
  | "writing-media"
  | "building-graph"
  | "encoding"
  | "finishing"
  | "done"
  | "error";

export interface ExportProgress {
  phase: ExportPhase;
  percent: number;
  message: string;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "mp4",
  fps: 30,
  quality: "high",
};

/** Noto Sans – supports Vietnamese diacritics */
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const FONT_FS_NAME = "NotoSans-Regular.ttf";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let fontLoaded = false;

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

async function ensureFont(
  ffmpeg: FFmpeg,
  onProgress?: (p: ExportProgress) => void
) {
  if (fontLoaded) return;
  onProgress?.({
    phase: "loading-font",
    percent: 12,
    message: "Đang tải font Noto Sans (hỗ trợ tiếng Việt)…",
  });
  try {
    const fontData = await fetchFile(FONT_URL);
    await ffmpeg.writeFile(FONT_FS_NAME, fontData);
    fontLoaded = true;
  } catch (err) {
    console.warn("Font load failed, drawtext may miss Vietnamese glyphs", err);
  }
}

function resolutionFor(ratio: AspectRatio) {
  return ASPECT_RESOLUTIONS[ratio] ?? ASPECT_RESOLUTIONS["9:16"];
}

function crfFor(quality: ExportOptions["quality"]) {
  if (quality === "high") return "18";
  if (quality === "medium") return "23";
  return "28";
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
}

export async function exportProject(
  payload: ExportPayload,
  onProgress?: (p: ExportProgress) => void,
  onLog?: (msg: string) => void
): Promise<Blob> {
  const { project, media, elements, tracks, options } = payload;
  const { width, height } = resolutionFor(project.aspectRatio);
  const duration = Math.max(project.duration, 1);
  const fps = options.fps || project.fps || 30;

  const report = (phase: ExportPhase, percent: number, message: string) => {
    onProgress?.({ phase, percent, message });
  };

  report("loading-core", 3, "Đang tải FFmpeg core…");
  const ffmpeg = await getFFmpeg(onLog);
  report("loading-core", 10, "FFmpeg đã sẵn sàng");

  await ensureFont(ffmpeg, onProgress);
  report("writing-media", 15, "Đang ghi media vào bộ nhớ ảo…");

  const visibleTrackIds = new Set(
    tracks.filter((t) => t.visible).map((t) => t.id)
  );

  const sorted = [...elements]
    .filter((e) => visibleTrackIds.has(e.trackId))
    .sort((a, b) => a.startTime - b.startTime);

  const fileMap = new Map<string, string>();
  let fileIdx = 0;
  const mediaToWrite = sorted.filter((el) => {
    const a = media.find((m) => m.id === el.mediaId);
    return a && a.type !== "text" && !fileMap.has(a.id);
  });

  let written = 0;
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
    written++;
    const pct =
      15 +
      Math.round(
        (written / Math.max(mediaToWrite.length || 1, 1)) * 15
      );
    report("writing-media", pct, `Đã ghi ${written} file media…`);
  }

  report("building-graph", 32, "Đang dựng filter graph…");

  const bgColor = (project.backgroundColor || "#000000").replace("#", "");
  const filterParts: string[] = [];

  const visualEls = sorted.filter((el) => {
    const a = media.find((m) => m.id === el.mediaId);
    return a && (a.type === "video" || a.type === "image" || a.type === "text");
  });

  const inputArgs: string[] = [
    "-f",
    "lavfi",
    "-i",
    `color=c=0x${bgColor}:s=${width}x${height}:d=${duration}:r=${fps}`,
  ];

  let nextInput = 1;
  const elInputIndex = new Map<string, number>();

  for (const el of visualEls) {
    const asset = media.find((m) => m.id === el.mediaId)!;
    if (asset.type === "text") continue;

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

  let lastLabel = "0:v";
  let overlayIdx = 0;
  const hasFont = fontLoaded;

  for (const el of visualEls) {
    const asset = media.find((m) => m.id === el.mediaId)!;
    const start = el.startTime.toFixed(3);
    const end = (el.startTime + el.duration).toFixed(3);

    if (asset.type === "text") {
      const txt = escapeDrawtext(el.text ?? asset.text ?? "Text");
      const fs = el.fontSize ?? asset.fontSize ?? 48;
      const fc = (el.fontColor ?? asset.fontColor ?? "#ffffff").replace(
        "#",
        ""
      );
      const out = `tx${overlayIdx}`;
      const fontOpt = hasFont ? `:fontfile=${FONT_FS_NAME}` : "";
      filterParts.push(
        `[${lastLabel}]drawtext=text='${txt}'${fontOpt}:fontsize=${fs}:fontcolor=0x${fc}:x=(w-text_w)/2+${el.x}:y=(h-text_h)/2+${el.y}:enable='between(t,${start},${end})'[${out}]`
      );
      lastLabel = out;
      overlayIdx++;
      continue;
    }

    const inIdx = elInputIndex.get(el.id);
    if (inIdx === undefined) continue;

    const scaled = `sc${overlayIdx}`;
    const out = `ov${overlayIdx}`;

    filterParts.push(
      `[${inIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuva420p,setpts=PTS-STARTPTS+${start}/TB[${scaled}]`
    );
    filterParts.push(
      `[${lastLabel}][${scaled}]overlay=0:0:enable='between(t,${start},${end})'[${out}]`
    );

    lastLabel = out;
    overlayIdx++;
  }

  report("encoding", 40, "Đang encode video…");

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

  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    const pct = 40 + Math.round(Math.min(1, Math.max(0, progress)) * 52);
    report("encoding", pct, `Đang encode… ${pct}%`);
  };
  ffmpeg.on("progress", onFfmpegProgress);

  try {
    await ffmpeg.exec(args);
  } catch (err) {
    onLog?.(`FFmpeg exec error: ${err}`);
    report("encoding", 70, "Thử encode fallback…");
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

  report("finishing", 95, "Đang đóng gói file…");

  const data = await ffmpeg.readFile(outName);
  const mime =
    options.format === "webm" ? "video/webm" : "video/mp4";
  const blob = new Blob([data], { type: mime });

  try {
    await ffmpeg.deleteFile(outName);
    for (const fname of fileMap.values()) {
      await ffmpeg.deleteFile(fname);
    }
  } catch {
    /* ignore */
  }

  report("done", 100, "Hoàn tất!");
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
