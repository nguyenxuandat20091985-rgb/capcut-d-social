"use client";

import { useEditorStore } from "@/lib/store";
import { defaultElementProps } from "@/lib/types";
import { Upload, Film, Image, Music, Type, Trash2, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { deleteMediaFile, saveMediaFile } from "@/lib/media-db";

type LibraryTab = "media" | "music";

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
    const el = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 5;
      resolve(duration);
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
  const elements = useEditorStore((s) => s.elements);
  const currentTime = useEditorStore((s) => s.currentTime);
  const addMedia = useEditorStore((s) => s.addMedia);
  const addTextAsset = useEditorStore((s) => s.addTextAsset);
  const removeMedia = useEditorStore((s) => s.removeMedia);
  const addElement = useEditorStore((s) => s.addElement);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<LibraryTab>("media");

  const placeOnTimeline = (
    mediaId: string,
    type: "video" | "audio" | "image" | "text",
    duration: number,
    name: string,
    textExtras?: { text?: string; fontSize?: number; fontColor?: string },
    preferredStart?: number
  ) => {
    const track = tracks.find((t) => t.type === (type === "audio" ? "audio" : type === "text" ? "text" : "video")) ?? tracks[0];
    if (!track) return;
    const existingOnTrack = elements.filter((e) => e.trackId === track.id);
    const endTime = existingOnTrack.reduce((max, e) => Math.max(max, e.startTime + e.duration), 0);
    const startTime = preferredStart === undefined ? endTime : Math.max(0, preferredStart);
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
      if (!type || (activeTab === "music" && type !== "audio")) continue;

      const src = URL.createObjectURL(file);
      const duration = await getMediaDuration(file);
      const thumbnail = type === "video" || type === "image" ? await generateThumbnail(file) : undefined;
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

      // In the Music tab, import into the library first. The user chooses
      // exactly when and where the track is placed on the timeline.
      if (activeTab !== "music") placeOnTimeline(id, type, duration, file.name);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAddText = () => {
    const text = "Nhập chữ tại đây";
    const id = addTextAsset(text);
    placeOnTimeline(id, "text", 5, text, { text, fontSize: 48, fontColor: "#ffffff" });
  };

  const addMusicToTimeline = (item: (typeof media)[number]) => {
    const audioTrack = tracks.find((t) => t.type === "audio");
    if (!audioTrack) {
      alert("Chưa có track âm thanh. Vui lòng tạo track Audio trước.");
      return;
    }
    const endTime = elements
      .filter((e) => e.trackId === audioTrack.id)
      .reduce((max, e) => Math.max(max, e.startTime + e.duration), 0);
    placeOnTimeline(item.id, "audio", item.duration, item.name, undefined, Math.max(currentTime, endTime));
  };

  const iconFor = (type: string) => {
    if (type === "video") return <Film size={14} />;
    if (type === "audio") return <Music size={14} />;
    if (type === "text") return <Type size={14} />;
    return <Image size={14} />;
  };

  const visibleMedia = media.filter((item) => activeTab === "music" ? item.type === "audio" : item.type !== "audio");

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Thư viện</h2>
        <span className="text-[10px] text-gray-500">{activeTab === "music" ? "Âm thanh" : "Ảnh & video"}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-gray-950 p-1" role="tablist" aria-label="Thư viện media">
        <button type="button" role="tab" aria-selected={activeTab === "media"} onClick={() => setActiveTab("media")}
          className={cn("rounded-md px-2 py-2 text-xs font-medium", activeTab === "media" ? "bg-gray-700 text-white" : "text-gray-400")}>
          <span className="inline-flex items-center gap-1.5"><Film size={13} /> Media</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "music"} onClick={() => setActiveTab("music")}
          className={cn("rounded-md px-2 py-2 text-xs font-medium", activeTab === "music" ? "bg-gray-700 text-white" : "text-gray-400")}>
          <span className="inline-flex items-center gap-1.5"><Music size={13} /> Kho nhạc</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={activeTab === "music" ? "audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" : "video/*,image/*,audio/*"}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mb-2 flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-gray-600 py-4 text-sm text-gray-300 transition hover:border-blue-500 hover:text-blue-300"
      >
        <Upload size={18} />
        {activeTab === "music" ? "Nhập nhạc từ thiết bị" : "Tải ảnh / video lên"}
      </button>

      {activeTab === "media" && (
        <button type="button" onClick={handleAddText}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 transition hover:border-amber-500 hover:text-amber-400">
          <Type size={16} /> Thêm chữ / phụ đề
        </button>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {visibleMedia.length === 0 && (
          <div className="py-8 text-center text-xs text-gray-500">
            {activeTab === "music" ? "Kho nhạc đang trống. Nhập file âm thanh từ thiết bị để bắt đầu." : "Chưa có ảnh hoặc video"}
          </div>
        )}
        {visibleMedia.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2">
            <div className="flex min-w-0 items-center gap-2">
              {item.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnail} alt="" className="h-10 w-12 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded bg-gray-800 text-gray-400">{iconFor(item.type)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-gray-200">{item.name}</p>
                <p className="text-[10px] text-gray-500">{item.duration.toFixed(1)} giây</p>
              </div>
              <button type="button" aria-label={`Xóa ${item.name}`} onClick={async () => {
                removeMedia(item.id);
                try { await deleteMediaFile(item.id); } catch (error) { console.error(error); }
              }} className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
            {activeTab === "music" && (
              <div className="mt-2 flex items-center gap-2">
                <audio controls preload="none" src={item.src} className="h-8 min-w-0 flex-1" />
                <button type="button" onClick={() => addMusicToTimeline(item)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-2 text-[11px] font-medium text-white hover:bg-blue-500">
                  <Plus size={13} /> Timeline
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {activeTab === "music" && (
        <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
          Kho nhạc lưu các file anh tự nhập trên thiết bị. Chỉ sử dụng nhạc anh có quyền sử dụng khi đăng video.
        </p>
      )}
    </div>
  );
}
