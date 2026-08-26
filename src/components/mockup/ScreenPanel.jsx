import { CONTENT_FITS } from "../../lib/screen.js";

const BACKING_PRESETS = [
  { id: null, label: "None" },
  { id: "#000000", label: "Black" },
  { id: "#0b0f19", label: "Near-black" },
  { id: "#ffffff", label: "White" },
];

export default function ScreenPanel({
  fit,
  onFitChange,
  notch,
  onNotchChange,
  backing,
  onBackingChange,
  cornerRadius,
  onCornerRadiusChange,
}) {
  const clampRadius = (v) => Math.max(0, Math.min(50, Math.round(Number(v) || 0)));
  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-4">
      <p className="text-sm font-medium text-zinc-700">Screen</p>

      <div className="flex flex-col gap-2">
        <span className="text-sm text-zinc-600">Long screenshots</span>
        <div className="flex flex-wrap gap-2">
          {CONTENT_FITS.map((f) => (
            <button
              key={f.id}
              onClick={() => onFitChange(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                fit === f.id
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-400">
          A full-page capture is far taller than a laptop screen. Fit width keeps the top and
          lets the fold cut the rest, like a real browser; fit whole squeezes the entire page on.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={notch.enabled}
            onChange={(e) => onNotchChange({ ...notch, enabled: e.target.checked })}
          />
          Camera notch shows in front
        </label>
        <p className="text-xs text-zinc-400 -mt-1">
          Leaves a gap at the top centre so the real camera housing in the photo stays visible,
          instead of the screenshot painting over it.
        </p>
        {notch.enabled && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              <span className="flex justify-between">
                Width <span className="font-mono">{Math.round(notch.width * 100)}%</span>
              </span>
              <input
                type="range"
                min="0.02"
                max="0.5"
                step="0.01"
                value={notch.width}
                onChange={(e) => onNotchChange({ ...notch, width: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              <span className="flex justify-between">
                Height <span className="font-mono">{Math.round(notch.height * 100)}%</span>
              </span>
              <input
                type="range"
                min="0.01"
                max="0.25"
                step="0.005"
                value={notch.height}
                onChange={(e) => onNotchChange({ ...notch, height: Number(e.target.value) })}
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        <span className="text-sm text-zinc-600">Behind the screenshot</span>
        <div className="flex flex-wrap items-center gap-2">
          {BACKING_PRESETS.map((b) => (
            <button
              key={b.label}
              onClick={() => onBackingChange(b.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                backing === b.id
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {b.label}
            </button>
          ))}
          <input
            type="color"
            value={backing || "#000000"}
            onChange={(e) => onBackingChange(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white"
            aria-label="Custom backing colour"
          />
        </div>
        <p className="text-xs text-zinc-400">
          Paints the screen out before the screenshot goes on — for photos whose screen is
          bright enough to glow through a dark or partly transparent capture.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        <span className="text-sm text-zinc-600">Corner radius</span>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={cornerRadius}
            onChange={(e) => onCornerRadiusChange(clampRadius(e.target.value))}
            className="flex-1"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="50"
              step="1"
              value={cornerRadius}
              onChange={(e) => onCornerRadiusChange(clampRadius(e.target.value))}
              className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-right font-mono"
              aria-label="Corner radius percent"
            />
            <span className="text-sm text-zinc-400">%</span>
          </div>
        </div>
        <p className="text-xs text-zinc-400">
          Rounds the screenshot's corners to match a rounded screen (most phones). Percentage of
          the screen's shorter side — 0 keeps it square, higher rounds it more, like CSS
          border-radius. Correctly follows the photo's perspective, so it foreshortens into an
          ellipse at an angle instead of staying a perfect circle.
        </p>
      </div>
    </div>
  );
}
