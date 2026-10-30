"use client";

import Preview from "./Preview";
import Timeline from "./Timeline";
import MediaPanel from "./MediaPanel";
import PropertiesPanel from "./PropertiesPanel";

export default function Editor() {
  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-gray-800 px-4">
        <h1 className="text-lg font-semibold tracking-tight">CapCut D-Social</h1>
        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-500">
            Export
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Media Panel */}
        <aside className="w-64 border-r border-gray-800 bg-gray-900">
          <MediaPanel />
        </aside>

        {/* Center: Preview + Timeline */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 bg-black">
            <Preview />
          </div>
          <div className="h-48 border-t border-gray-800 bg-gray-900">
            <Timeline />
          </div>
        </div>

        {/* Right: Properties Panel */}
        <aside className="w-72 border-l border-gray-800 bg-gray-900">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}
