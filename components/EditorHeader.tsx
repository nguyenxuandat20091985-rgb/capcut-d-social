"use client";

import { useEditorStore } from "@/lib/store";
import {
  exportProject,
  downloadBlob,
  DEFAULT_EXPORT_OPTIONS,
} from "@/lib/exporter";
import { Download, Play, Pause, Undo2, Redo2, Loader2 } from "lucide-react";
import { useState } from "react";

export default function EditorHeader() {
  const project = useEditorStore((s) => s.project);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const elements = useEditorStore((s) => s.elements);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setProgress(0);
    setStatus("Loading FFmpeg…");

    try {
      const blob = await exportProject(
        {
          project,
          media,
          tracks,
          elements,
          options: DEFAULT_EXPORT_OPTIONS,
        },
        (p) => {
          setProgress(p);
          if (p < 10) setStatus("Loading FFmpeg…");
          else if (p < 40) setStatus("Writing media…");
          else if (p < 95) setStatus("Encoding…");
          else setStatus("Finishing…");
        },
        (msg) => console.log("[ffmpeg]", msg)
      );

      const safeName = project.name.replace(/[^a-z0-9-_\s]/gi, "").trim() || "export";
      downloadBlob(blob, `${safeName}.mp4`);
      setStatus("Done!");
    } catch (err) {
      console.error(err);
      setStatus(
        err instanceof Error ? err.message : "Export failed. Check console."
      );
      alert(
        `Export failed: ${err instanceof Error ? err.message : String(err)}\n\nTip: first load of FFmpeg.wasm may take a moment. Use Chrome/Edge for best support.`
      );
    } finally {
      setExporting(false);
      setTimeout(() => setStatus(""), 3000);
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-950 px-4">
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
          className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          title="Undo (coming soon)"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          title="Redo (coming soon)"
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
          {exporting
            ? `${status || "Exporting"} ${progress}%`
            : "Export MP4"}
        </button>
      </div>
    </header>
  );
}
