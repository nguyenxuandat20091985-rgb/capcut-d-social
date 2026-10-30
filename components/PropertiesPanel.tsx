"use client";

import { useEditorStore } from "@/lib/store";
import type { AspectRatio, TransitionType } from "@/lib/types";

const ASPECT_OPTIONS: AspectRatio[] = ["9:16", "16:9", "1:1", "4:5"];

const TRANSITIONS: { id: TransitionType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "dissolve", label: "Dissolve" },
  { id: "slide-left", label: "Slide ←" },
  { id: "slide-right", label: "Slide →" },
];

export default function PropertiesPanel() {
  const selected = useEditorStore((s) => s.getSelectedElements());
  const project = useEditorStore((s) => s.project);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);
  const setBackgroundColor = useEditorStore((s) => s.setBackgroundColor);
  const updateElement = useEditorStore((s) => s.updateElement);
  const detachAudio = useEditorStore((s) => s.detachAudio);
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
          Chọn clip để chỉnh thuộc tính
        </p>
      </div>
    );
  }

  const el = selected[0];
  const asset = media.find((m) => m.id === el.mediaId);
  const isText = asset?.type === "text";
  const isVideo = asset?.type === "video";
  const isAudio = asset?.type === "audio";

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <h2 className="mb-1 text-sm font-medium text-gray-300">Properties</h2>
      <p className="mb-3 truncate text-xs text-gray-500">
        {isText
          ? el.text ?? asset?.text ?? "Text"
          : asset?.name ?? el.name ?? el.id}
        {selected.length > 1 && ` (+${selected.length - 1})`}
      </p>

      {isVideo && (
        <button
          onClick={() => detachAudio(el.id)}
          className="mb-3 w-full rounded bg-gray-800 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
        >
          Tách audio (Detach Audio)
        </button>
      )}

      {isText && (
        <>
          <Field label="Nội dung chữ">
            <textarea
              rows={3}
              value={el.text ?? asset?.text ?? ""}
              onChange={(e) => updateElement(el.id, { text: e.target.value })}
              className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>
          <Field label={`Cỡ chữ (${el.fontSize ?? asset?.fontSize ?? 48}px)`}>
            <input
              type="range"
              min={12}
              max={120}
              value={el.fontSize ?? asset?.fontSize ?? 48}
              onChange={(e) =>
                updateElement(el.id, { fontSize: parseInt(e.target.value, 10) })
              }
              className="w-full"
            />
          </Field>
          <Field label="Màu chữ">
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

      <Section title="Thời gian" />
      <Field label="Start (s)">
        <Num
          value={el.startTime}
          onChange={(v) => updateElement(el.id, { startTime: v })}
        />
      </Field>
      <Field label="Duration (s)">
        <Num
          value={el.duration}
          min={0.1}
          onChange={(v) => updateElement(el.id, { duration: Math.max(0.1, v) })}
        />
      </Field>

      <Section title="Fade & Transition" />
      <Field label={`Fade In (${el.fadeIn?.toFixed(1) ?? 0}s)`}>
        <input
          type="range"
          min={0}
          max={3}
          step={0.1}
          value={el.fadeIn ?? 0}
          onChange={(e) =>
            updateElement(el.id, { fadeIn: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>
      <Field label={`Fade Out (${el.fadeOut?.toFixed(1) ?? 0}s)`}>
        <input
          type="range"
          min={0}
          max={3}
          step={0.1}
          value={el.fadeOut ?? 0}
          onChange={(e) =>
            updateElement(el.id, { fadeOut: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>
      <Field label="Transition In">
        <div className="flex flex-wrap gap-1">
          {TRANSITIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => updateElement(el.id, { transitionIn: t.id })}
              className={`rounded px-2 py-0.5 text-[10px] ${
                (el.transitionIn ?? "none") === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      {(el.transitionIn ?? "none") !== "none" && (
        <Field
          label={`Độ dài transition (${(el.transitionDuration ?? 0.5).toFixed(1)}s)`}
        >
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.1}
            value={el.transitionDuration ?? 0.5}
            onChange={(e) =>
              updateElement(el.id, {
                transitionDuration: parseFloat(e.target.value),
              })
            }
            className="w-full"
          />
        </Field>
      )}

      <Section title="Hiển thị" />
      <Field label={`Opacity (${Math.round((el.opacity ?? 1) * 100)}%)`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={el.opacity ?? 1}
          onChange={(e) =>
            updateElement(el.id, { opacity: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>
      <Field label={`Scale (${(el.scale ?? 1).toFixed(2)})`}>
        <input
          type="range"
          min={0.1}
          max={3}
          step={0.05}
          value={el.scale ?? 1}
          onChange={(e) =>
            updateElement(el.id, { scale: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>
      <Field label={`Rotation (${el.rotation ?? 0}°)`}>
        <input
          type="range"
          min={-180}
          max={180}
          value={el.rotation ?? 0}
          onChange={(e) =>
            updateElement(el.id, { rotation: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </Field>

      {(isVideo || isAudio) && (
        <>
          <Section title="Âm thanh" />
          <Field label={`Volume (${Math.round((el.volume ?? 1) * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={el.volume ?? 1}
              onChange={(e) =>
                updateElement(el.id, { volume: parseFloat(e.target.value) })
              }
              className="w-full"
            />
          </Field>
        </>
      )}

      <Field label="Position X">
        <Num value={el.x ?? 0} onChange={(v) => updateElement(el.id, { x: v })} />
      </Field>
      <Field label="Position Y">
        <Num value={el.y ?? 0} onChange={(v) => updateElement(el.id, { y: v })} />
      </Field>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="mb-2 mt-3 border-t border-gray-800 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
      {title}
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

function Num({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <input
      type="number"
      step={0.1}
      min={min}
      value={Number(value.toFixed(2))}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}
