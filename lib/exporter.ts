"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type {
  Project,
  TimelineElement,
  MediaAsset,
  Track,
  ExportResolution,
} from "./types";
import { resolutionPixels } from "./types";

export interface ExportOptions {
  format: "mp4" | "webm";
  fps: number;
  quality: "high" | "medium" | "low";
  resolution: ExportResolution;
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
  resolution: "1080p",
};

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const FONT_FS_NAME = "NotoSans-Regular.ttf";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let fontLoaded = false;

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
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
    console.warn("Font load failed", err);
  }
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

/** Build fade + alpha expression for overlay opacity over global time */
function fadeEnableExpr(el: TimelineElement): string {
  const s = el.startTime;
  const e = el.startTime + el.duration;
  const fi = el.fadeIn || 0;
  const fo = el.fadeOut || 0;
  const td =
    el.transitionIn !== "none" ? el.transitionDuration || 0 : 0;
  const inDur = Math.max(fi, td);
  // enable window
  return `between(t,${s.toFixed(3)},${e.toFixed(3)})`;
}

function alphaExpr(el: TimelineElement): string {
  const s = el.startTime;
  const e = el.startTime + el.duration;
  const fi = el.fadeIn || 0;
  const fo = el.fadeOut || 0;
  const td =
    el.transitionIn !== "none" && el.transitionIn !== "slide-left" && el.transitionIn !== "slide-right"
      ? el.transitionDuration || 0
      : 0;
  const inDur = Math.max(fi, td);
  const parts: string[] = [`${el.opacity ?? 1}`];
  if (inDur > 0) {
    // ramp 0→1 over inDur from start
    parts.push(
      `if(lt(t-${s.toFixed(3)}\\,${inDur.toFixed(3)})\\,(t-${s.toFixed(3)})/${inDur.toFixed(3)}\\,1)`
    );
  }
  if (fo > 0) {
    parts.push(
      `if(gt(t\\,${(e - fo).toFixed(3)})\\,(${e.toFixed(3)}-t)/${fo.toFixed(3)}\\,1)`
    );
  }
  return parts.join("*");
}

export async function exportProject(
  payload: ExportPayload,
  onProgress?: (p: ExportProgress) => void,
  onLog?: (msg: string) => void
): Promise<Blob> {
  const { project, media, elements, tracks, options } = payload;
  const { width, height } = resolutionPixels(
    project.aspectRatio,
    options.resolution || "1080p"
  );
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

  let written = 0;
  const toWrite = sorted.filter((el) => {
    const a = media.find((m) => m.id === el.mediaId);
    return a && a.type !== "text";
  });
  const uniqueMedia = new Set<string>();

  for (const el of sorted) {
    const asset = media.find((m) => m.id === el.mediaId);
    if (!asset || asset.type === "text") continue;
    if (fileMap.has(asset.id)) continue;
    if (!asset.src) continue;

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
      uniqueMedia.add(asset.id);
    } catch (err) {
      onLog?.(`Skip media ${asset.name}: ${err}`);
    }
    written++;
    report(
      "writing-media",
      15 + Math.round((written / Math.max(toWrite.length, 1)) * 15),
      `Đã ghi ${uniqueMedia.size} file media…`
    );
  }

  report("building-graph", 32, `Đang dựng filter (${width}x${height})…`);

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
      // Seek and bound each placed instance independently so trim handles affect export.
      if ((el.trimStart || 0) > 0) inputArgs.push("-ss", String(el.trimStart));
      inputArgs.push("-t", String(el.duration), "-i", fname);
    }
    elInputIndex.set(el.id, nextInput);
    nextInput++;
  }

  // Audio clips are separate inputs; their trim, timeline offset and clip/track
  // volume are applied in the audio filter graph below.
  const audioEls = sorted.filter((el) => {
    const asset = media.find((m) => m.id === el.mediaId);
    const track = tracks.find((t) => t.id === el.trackId);
    return asset?.type === "audio" && track?.visible !== false && track?.muted !== true;
  });
  const audioInputIndex = new Map<string, number>();
  for (const el of audioEls) {
    const asset = media.find((m) => m.id === el.mediaId);
    const fname = asset ? fileMap.get(asset.id) : undefined;
    if (!fname) continue;
    if ((el.trimStart || 0) > 0) inputArgs.push("-ss", String(el.trimStart));
    inputArgs.push("-t", String(el.duration), "-i", fname);
    audioInputIndex.set(el.id, nextInput++);
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
      // approximate fade via alpha not available on drawtext easily — use enable window
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
    const faded = `fd${overlayIdx}`;
    const out = `ov${overlayIdx}`;

    // Scale + pad
    let chain = `[${inIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuva420p,setpts=PTS-STARTPTS+${start}/TB`;

    // Fade in/out on the clip stream (relative to clip)
    const fi = el.fadeIn || 0;
    const fo = el.fadeOut || 0;
    const td =
      el.transitionIn === "fade" || el.transitionIn === "dissolve"
        ? el.transitionDuration || 0
        : 0;
    const inFade = Math.max(fi, td);
    if (inFade > 0) {
      chain += `,fade=t=in:st=0:d=${inFade.toFixed(3)}:alpha=1`;
    }
    if (fo > 0) {
      chain += `,fade=t=out:st=${Math.max(0, el.duration - fo).toFixed(3)}:d=${fo.toFixed(3)}:alpha=1`;
    }
    chain += `[${scaled}]`;
    filterParts.push(chain);

    // Slide offset approximation via overlay x
    let ox = 0;
    if (el.transitionIn === "slide-left" || el.transitionIn === "slide-right") {
      // static mid-point not animated in simple graph — center
      ox = 0;
    }

    filterParts.push(
      `[${lastLabel}][${scaled}]overlay=${ox}:0:enable='${fadeEnableExpr(el)}'[${out}]`
    );

    lastLabel = out;
    overlayIdx++;
  }

  report("encoding", 40, `Đang encode ${options.resolution}…`);

  const audioFilterParts: string[] = [];
  let audioIndex = 0;
  for (const el of audioEls) {
    const inputIndex = audioInputIndex.get(el.id);
    if (inputIndex === undefined) continue;
    const track = tracks.find((t) => t.id === el.trackId);
    const volume = Math.max(0, Math.min(4, (el.volume ?? 1) * (track?.volume ?? 1)));
    const delayMs = Math.max(0, Math.round(el.startTime * 1000));
    const label = `aud${audioIndex++}`;
    audioFilterParts.push(
      `[${inputIndex}:a]atrim=start=0:duration=${el.duration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${volume.toFixed(3)},adelay=${delayMs}:all=1[${label}]`
    );
  }
  if (audioIndex > 0) {
    const labels = Array.from({ length: audioIndex }, (_, i) => `[aud${i}]`).join("");
    audioFilterParts.push(
      `${labels}amix=inputs=${audioIndex}:duration=longest:dropout_transition=0,apad,atrim=duration=${duration.toFixed(3)}[aout]`
    );
  }

  const allFilters = [...filterParts, ...audioFilterParts];
  const filterComplex = allFilters.length > 0 ? allFilters.join(";") : null;

  const outName = `output.${options.format}`;
  const args: string[] = [
    ...inputArgs,
    ...(filterComplex
      ? ["-filter_complex", filterComplex, "-map", `[${lastLabel}]`]
      : ["-map", "0:v"]),
    ...(audioIndex > 0 ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"] : ["-an"]),
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
    ...(options.format === "mp4" ? ["-movflags", "+faststart"] : []),
    outName,
  ];

  ffmpeg.on("progress", ({ progress }) => {
    const pct = 40 + Math.round(Math.min(1, Math.max(0, progress)) * 52);
    report("encoding", pct, `Đang encode… ${pct}%`);
  });

  const exitCode = await ffmpeg.exec(args);
  if (exitCode !== 0) {
    throw new Error(`FFmpeg export failed (exit code ${exitCode}). Không tạo file MP4 giả hoặc video nền thay thế.`);
  }

  report("finishing", 95, "Đang đóng gói file…");

  const data = await ffmpeg.readFile(outName);
  const outputBytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  if (outputBytes.byteLength < 1024) {
    throw new Error("File xuất quá nhỏ hoặc rỗng. Vui lòng kiểm tra media và thử lại.");
  }
  const mime =
    options.format === "webm" ? "video/webm" : "video/mp4";
  // Copy into a standalone ArrayBuffer to satisfy BlobPart typing across TS/DOM versions.
  const blob = new Blob([Uint8Array.from(outputBytes).buffer], { type: mime });

  try {
    await ffmpeg.deleteFile(outName);
    const temporaryFiles: string[] = [];
    fileMap.forEach((fname) => temporaryFiles.push(fname));
    for (let index = 0; index < temporaryFiles.length; index += 1) {
      await ffmpeg.deleteFile(temporaryFiles[index]);
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
