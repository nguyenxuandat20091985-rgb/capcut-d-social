"use client";

import { useEditorStore } from "@/lib/store";
import {
  exportProject,
  downloadBlob,
  DEFAULT_EXPORT_OPTIONS,
  type ExportProgress,
  type ExportPhase,
} from "@/lib/exporter";
import { Download, Play, Pause, Undo2, Redo2, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<ExportPhase, string> = {
  idle: "",
  "loading-core": "Tải FFmpeg core",
  "loading-font": "Tải font tiếng Việt",
  "writing-media": "Ghi media",
  "building-graph": "Dựng filter",
  encoding: "Encode",
  finishing: "Đóng gói",
  done: "Hoàn tất",
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

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({
    phase: "idle",
    percent: 0,
    message: "",
  });

  // Keyboard shortcuts also work from header focus
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const handleExport = useCallback(async () => {
    if (exporting) return;
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
          options: DEFAULT_EXPORT_OPTIONS,
        },
        setProgress,
        (msg) => console.log("[ffmpeg]", msg)
      );

      const safeName =
        project.name.replace(/[^a-z0-9-_\s\u00C0-\u1EF9]/gi, "").trim() ||
        "export";
      downloadBlob(blob, `${safeName}.mp4`);
      setProgress({ phase: "done", percent: 100, message: "Hoàn tất!" });
    } catch (err) {
      console.error(err);
      setProgress({
        phase: "error",
        percent: 0,
        message:
          err instanceof Error ? err.message : "Export thất bại",
      });
      alert(
        `Export failed: ${err instanceof Error ? err.message : String(err)}\n\nTip: dùng Chrome/Edge. Lần đầu tải FFmpeg + font có thể mất vài giây.`
      );
    } finally {
      setExporting(false);
      setTimeout(
        () =>
          setProgress({ phase: "idle", percent: 0, message: "" }),
        4000
      );
    }
  }, [exporting, project, media, tracks, elements]);

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

        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!undoEnabled}
            className={cn(
              "rounded p-1.5 hover:bg-gray-800",
              undoEnabled
                ? "text-gray-300 hover:text-white"
                : "text-gray-700 cursor-not-allowed"
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
              redoEnabled
                ? "text-gray-300 hover:text-white"
                : "text-gray-700 cursor-not-allowed"
            )}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
          </button>

          <button
            onClick={() => setPlaying(!isPlaying)}
            className="ml-2 flex items-center gap-1.5 rounded-md bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? "Pause" : "Play"}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="ml-2 flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {exporting ? `${progress.percent}%` : "Export MP4"}
          </button>
        </div>
      </header>

      {/* Detailed progress bar */}
      {exporting || progress.phase === "done" || progress.phase === "error" ? (
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
          <div className="mt-1.5 flex gap-1">
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
      ) : null}
    </div>
  );
}
