"use client";

import { useEditorStore } from "@/lib/store";
import { formatTime } from "@/lib/utils";
import { useEffect, useRef } from "react";

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
  const lastTs = useRef<number>(0);
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;

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

  const activeElements = elements.filter(
    (el) =>
      currentTime >= el.startTime &&
      currentTime < el.startTime + el.duration &&
      tracks.find((t) => t.id === el.trackId)?.visible !== false
  );

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
        <div
          className={`${ASPECT_MAP[project.aspectRatio] ?? "aspect-[9/16]"} relative h-full max-h-full w-auto max-w-full overflow-hidden rounded-lg shadow-2xl`}
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

              if (asset.type === "text") {
                const text = el.text ?? asset.text ?? "Text";
                const fontSize = el.fontSize ?? asset.fontSize ?? 48;
                const color = el.fontColor ?? asset.fontColor ?? "#ffffff";
                return (
                  <div
                    key={el.id}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{
                      opacity: el.opacity,
                      transform: `translate(${el.x}px, ${el.y}px) scale(${el.scale}) rotate(${el.rotation}deg)`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: `${fontSize}px`,
                        color,
                        fontFamily: el.fontFamily ?? asset.fontFamily ?? "Arial",
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
                      opacity: el.opacity,
                      transform: `translate(${el.x}px, ${el.y}px) scale(${el.scale}) rotate(${el.rotation}deg)`,
                    }}
                  />
                );
              }

              if (asset.type === "video") {
                return (
                  <video
                    key={el.id}
                    src={asset.src}
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{
                      opacity: el.opacity,
                      transform: `translate(${el.x}px, ${el.y}px) scale(${el.scale}) rotate(${el.rotation}deg)`,
                    }}
                    muted
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
