"use client";

import { useEditorStore } from "@/lib/store";
import { formatTime, cn } from "@/lib/utils";
import { Plus, Volume2, VolumeX, Eye, EyeOff } from "lucide-react";
import { useRef, useCallback, useState } from "react";

const PIXELS_PER_SECOND = 40;
const TRACK_HEIGHT = 48;
const EDGE_HIT = 8; // px for resize handles

type DragMode = "move" | "resize-start" | "resize-end" | null;

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
  const moveElement = useEditorStore((s) => s.moveElement);
  const resizeElement = useEditorStore((s) => s.resizeElement);
  const recalculateDuration = useEditorStore((s) => s.recalculateDuration);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineWidth = Math.max(project.duration * PIXELS_PER_SECOND + 200, 800);

  // Drag state
  const [drag, setDrag] = useState<{
    id: string;
    mode: DragMode;
    startX: number;
    origStart: number;
    origDuration: number;
  } | null>(null);

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (drag) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      seek(x / PIXELS_PER_SECOND);
    },
    [seek, drag]
  );

  const onPointerDownClip = (
    e: React.PointerEvent,
    elId: string,
    startTime: number,
    duration: number
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const localX = e.clientX - rect.left;

    let mode: DragMode = "move";
    if (localX <= EDGE_HIT) mode = "resize-start";
    else if (localX >= rect.width - EDGE_HIT) mode = "resize-end";

    selectElements(
      e.shiftKey
        ? selectedElementIds.includes(elId)
          ? selectedElementIds.filter((id) => id !== elId)
          : [...selectedElementIds, elId]
        : [elId]
    );

    target.setPointerCapture(e.pointerId);
    setDrag({
      id: elId,
      mode,
      startX: e.clientX,
      origStart: startTime,
      origDuration: duration,
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dt = dx / PIXELS_PER_SECOND;

    if (drag.mode === "move") {
      moveElement(drag.id, Math.max(0, drag.origStart + dt));
    } else if (drag.mode === "resize-start") {
      resizeElement(drag.id, "start", drag.origStart + dt);
    } else if (drag.mode === "resize-end") {
      resizeElement(
        drag.id,
        "end",
        drag.origStart + drag.origDuration + dt
      );
    }
  };

  const onPointerUp = () => {
    if (drag) {
      recalculateDuration();
      setDrag(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedElementIds.length) removeElements(selectedElementIds);
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
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-400">Timeline</span>
        <button
          onClick={() => addTrack("video")}
          className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <Plus size={12} /> Video
        </button>
        <button
          onClick={() => addTrack("text")}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <Plus size={12} /> Text
        </button>
        <button
          onClick={() => addTrack("audio")}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <Plus size={12} /> Audio
        </button>
        <span className="text-[10px] text-gray-600">
          Drag = move · Edge = resize · Del · S = split
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

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto">
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

          <div className="relative" style={{ width: timelineWidth }}>
            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 z-20 w-px bg-red-500"
              style={{
                left: currentTime * PIXELS_PER_SECOND,
                height: tracks.length * TRACK_HEIGHT,
              }}
            >
              <div className="-ml-1.5 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
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
                    const isText =
                      asset?.type === "text" || track.type === "text";
                    const isAudio = track.type === "audio";

                    return (
                      <div
                        key={el.id}
                        onPointerDown={(e) =>
                          onPointerDownClip(
                            e,
                            el.id,
                            el.startTime,
                            el.duration
                          )
                        }
                        className={cn(
                          "absolute top-1 flex cursor-grab items-center overflow-hidden rounded px-1.5 text-[10px] font-medium text-white shadow active:cursor-grabbing",
                          isText
                            ? "bg-amber-600/90"
                            : isAudio
                              ? "bg-emerald-700/90"
                              : "bg-blue-600/90",
                          selected &&
                            "ring-2 ring-white ring-offset-1 ring-offset-gray-900",
                          drag?.id === el.id && "opacity-80"
                        )}
                        style={{
                          left: el.startTime * PIXELS_PER_SECOND,
                          width: Math.max(
                            el.duration * PIXELS_PER_SECOND,
                            12
                          ),
                          height: TRACK_HEIGHT - 8,
                        }}
                        title={`${asset?.name ?? el.name ?? "Clip"} · drag to move, edges to resize`}
                      >
                        {/* Resize handles visual */}
                        <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/20" />
                        <span className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/20" />
                        <span className="truncate pl-1">
                          {isText
                            ? el.text ?? asset?.text ?? "Text"
                            : asset?.name ?? el.name ?? "Clip"}
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
