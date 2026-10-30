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
import { motionExpression } from "./keyframes";

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

  const pending = (async () => {
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

  // A failed CDN/network load must not poison every later retry with the same
  // rejected promise. Let the next Export attempt start a fresh load.
  loadingPromise = pending.catch((error) => {
    loadingPromise = null;
    ffmpegInstance = null;
    throw error;
  });
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

function mediaExtension(asset: MediaAsset): string {
  const mime = (asset.mimeType || "").toLowerCase().split(";")[0];
  const byMime: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-m4v": "m4v",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/webm": "webm",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  if (byMime[mime]) return byMime[mime];
  const extension = asset.name.toLowerCase().match(/\\.([a-z0-9]{2,5})$/)?.[1];
  const allowed = new Set(["mp4", "mov", "m4v", "webm", "mp3", "m4a", "aac", "wav", "ogg", "flac", "jpg", "jpeg", "png", "webp", "gif", "avif"]);
  if (extension && allowed.has(extension)) return extension === "jpeg" ? "jpg" : extension;
  return asset.type === "audio" ? "mp3" : asset.type === "image" ? "jpg" : "mp4";
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

    const ext = mediaExtension(asset);

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
      const speed = Math.max(0.5, Math.min(2, el.speed ?? 1));
      if ((el.trimStart || 0) > 0) inputArgs.push("-ss", String(el.trimStart));
      inputArgs.push("-t", String(el.duration * speed), "-i", fname);
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
    const speed = Math.max(0.5, Math.min(2, el.speed ?? 1));
    if ((el.trimStart || 0) > 0) inputArgs.push("-ss", String(el.trimStart));
    inputArgs.push("-t", String(el.duration * speed), "-i", fname);
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
      const fc = (el.fontColor ?? asset.fontColor ?? "#ffffff").replace("#", "");
      const textOpacity = Math.max(0, Math.min(1, el.opacity ?? 1));
      const textX = Math.max(-100, Math.min(100, el.x ?? 0));
      const textY = Math.max(-100, Math.min(100, el.y ?? 0));
      const textScale = Math.max(0.1, Math.min(3, el.scale ?? 1));
      const textScaleExpr = motionExpression(el, "scale", textScale);
      const textXExpr = motionExpression(el, "x", textX);
      const textYExpr = motionExpression(el, "y", textY);
      const hasMotionKeyframes = (el.keyframes?.length ?? 0) > 0;
      const textRotation = (el.rotation ?? 0) * Math.PI / 180;
      const slideDuration = Math.max(0, Math.min(el.duration, el.transitionDuration ?? 0.5));
      const slideDirection = el.transitionIn === "slide-left" ? 1 : el.transitionIn === "slide-right" ? -1 : 0;
      const textTransitionFade = el.transitionIn === "fade" || el.transitionIn === "dissolve" ? (el.transitionDuration ?? 0) : 0;
      const textFadeIn = Math.max(0, Math.min(el.duration, Math.max(el.fadeIn ?? 0, textTransitionFade)));
      const textFadeOut = Math.max(0, Math.min(el.duration, el.fadeOut ?? 0));
      let textAlpha = textOpacity.toFixed(3);
      if (textFadeIn > 0) textAlpha += `*if(lt(t,${start}+${textFadeIn.toFixed(3)}),max(0,(t-${start})/${textFadeIn.toFixed(3)}),1)`;
      if (textFadeOut > 0) textAlpha += `*if(gt(t,${end}-${textFadeOut.toFixed(3)}),max(0,(${end}-t)/${textFadeOut.toFixed(3)}),1)`;
      const textLayer = `txtlayer${overlayIdx}`;
      const out = `tx${overlayIdx}`;
      const fontOpt = hasFont ? `:fontfile=${FONT_FS_NAME}` : "";
      let textChain = `color=c=black@0:s=${width}x${height}:d=${duration}:r=${fps},format=yuva420p,drawtext=text='${txt}'${fontOpt}:fontsize=${fs}:fontcolor=0x${fc}:alpha='${textAlpha}':x=(w-text_w)/2:y=(h-text_h)/2`;
      if (hasMotionKeyframes) textChain += `,scale=w='max(1,iw*(${textScaleExpr}))':h='max(1,ih*(${textScaleExpr}))':eval=frame`;
      else if (textScale !== 1) textChain += `,scale=w='max(1,iw*${textScale.toFixed(3)})':h='max(1,ih*${textScale.toFixed(3)})'`;
      if (textRotation !== 0) textChain += `,rotate=${textRotation.toFixed(5)}:ow=rotw(iw):oh=roth(ih):c=black@0`;
      filterParts.push(`${textChain}[${textLayer}]`);

      const baseTextX = `(W-w)/2+(${textXExpr}/100)*W`;
      const textOverlayX = slideDirection !== 0 && slideDuration > 0
        ? `if(lt(t,${start}+${slideDuration.toFixed(3)}),${baseTextX}+${slideDirection}*W*(1-(t-${start})/${slideDuration.toFixed(3)}),${baseTextX})`
        : baseTextX;
      const textOverlayY = `(H-h)/2+(${textYExpr}/100)*H`;
      filterParts.push(
        `[${lastLabel}][${textLayer}]overlay=x='${textOverlayX}':y='${textOverlayY}':enable='between(t,${start},${end})'[${out}]`
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
    const speed = Math.max(0.5, Math.min(2, el.speed ?? 1));
    const clipScale = Math.max(0.1, Math.min(3, el.scale ?? 1));
    const clipRotation = (el.rotation ?? 0) * Math.PI / 180;
    const clipOpacity = Math.max(0, Math.min(1, el.opacity ?? 1));
    const positionX = Math.max(-100, Math.min(100, el.x ?? 0));
    const positionY = Math.max(-100, Math.min(100, el.y ?? 0));
    const positionXExpr = motionExpression(el, "x", positionX);
    const positionYExpr = motionExpression(el, "y", positionY);
    const hasMotionKeyframes = (el.keyframes?.length ?? 0) > 0;
    let chain = `[${inIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,format=yuva420p,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0,setpts=(PTS-STARTPTS)/${speed.toFixed(3)}+${start}/TB`;
    if (hasMotionKeyframes) chain += `,scale=w='max(1,iw*(${motionExpression(el, "scale", clipScale)}))':h='max(1,ih*(${motionExpression(el, "scale", clipScale)}))':eval=frame`;
    else if (clipScale !== 1) chain += `,scale=w='max(1,iw*${clipScale.toFixed(3)})':h='max(1,ih*${clipScale.toFixed(3)})'`;
    if (clipRotation !== 0) chain += `,rotate=${clipRotation.toFixed(5)}:ow=rotw(iw):oh=roth(ih):c=black@0`;
    if (clipOpacity < 1) chain += `,colorchannelmixer=aa=${clipOpacity.toFixed(3)}`;
    const transitionFade = el.transitionIn === "fade" || el.transitionIn === "dissolve"
      ? (el.transitionDuration ?? 0)
      : 0;
    const visualFadeIn = Math.max(0, Math.min(el.duration, Math.max(el.fadeIn ?? 0, transitionFade)));
    const visualFadeOut = Math.max(0, Math.min(el.duration, el.fadeOut ?? 0));
    if (visualFadeIn > 0) chain += `,fade=t=in:st=${start.toFixed(3)}:d=${visualFadeIn.toFixed(3)}:alpha=1`;
    if (visualFadeOut > 0) chain += `,fade=t=out:st=${(end - visualFadeOut).toFixed(3)}:d=${visualFadeOut.toFixed(3)}:alpha=1`;

    // Apply non-destructive color controls consistently with the live Preview.
    const brightness = Math.max(0, Math.min(2, el.brightness ?? 1));
    const contrast = Math.max(0.5, Math.min(2, el.contrast ?? 1));
    const saturation = Math.max(0, Math.min(3, el.saturation ?? 1));
    const hue = Math.max(-180, Math.min(180, el.hue ?? 0));
    const blur = Math.max(0, Math.min(12, el.blur ?? 0));
    if (brightness !== 1 || contrast !== 1 || saturation !== 1) {
      chain += `,eq=brightness=${(brightness - 1).toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`;
    }
    if (hue !== 0) chain += `,hue=h=${hue.toFixed(1)}`;
    if (blur > 0) chain += `,gblur=sigma=${Math.max(0.1, blur).toFixed(2)}`;

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

    const baseOverlayX = `(W-w)/2+(${positionXExpr}/100)*W`;
    const overlayY = `(H-h)/2+(${positionYExpr}/100)*H`;
    const slideDuration = Math.max(0, Math.min(el.duration, el.transitionDuration ?? 0.5));
    const slideDirection = el.transitionIn === "slide-left" ? 1 : el.transitionIn === "slide-right" ? -1 : 0;
    const overlayX = slideDirection !== 0 && slideDuration > 0
      ? `if(lt(t,${start}+${slideDuration.toFixed(3)}),${baseOverlayX}+${slideDirection}*W*(1-(t-${start})/${slideDuration.toFixed(3)}),${baseOverlayX})`
      : baseOverlayX;
    filterParts.push(
      `[${lastLabel}][${scaled}]overlay=x='${overlayX}':y='${overlayY}':enable='${fadeEnableExpr(el)}'[${out}]`
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
    const speed = Math.max(0.5, Math.min(2, el.speed ?? 1));
    const sourceDuration = el.duration * speed;
    const delayMs = Math.max(0, Math.round(el.startTime * 1000));
    const label = `aud${audioIndex++}`;
    const fadeIn = Math.max(0, Math.min(el.duration, el.fadeIn ?? 0));
    const fadeOut = Math.max(0, Math.min(el.duration, el.fadeOut ?? 0));
    let audioChain = `[${inputIndex}:a]atrim=start=0:duration=${sourceDuration.toFixed(3)},asetpts=PTS-STARTPTS,atempo=${speed.toFixed(3)},volume=${volume.toFixed(3)}`;
    if (fadeIn > 0) audioChain += `,afade=t=in:st=0:d=${fadeIn.toFixed(3)}`;
    if (fadeOut > 0) audioChain += `,afade=t=out:st=${Math.max(0, el.duration - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`;
    audioFilterParts.push(`${audioChain},adelay=${delayMs}:all=1[${label}]`);
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
    ...(filterComplex ? ["-filter_complex", filterComplex] : []),
    ...(filterParts.length > 0 ? ["-map", `[${lastLabel}]`] : ["-map", "0:v"]),
    ...(audioIndex > 0
      ? ["-map", "[aout]", "-c:a", options.format === "webm" ? "libopus" : "aac", "-b:a", "192k"]
      : ["-an"]),
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

  const cleanupFailedExport = async () => {
    try { await ffmpeg.deleteFile(outName); } catch { /* file may not exist */ }
    const names: string[] = [];
    fileMap.forEach((name) => names.push(name));
    for (const name of names) {
      try { await ffmpeg.deleteFile(name); } catch { /* continue cleanup */ }
    }
  };
  try { await ffmpeg.deleteFile(outName); } catch { /* no previous output */ }

  let exitCode: number;
  try {
    exitCode = await ffmpeg.exec(args);
  } catch (error) {
    await cleanupFailedExport();
    throw new Error(`FFmpeg không thể hoàn tất export: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (exitCode !== 0) {
    await cleanupFailedExport();
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
