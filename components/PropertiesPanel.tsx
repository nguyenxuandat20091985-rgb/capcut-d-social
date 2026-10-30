"use client";

import { useEditorStore } from "@/lib/store";
import type { AspectRatio } from "@/lib/types";

const ASPECT_OPTIONS: AspectRatio[] = ["9:16", "16:9", "1:1", "4:5"];

export default function PropertiesPanel() {
  const selected = useEditorStore((s) => s.getSelectedElements());
  const project = useEditorStore((s) => s.project);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);
  const setBackgroundColor = useEditorStore((s) => s.setBackgroundColor);
  const updateElement = useEditorStore((s) => s.updateElement);
  const media = useEditorStore((s) => s.media);

  if (selected.length === 0) {
    return (
      <div className="flex h-full flex-col p-3">
        <h2 className="mb-3 text-sm font-medium text-gray-300">Project</h2>

        <label className="mb-1 text-xs text-gray-500">Aspect ratio</label>
        <div className="mb-4 flex flex-wrap gap-1">
          {ASPECT_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setAspectRatio(r)}
              className={`rounded px-2 py-1 text-xs ${
                project.aspectRatio === r
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <label className="mb-1 text-xs text-gray-500">Background</label>
        <input
          type="color"
          value={project.backgroundColor}
          onChange={(e) => setBackgroundColor(e.target.value)}
          className="mb-4 h-8 w-full cursor-pointer rounded border-0 bg-transparent"
        />

        <p className="mt-auto text-center text-xs text-gray-600">
          Select a clip to edit properties
        </p>
      </div>
    );
  }

  const el = selected[0];
  const asset = media.find((m) => m.id === el.mediaId);
  const isText = asset?.type === "text";

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <h2 className="mb-1 text-sm font-medium text-gray-300">Properties</h2>
      <p className="mb-3 truncate text-xs text-gray-500">
        {isText
          ? el.text ?? asset?.text ?? "Text"
          : asset?.name ?? el.name ?? el.id}
        {selected.length > 1 && ` (+${selected.length - 1})`}
      </p>

      {isText && (
        <>
          <Field label="Text content">
            <textarea
              rows={3}
              value={el.text ?? asset?.text ?? ""}
              onChange={(e) => updateElement(el.id, { text: e.target.value })}
              className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>

          <Field label={`Font size (${el.fontSize ?? asset?.fontSize ?? 48}px)`}>
            <input
              type="range"
              min={12}
              max={120}
              step={1}
              value={el.fontSize ?? asset?.fontSize ?? 48}
              onChange={(e) =>
                updateElement(el.id, { fontSize: parseInt(e.target.value, 10) })
              }
              className="w-full"
            />
          </Field>

          <Field label="Font color">
            <input
              type="color"
              value={el.fontColor ?? asset?.fontColor ?? "#ffffff"}
              onChange={(e) =>
                updateElement(el.id, { fontColor: e.target.value })
              }
              className="h-8 w-full cursor-pointer rounded border-0 bg-transparent"
            />
          </Field>
        </>
      )}

      <Field label="Start (s)">
        <input
          type="number"
          step={0.1}
          min={0}
          value={Number(el.startTime.toFixed(2))}
          onChange={(e) =>
            updateElement(el.id, { startTime: parseFloat(e.target.value) || 0 })
          }
          className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
        />
      </Field>

      <Field label="Duration (s)">
        <input
          type="number"
          step={0.1}
          min={0.1}
          value={Number(el.duration.toFixed(2))}
          onChange={(e) =>
            updateElement(el.id, {
              duration: Math.max(0.1, parseFloat(e.target.value) || 0.1),
            })
          }
          className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
        />
      </Field>

      <Field label={`Opacity (${Math.round(el.opacity * 100)}%)`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={el.opacity}
          onChange={(e) =>
            updateElement(el.id, { opacity: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>

      <Field label={`Scale (${el.scale.toFixed(2)})`}>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.05}
          value={el.scale}
          onChange={(e) =>
            updateElement(el.id, { scale: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>

      <Field label={`Rotation (${el.rotation}°)`}>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={el.rotation}
          onChange={(e) =>
            updateElement(el.id, { rotation: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>

      {!isText && (
        <Field label={`Volume (${Math.round(el.volume * 100)}%)`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={el.volume}
            onChange={(e) =>
              updateElement(el.id, { volume: parseFloat(e.target.value) })
            }
            className="w-full"
          />
        </Field>
      )}

      <Field label="Position X">
        <input
          type="number"
          value={el.x}
          onChange={(e) =>
            updateElement(el.id, { x: parseFloat(e.target.value) || 0 })
          }
          className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
        />
      </Field>

      <Field label="Position Y">
        <input
          type="number"
          value={el.y}
          onChange={(e) =>
            updateElement(el.id, { y: parseFloat(e.target.value) || 0 })
          }
          className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}
