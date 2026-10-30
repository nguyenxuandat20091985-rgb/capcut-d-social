"use client";

import { useEditorStore } from "@/lib/store";
import {
  exportProject,
  downloadBlob,
  DEFAULT_EXPORT_OPTIONS,
  type ExportProgress,
  type ExportPhase,
} from "@/lib/exporter";
import { downloadProjectJson, parseProjectFile } from "@/lib/project-io";
import type { ExportResolution } from "@/lib/types";
import {
  Download,
  Play,
  Pause,
  Undo2,
  Redo2,
  Loader2,
  Save,
  FolderOpen,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<ExportPhase, string> = {
  idle: "",
  "loading-core": "Tải FFmpeg",
  "loading-font": "Tải font VN",
  "writing-media": "Ghi media",
  "building-graph": "Filter graph",
  encoding: "Encode",
  finishing: "Đóng gói",
  done: "Xong",
  error: "Lỗi",
};

export default function EditorHeader() {
  const project = useEditorStore((s) => s.project);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const elements = useEditorStore((s) => s.elements);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const exportProjectFile = useEditorStore((s) => s.exportProjectFile);
  const importProjectFile = useEditorStore((s) => s.importProjectFile);
  const hydrateFromAutosave = useEditorStore((s) => s.hydrateFromAutosave);
  const persistAutosave = useEditorStore((s) => s.persistAutosave);

  const [exporting, setExporting] = useState(false);
  const [resolution, setResolution] = useState<ExportResolution>("1080p");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({
    phase: "idle",
    percent: 0,
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrateFromAutosave();
  }, [hydrateFromAutosave]);

  // Autosave every 15s
  useEffect(() => {
    const id = setInterval(() => persistAutosave(), 15000);
    return () => clearInterval(id);
  }, [persistAutosave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleSave = () => {
    const file = exportProjectFile();
    // include blob srcs for same-browser restore notes in JSON meta only
    downloadProjectJson(file);
    persistAutosave();
  };

  const handleLoad = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = parseProjectFile(text);
      importProjectFile(parsed);
      alert(
        "Đã load project. Lưu ý: media blob URL không có trong file JSON — cần upload lại media nếu đã F5."
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không đọc được file");
    }
  };

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setShowExportMenu(false);
    setExporting(true);
    setProgress({
      phase: "loading-core",
      percent: 0,
      message: "Bắt đầu export…",
    });

    try {
      const blob = await exportProject(
        {
          project,
          media,
          tracks,
          elements,
          options: { ...DEFAULT_EXPORT_OPTIONS, resolution },
        },
        setProgress,
        (msg) => console.log("[ffmpeg]", msg)
      );

      const safeName =
        project.name.replace(/[^a-z0-9-_\s\u00C0-\u1EF9]/gi, "").trim() ||
        "export";
      downloadBlob(blob, `${safeName}-${resolution}.mp4`);
      setProgress({ phase: "done", percent: 100, message: "Hoàn tất!" });
    } catch (err) {
      console.error(err);
      setProgress({
        phase: "error",
        percent: 0,
        message: err instanceof Error ? err.message : "Export thất bại",
      });
      alert(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setExporting(false);
      setTimeout(
        () => setProgress({ phase: "idle", percent: 0, message: "" }),
        4000
      );
    }
  }, [exporting, project, media, tracks, elements, resolution]);

  const undoEnabled = canUndo();
  const redoEnabled = canRedo();

  return (
    <div className="shrink-0">
      <header className="flex h-12 items-center justify-between border-b border-gray-800 bg-gray-950 px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight text-blue-400">
            CapCut D-Social
          </span>
          <span className="text-gray-600">|</span>
          <input
            value={project.name}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent text-sm text-gray-200 outline-none hover:text-white focus:text-white"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={!undoEnabled}
            className={cn(
              "rounded p-1.5 hover:bg-gray-800",
              undoEnabled ? "text-gray-300" : "cursor-not-allowed text-gray-700"
            )}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!redoEnabled}
            className={cn(
              "rounded p-1.5 hover:bg-gray-800",
              redoEnabled ? "text-gray-300" : "cursor-not-allowed text-gray-700"
            )}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>

          <button
            onClick={handleSave}
            className="rounded p-1.5 text-gray-300 hover:bg-gray-800"
            title="Save project JSON (Ctrl+S)"
          >
            <Save size={16} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded p-1.5 text-gray-300 hover:bg-gray-800"
            title="Load project JSON"
          >
            <FolderOpen size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.cds.json"
            className="hidden"
            onChange={(e) => handleLoad(e.target.files)}
          />

          <button
            onClick={() => setPlaying(!isPlaying)}
            className="ml-1 flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "Pause" : "Play"}
          </button>

          <div className="relative ml-1">
            <button
              onClick={() =>
                exporting ? undefined : setShowExportMenu((v) => !v)
              }
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {exporting ? `${progress.percent}%` : "Export"}
            </button>

            {showExportMenu && !exporting && (
              <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-xl">
                <p className="mb-2 text-[10px] uppercase text-gray-500">
                  Độ phân giải
                </p>
                {(["720p", "1080p"] as ExportResolution[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className={cn(
                      "mb-1 w-full rounded px-2 py-1.5 text-left text-xs",
                      resolution === r
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-800"
                    )}
                  >
                    {r} {r === "1080p" ? "(Full HD)" : "(nhanh hơn)"}
                  </button>
                ))}
                <button
                  onClick={handleExport}
                  className="mt-1 w-full rounded bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  Xuất MP4 {resolution}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {(exporting ||
        progress.phase === "done" ||
        progress.phase === "error") && (
        <div className="border-b border-gray-800 bg-gray-900 px-4 py-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span
              className={cn(
                progress.phase === "error"
                  ? "text-red-400"
                  : progress.phase === "done"
                    ? "text-emerald-400"
                    : "text-gray-300"
              )}
            >
              {progress.message || PHASE_LABEL[progress.phase]}
            </span>
            <span className="text-gray-500">{progress.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                progress.phase === "error"
                  ? "bg-red-500"
                  : progress.phase === "done"
                    ? "bg-emerald-500"
                    : "bg-blue-500"
              )}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(
              [
                "loading-core",
                "loading-font",
                "writing-media",
                "building-graph",
                "encoding",
                "finishing",
              ] as ExportPhase[]
            ).map((phase) => {
              const order = [
                "loading-core",
                "loading-font",
                "writing-media",
                "building-graph",
                "encoding",
                "finishing",
                "done",
              ];
              const currentIdx = order.indexOf(progress.phase);
              const phaseIdx = order.indexOf(phase);
              const active = phaseIdx <= currentIdx;
              const current = phase === progress.phase;
              return (
                <span
                  key={phase}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px]",
                    current
                      ? "bg-blue-600 text-white"
                      : active
                        ? "bg-gray-700 text-gray-300"
                        : "bg-gray-800 text-gray-600"
                  )}
                >
                  {PHASE_LABEL[phase]}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
