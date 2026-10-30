"use client";

export default function Preview() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="aspect-[9/16] h-full max-h-full w-auto max-w-full rounded-lg bg-gray-800 shadow-2xl">
        <div className="flex h-full items-center justify-center text-gray-500">
          Preview Area
        </div>
      </div>
    </div>
  );
}
