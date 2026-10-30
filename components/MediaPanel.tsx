"use client";

import { useEditorStore } from "@/lib/store";
import { defaultElementProps } from "@/lib/types";
import { Upload, Film, Image, Music, Type, Trash2 } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { deleteMediaFile, saveMediaFile } from "@/lib/media-db";

function generateThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const finish = (value?: string) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const draw = (source: CanvasImageSource, width: number, height: number) => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(320 / Math.max(width, 1), 180 / Math.max(height, 1), 1);
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) return finish();
      try {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.68));
      } catch {
        finish();
      }
    };

    if (file.type.startsWith("image/")) {
      const image = new window.Image();
      image.onload = () => draw(image, image.naturalWidth, image.naturalHeight);
      image.onerror = () => finish();
      image.src = url;
      return;
    }
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(0.15, Math.max(0, (video.duration || 1) / 2));
      };
      video.onseeked = () => draw(video, video.videoWidth, video.videoHeight);
      video.onerror = () => finish();
      video.src = url;
      return;
    }
    finish();
  });
}

function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      resolve(5);
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
  const addTextAsset = useEditorStore((s) => s.addTextAsset);
  const removeMedia = useEditorStore((s) => s.removeMedia);
  const addElement = useEditorStore((s) => s.addElement);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeOnTimeline = (
    mediaId: string,
    type: "video" | "audio" | "image" | "text",
    duration: number,
    name: string,
    textExtras?: { text?: string; fontSize?: number; fontColor?: string }
  ) => {
    const track =
      tracks.find((t) => {
        if (type === "audio") return t.type === "audio";
        if (type === "text") return t.type === "text";
        return t.type === "video";
      }) ?? tracks[0];

    if (!track) return;

    const existingOnTrack = useEditorStore
      .getState()
      .elements.filter((e) => e.trackId === track.id);
    const startTime = existingOnTrack.reduce(
      (max, e) => Math.max(max, e.startTime + e.duration),
      0
    );

    addElement({
      ...defaultElementProps(),
      mediaId,
      trackId: track.id,
      startTime,
      duration,
      name,
      ...textExtras,
    });
  };

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
      const thumbnail = type === "video" || type === "image"
        ? await generateThumbnail(file)
        : undefined;

      const id = addMedia({
        type,
        name: file.name,
        src,
        duration,
        thumbnail,
        fileSize: file.size,
        mimeType: file.type,
      });

      try {
        await saveMediaFile(id, file);
      } catch (error) {
        console.error("IndexedDB media persistence failed", error);
        alert(`Không thể lưu media để khôi phục sau khi tải lại trang: ${file.name}`);
      }

      placeOnTimeline(id, type, duration, file.name);
    }
  };

  const handleAddText = () => {
    const text = "Nhập chữ tại đây";
    const id = addTextAsset(text);
    placeOnTimeline(id, "text", 5, text, {
      text,
      fontSize: 48,
      fontColor: "#ffffff",
    });
  };

  const iconFor = (type: string) => {
    if (type === "video") return <Film size={14} />;
    if (type === "audio") return <Music size={14} />;
    if (type === "text") return <Type size={14} />;
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
        className="mb-2 flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-gray-600 py-5 text-sm text-gray-400 transition hover:border-blue-500 hover:text-blue-400"
      >
        <Upload size={18} />
        Upload Media
      </button>

      <button
        onClick={handleAddText}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 transition hover:border-amber-500 hover:text-amber-400"
      >
        <Type size={16} />
        Thêm chữ / phụ đề
      </button>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {media.length === 0 && (
          <p className="py-8 text-center text-xs text-gray-600">Chưa có media</p>
        )}
        {media.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-gray-800"
            )}
          >
            <span className="text-gray-500">{iconFor(item.type)}</span>
            <span className="flex-1 truncate text-gray-300">
              {item.type === "text" ? item.text ?? item.name : item.name}
            </span>
            <span className="text-[10px] text-gray-600">
              {item.duration.toFixed(1)}s
            </span>
            <button
              onClick={async () => {
                removeMedia(item.id);
                try { await deleteMediaFile(item.id); } catch (error) { console.error(error); }
              }}
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
