"use client";

import { useEditorStore } from "@/lib/store";
import { formatTime } from "@/lib/utils";
import { fadedOpacity, slideOffset } from "@/lib/fade";
import { useEffect, useRef, useMemo } from "react";

const ASPECT_MAP: Record<string, string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-[16/9]",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
};

export default function Preview() {
  const project = useEditorStore((s) => s.project);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const elements = useEditorStore((s) => s.elements);
  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);

  const rafRef = useRef<number>();
  const lastTs = useRef(0);
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastTs.current = 0;
      return;
    }
    const tick = (ts: number) => {
      if (lastTs.current === 0) lastTs.current = ts;
      const delta = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      const next = timeRef.current + delta;
      if (next >= project.duration) {
        setCurrentTime(0);
        setPlaying(false);
        lastTs.current = 0;
        return;
      }
      setCurrentTime(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTs.current = 0;
    };
  }, [isPlaying, project.duration, setCurrentTime, setPlaying]);

  const activeElements = useMemo(
    () =>
      elements.filter(
        (el) =>
          currentTime >= el.startTime &&
          currentTime < el.startTime + el.duration &&
          tracks.find((t) => t.id === el.trackId)?.visible !== false
      ),
    [elements, currentTime, tracks]
  );

  const stageW = stageRef.current?.clientWidth ?? 360;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        <div
          ref={stageRef}
          className={`${ASPECT_MAP[project.aspectRatio] ?? "aspect-[9/16]"} relative h-full max-h-full w-auto max-w-full overflow-hidden rounded-lg shadow-2xl will-change-transform`}
          style={{ backgroundColor: project.backgroundColor }}
        >
          {activeElements.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-600">
              Preview
            </div>
          ) : (
            activeElements.map((el) => {
              const asset = media.find((m) => m.id === el.mediaId);
              if (!asset) return null;
              const local = currentTime - el.startTime;
              const opacity = fadedOpacity(el, local);
              const slideX = slideOffset(el, local, stageW);

              if (asset.type === "text") {
                const text = el.text ?? asset.text ?? "Text";
                const fontSize = el.fontSize ?? asset.fontSize ?? 48;
                const color = el.fontColor ?? asset.fontColor ?? "#ffffff";
                return (
                  <div
                    key={el.id}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{
                      opacity,
                      transform: `translate(${el.x + slideX}px, ${el.y}px) scale(${el.scale}) rotate(${el.rotation}deg)`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: `${fontSize}px`,
                        color,
                        fontFamily:
                          el.fontFamily ?? asset.fontFamily ?? "Noto Sans, Arial",
                        textShadow: "0 2px 8px rgba(0,0,0,0.7)",
                        whiteSpace: "pre-wrap",
                        textAlign: "center",
                        padding: "0 16px",
                      }}
                    >
                      {text}
                    </span>
                  </div>
                );
              }

              if (asset.type === "image") {
                return (
                  <img
                    key={el.id}
                    src={asset.src}
                    alt={asset.name}
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{
                      opacity,
                      transform: `translate(${el.x + slideX}px, ${el.y}px) scale(${el.scale}) rotate(${el.rotation}deg)`,
                    }}
                    draggable={false}
                  />
                );
              }

              if (asset.type === "video") {
                return (
                  <VideoLayer
                    key={el.id}
                    src={asset.src}
                    localTime={local + (el.trimStart || 0)}
                    isPlaying={isPlaying}
                    opacity={opacity}
                    style={{
                      transform: `translate(${el.x + slideX}px, ${el.y}px) scale(${el.scale}) rotate(${el.rotation}deg)`,
                    }}
                  />
                );
              }

              return null;
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-gray-800 py-2 text-xs text-gray-400">
        <span>{formatTime(currentTime)}</span>
        <span>/</span>
        <span>{formatTime(project.duration)}</span>
        <span className="text-gray-600">·</span>
        <span>{project.aspectRatio}</span>
        <span className="text-gray-600">·</span>
        <span>{project.fps} fps</span>
      </div>
    </div>
  );
}

/** Keep a single video element in sync with playhead without remounting */
function VideoLayer({
  src,
  localTime,
  isPlaying,
  opacity,
  style,
}: {
  src: string;
  localTime: number;
  isPlaying: boolean;
  opacity: number;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (Math.abs(v.currentTime - localTime) > 0.25) {
      v.currentTime = Math.max(0, localTime);
    }
  }, [localTime]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying]);

  return (
    <video
      ref={ref}
      src={src}
      className="absolute inset-0 h-full w-full object-contain"
      style={{ opacity, ...style }}
      muted
      playsInline
      preload="auto"
    />
  );
}
