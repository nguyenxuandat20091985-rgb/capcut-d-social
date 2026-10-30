"use client";

export default function Timeline() {
  return (
    <div className="flex h-full flex-col p-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
        <span>Timeline</span>
        <span className="ml-auto">00:00 / 00:00</span>
      </div>
      <div className="flex-1 overflow-x-auto rounded bg-gray-950">
        <div className="flex h-full min-w-full items-center justify-center text-sm text-gray-600">
          Drag media here to start editing
        </div>
      </div>
    </div>
  );
}
