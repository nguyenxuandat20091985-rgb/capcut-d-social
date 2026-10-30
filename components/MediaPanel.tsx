"use client";

import { useEditorStore } from "@/lib/store";
import { Upload, Film, Image, Music, Trash2 } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      resolve(5); // default 5s for images on timeline
      return;
    }
    const url = URL.createObjectURL(file);
    const el = document.createElement(
      file.type.startsWith("audio/") ? "audio" : "video"
    );
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve(el.duration || 5);
      URL.revokeObjectURL(url);
    };
    el.onerror = () => {
      resolve(5);
      URL.revokeObjectURL(url);
    };
    el.src = url;
  });
}

export default function MediaPanel() {
  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const addMedia = useEditorStore((s) => s.addMedia);
  const removeMedia = useEditorStore((s) => s.removeMedia);
  const addElement = useEditorStore((s) => s.addElement);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      const type = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : file.type.startsWith("image/")
            ? "image"
            : null;
      if (!type) continue;

      const src = URL.createObjectURL(file);
      const duration = await getMediaDuration(file);

      const id = addMedia({
        type,
        name: file.name,
        src,
        duration,
        fileSize: file.size,
        mimeType: file.type,
      });

      // Auto-add to first matching track
      const track =
        tracks.find((t) =>
          type === "audio" ? t.type === "audio" : t.type === "video"
        ) ?? tracks[0];

      if (track) {
        const existingOnTrack = useEditorStore
          .getState()
          .elements.filter((e) => e.trackId === track.id);
        const startTime = existingOnTrack.reduce(
          (max, e) => Math.max(max, e.startTime + e.duration),
          0
        );

        addElement({
          mediaId: id,
          trackId: track.id,
          startTime,
          duration,
          trimStart: 0,
          trimEnd: 0,
          volume: 1,
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          rotation: 0,
          name: file.name,
        });
      }
    }
  };

  const iconFor = (type: string) => {
    if (type === "video") return <Film size={14} />;
    if (type === "audio") return <Music size={14} />;
    return <Image size={14} />;
  };

  return (
    <div className="flex h-full flex-col p-3">
      <h2 className="mb-3 text-sm font-medium text-gray-300">Media</h2>

      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        onClick={() => inputRef.current?.click()}
        className="mb-3 flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-gray-600 py-6 text-sm text-gray-400 transition hover:border-blue-500 hover:text-blue-400"
      >
        <Upload size={20} />
        Upload Media
      </button>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {media.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-600">No media yet</p>
        )}
        {media.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-gray-800"
            )}
          >
            <span className="text-gray-500">{iconFor(item.type)}</span>
            <span className="flex-1 truncate text-gray-300">{item.name}</span>
            <span className="text-[10px] text-gray-600">
              {item.duration.toFixed(1)}s
            </span>
            <button
              onClick={() => removeMedia(item.id)}
              className="hidden rounded p-0.5 text-gray-500 hover:text-red-400 group-hover:block"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
