"use client";

import { useEditorStore } from "@/lib/store";
import type { AspectRatio, TransitionType } from "@/lib/types";
import { useEditorStore as editorStore } from "@/lib/store";

const ASPECT_OPTIONS: AspectRatio[] = ["9:16", "16:9", "1:1", "4:5"];

const FILTER_PRESETS = [
  { label: "Gốc", values: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0 } },
  { label: "Rực rỡ", values: { brightness: 1.05, contrast: 1.15, saturation: 1.35, hue: 0, blur: 0 } },
  { label: "Ấm", values: { brightness: 1.04, contrast: 1.04, saturation: 1.12, hue: -8, blur: 0 } },
  { label: "Lạnh", values: { brightness: 1.02, contrast: 1.08, saturation: 1.05, hue: 12, blur: 0 } },
  { label: "Đen trắng", values: { brightness: 1.02, contrast: 1.1, saturation: 0, hue: 0, blur: 0 } },
  { label: "Mềm", values: { brightness: 1.05, contrast: 0.9, saturation: 0.85, hue: 0, blur: 1.2 } },
];

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
  const currentTime = useEditorStore((s) => s.currentTime);
  const seek = useEditorStore((s) => s.seek);

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
  const isImage = asset?.type === "image";
  const isAudio = asset?.type === "audio";
  const isVisual = isText || isVideo || isImage;
  const keyframes = el.keyframes ?? [];
  const localTime = Math.max(0, Math.min(el.duration, currentTime - el.startTime));
  const playheadInsideClip = currentTime >= el.startTime && currentTime <= el.startTime + el.duration;
  const addKeyframe = () => {
    const frame = {
      time: Number(localTime.toFixed(2)),
      x: el.x ?? 0,
      y: el.y ?? 0,
      scale: el.scale ?? 1,
    };
    const next = [...keyframes.filter((item) => Math.abs(item.time - frame.time) > 0.04), frame]
      .sort((a, b) => a.time - b.time);
    updateElement(el.id, { keyframes: next });
  };

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

      {(isVideo || isImage) && (
        <>
          <Section title="Màu sắc & bộ lọc" />
          <div className="mb-3 flex flex-wrap gap-1">
            {FILTER_PRESETS.map((preset) => (
              <button key={preset.label} type="button" onClick={() => updateElement(el.id, preset.values)}
                className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-[10px] text-gray-300 hover:border-blue-500 hover:text-white">
                {preset.label}
              </button>
            ))}
          </div>
          <Field label={`Độ sáng (${Math.round((el.brightness ?? 1) * 100)}%)`}>
            <input type="range" min={0} max={2} step={0.01} value={el.brightness ?? 1}
              onChange={(e) => updateElement(el.id, { brightness: parseFloat(e.target.value) })} className="w-full" />
          </Field>
          <Field label={`Tương phản (${Math.round((el.contrast ?? 1) * 100)}%)`}>
            <input type="range" min={0.5} max={2} step={0.01} value={el.contrast ?? 1}
              onChange={(e) => updateElement(el.id, { contrast: parseFloat(e.target.value) })} className="w-full" />
          </Field>
          <Field label={`Độ bão hòa (${Math.round((el.saturation ?? 1) * 100)}%)`}>
            <input type="range" min={0} max={3} step={0.01} value={el.saturation ?? 1}
              onChange={(e) => updateElement(el.id, { saturation: parseFloat(e.target.value) })} className="w-full" />
          </Field>
          <Field label={`Tông màu (${Math.round(el.hue ?? 0)}°)`}>
            <input type="range" min={-180} max={180} step={1} value={el.hue ?? 0}
              onChange={(e) => updateElement(el.id, { hue: parseFloat(e.target.value) })} className="w-full" />
          </Field>
          <Field label={`Làm mờ (${(el.blur ?? 0).toFixed(1)} px)`}>
            <input type="range" min={0} max={12} step={0.1} value={el.blur ?? 0}
              onChange={(e) => updateElement(el.id, { blur: parseFloat(e.target.value) })} className="w-full" />
          </Field>
        </>
      )}

      {(isVideo || isAudio) && (
        <>
          <Section title="Tốc độ" />
          <Field label={`Playback speed (${(el.speed ?? 1).toFixed(2)}×)`}>
            <input type="range" min={0.5} max={2} step={0.05} value={el.speed ?? 1}
              onChange={(e) => updateElement(el.id, { speed: parseFloat(e.target.value) })}
              className="w-full" />
          </Field>
          <div className="mb-3 flex justify-between text-[10px] text-gray-600"><span>0.5× Chậm</span><span>1×</span><span>2× Nhanh</span></div>
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

      <Field label="Position X (% canvas)">
        <Num value={el.x ?? 0} min={-100} max={100} onChange={(v) => updateElement(el.id, { x: v })} />
      </Field>
      <Field label="Position Y (% canvas)">
        <Num value={el.y ?? 0} min={-100} max={100} onChange={(v) => updateElement(el.id, { y: v })} />
      </Field>

      {isVisual && (
        <>
          <Section title="Motion keyframes" />
          <button type="button" disabled={!playheadInsideClip}
            onClick={addKeyframe}
            className="mb-2 w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
            + Keyframe tại {localTime.toFixed(2)}s
          </button>
          {keyframes.length === 0 ? (
            <p className="mb-2 text-[10px] text-gray-600">Đặt keyframe ở các thời điểm khác nhau để tạo chuyển động vị trí và phóng to/thu nhỏ.</p>
          ) : (
            <div className="mb-2 space-y-1">
              {[...keyframes].sort((a, b) => a.time - b.time).map((frame) => (
                <div key={frame.time} className="flex items-center gap-2 rounded bg-gray-900 px-2 py-1.5">
                  <button type="button" onClick={() => seek(el.startTime + frame.time)}
                    className="flex-1 text-left text-[10px] text-blue-300 hover:text-blue-200">
                    ◆ {frame.time.toFixed(2)}s · X {frame.x.toFixed(0)}% · Y {frame.y.toFixed(0)}% · {frame.scale.toFixed(2)}×
                  </button>
                  <button type="button" aria-label={`Xóa keyframe ${frame.time.toFixed(2)}s`}
                    onClick={() => updateElement(el.id, { keyframes: keyframes.filter((item) => item.time !== frame.time) })}
                    className="rounded px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-800 hover:text-red-400">×</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
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
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      step={0.1}
      min={min}
      max={max}
      value={Number(value.toFixed(2))}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-full rounded bg-gray-800 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}
