"use client";

export default function MediaPanel() {
  return (
    <div className="flex h-full flex-col p-3">
      <h2 className="mb-3 text-sm font-medium text-gray-300">Media</h2>
      <div className="mb-3">
        <button className="w-full rounded border border-dashed border-gray-600 py-6 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-300">
          + Upload Media
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <p className="text-center text-xs text-gray-600">No media yet</p>
      </div>
    </div>
  );
}
