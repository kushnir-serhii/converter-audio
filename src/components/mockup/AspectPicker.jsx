import { EXPORT_SCALES } from "../../lib/aspectCrop.js";

export default function AspectPicker({
  presets,
  presetId,
  onPresetChange,
  customW,
  customH,
  onCustomChange,
  focus,
  onFocusChange,
  exportScale,
  onExportScaleChange,
  sharpen,
  onSharpenChange,
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
      <p className="text-sm font-medium text-zinc-700">Output proportions</p>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onPresetChange(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              presetId === p.id
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {presetId === "custom" && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-zinc-600">
            W
            <input
              type="number"
              min="16"
              value={customW}
              onChange={(e) => onCustomChange(e.target.value, customH)}
              className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <span className="text-zinc-400">×</span>
          <label className="flex items-center gap-1.5 text-sm text-zinc-600">
            H
            <input
              type="number"
              min="16"
              value={customH}
              onChange={(e) => onCustomChange(customW, e.target.value)}
              className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <span className="text-xs text-zinc-400">px</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Crop position — horizontal
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={focus.x}
            onChange={(e) => onFocusChange({ ...focus, x: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Crop position — vertical
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={focus.y}
            onChange={(e) => onFocusChange({ ...focus, y: Number(e.target.value) })}
          />
        </label>
      </div>
      <p className="text-xs text-zinc-400 -mt-1">
        Only matters when the chosen proportions don't match the photo — it picks which part
        of the photo gets kept.
      </p>

      <div className="border-t border-zinc-100 pt-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">Export size</span>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
            {EXPORT_SCALES.map((s) => (
              <button
                key={s}
                onClick={() => onExportScaleChange(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  exportScale === s
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-400 -mt-1.5">
          Re-renders the whole frame — scene photo included — at that many times the pixels.
          On a high-DPI screen a 1x image gets upscaled by the browser and looks soft, so 2x
          is usually the biggest single gain. Capped by your scene photo's own resolution.
        </p>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          <span className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Sharpen screen</span>
            <span className="font-mono">{sharpen.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={sharpen}
            onChange={(e) => onSharpenChange(Number(e.target.value))}
          />
        </label>
        <p className="text-xs text-zinc-400 -mt-1.5">
          Restores edge contrast lost when the screenshot is shrunk onto the screen. It can't
          bring back detail that's gone — past about 1.0 it starts to show halos.
        </p>
      </div>
    </div>
  );
}
