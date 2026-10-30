"use client";

import { useEditorStore } from "@/lib/store";
import { formatTime, cn } from "@/lib/utils";
import { Plus, Volume2, VolumeX, Eye, EyeOff } from "lucide-react";
import { useRef, useCallback } from "react";

const PIXELS_PER_SECOND = 40;
const TRACK_HEIGHT = 48;

export default function Timeline() {
  const tracks = useEditorStore((s) => s.tracks);
  const elements = useEditorStore((s) => s.elements);
  const media = useEditorStore((s) => s.media);
  const project = useEditorStore((s) => s.project);
  const currentTime = useEditorStore((s) => s.currentTime);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const seek = useEditorStore((s) => s.seek);
  const selectElements = useEditorStore((s) => s.selectElements);
  const addTrack = useEditorStore((s) => s.addTrack);
  const toggleTrackMute = useEditorStore((s) => s.toggleTrackMute);
  const toggleTrackVisibility = useEditorStore((s) => s.toggleTrackVisibility);
  const removeElements = useEditorStore((s) => s.removeElements);
  const splitElement = useEditorStore((s) => s.splitElement);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineWidth = Math.max(project.duration * PIXELS_PER_SECOND, 800);

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      seek(x / PIXELS_PER_SECOND);
    },
    [seek]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedElementIds.length) {
        removeElements(selectedElementIds);
      }
    }
    if (e.key === "s" || e.key === "S") {
      if (selectedElementIds.length === 1) {
        splitElement(selectedElementIds[0], currentTime);
      }
    }
  };

  return (
    <div
      className="flex h-full flex-col outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-400">Timeline</span>
        <button
          onClick={() => addTrack("video")}
          className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <Plus size={12} /> Video track
        </button>
        <button
          onClick={() => addTrack("audio")}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <Plus size={12} /> Audio track
        </button>
        <span className="text-[10px] text-gray-600">
          Del = delete · S = split
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Track labels */}
        <div className="w-36 shrink-0 border-r border-gray-800">
          <div className="h-6 border-b border-gray-800" />
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-1 border-b border-gray-800/50 px-2"
              style={{ height: TRACK_HEIGHT }}
            >
              <span className="flex-1 truncate text-xs text-gray-300">
                {track.name}
              </span>
              <button
                onClick={() => toggleTrackMute(track.id)}
                className="rounded p-0.5 text-gray-500 hover:text-white"
              >
                {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <button
                onClick={() => toggleTrackVisibility(track.id)}
                className="rounded p-0.5 text-gray-500 hover:text-white"
              >
                {track.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            </div>
          ))}
        </div>

        {/* Scrollable timeline area */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto">
          {/* Ruler */}
          <div
            className="relative h-6 cursor-pointer border-b border-gray-800 bg-gray-950"
            style={{ width: timelineWidth }}
            onClick={handleRulerClick}
          >
            {Array.from({ length: Math.ceil(project.duration) + 1 }).map(
              (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-gray-700"
                  style={{ left: i * PIXELS_PER_SECOND }}
                >
                  <span className="ml-1 text-[10px] text-gray-500">
                    {formatTime(i)}
                  </span>
                </div>
              )
            )}
          </div>

          {/* Tracks + clips */}
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 z-20 w-px bg-red-500"
              style={{
                left: currentTime * PIXELS_PER_SECOND,
                height: tracks.length * TRACK_HEIGHT,
              }}
            >
              <div className="-ml-1.5 -mt-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>

            {tracks.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-gray-800/50 bg-gray-950/50"
                style={{ height: TRACK_HEIGHT }}
              >
                {elements
                  .filter((el) => el.trackId === track.id)
                  .map((el) => {
                    const asset = media.find((m) => m.id === el.mediaId);
                    const selected = selectedElementIds.includes(el.id);
                    return (
                      <div
                        key={el.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectElements(
                            e.shiftKey
                              ? selected
                                ? selectedElementIds.filter((id) => id !== el.id)
                                : [...selectedElementIds, el.id]
                              : [el.id]
                          );
                        }}
                        className={cn(
                          "absolute top-1 flex cursor-pointer items-center overflow-hidden rounded px-1.5 text-[10px] font-medium text-white shadow",
                          track.type === "audio"
                            ? "bg-emerald-700/90"
                            : "bg-blue-600/90",
                          selected && "ring-2 ring-white ring-offset-1 ring-offset-gray-900"
                        )}
                        style={{
                          left: el.startTime * PIXELS_PER_SECOND,
                          width: Math.max(el.duration * PIXELS_PER_SECOND, 8),
                          height: TRACK_HEIGHT - 8,
                        }}
                        title={asset?.name ?? el.name ?? el.id}
                      >
                        <span className="truncate">
                          {asset?.name ?? el.name ?? "Clip"}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
