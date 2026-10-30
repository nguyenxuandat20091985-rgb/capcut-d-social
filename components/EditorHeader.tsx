"use client";

import { useEditorStore } from "@/lib/store";
import { exportProject, DEFAULT_EXPORT_OPTIONS } from "@/lib/exporter";
import { Download, Play, Pause, Undo2, Redo2 } from "lucide-react";
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

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    try {
      await exportProject(
        {
          project,
          media,
          tracks,
          elements,
          options: DEFAULT_EXPORT_OPTIONS,
        },
        setProgress
      );
      // Placeholder: real export would trigger download
      alert("Export complete (placeholder). Wire FFmpeg.wasm for real output.");
    } finally {
      setExporting(false);
      setProgress(0);
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
          className="ml-2 flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          <Download size={14} />
          {exporting ? `Exporting ${progress}%` : "Export"}
        </button>
      </div>
    </header>
  );
}
