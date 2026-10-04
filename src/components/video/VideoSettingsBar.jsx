import {
  VIDEO_OPERATIONS,
  COMPRESSION_PRESETS,
  getOperation,
} from "../../lib/videoFormats.js";

const SPEED_BADGES = {
  copy: { label: "instant", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  fast: { label: "fast", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  medium: { label: "medium", className: "bg-amber-50 text-amber-700 border-amber-200" },
  slow: { label: "slow", className: "bg-red-50 text-red-700 border-red-200" },
};

const selectClass =
  "rounded-lg border border-zinc-300 px-2 py-1.5 text-sm bg-white disabled:opacity-50";
const inputClass =
  "w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm bg-white disabled:opacity-50";

export default function VideoSettingsBar({
  operationId,
  options,
  onOperationChange,
  onOptionChange,
  fileCount,
  engineReady,
  isConverting,
  onConvert,
  onClear,
}) {
  const operation = getOperation(operationId);
  const controls = operation ? operation.controls : [];
  const badge = operation ? SPEED_BADGES[operation.speed] : null;
  const convertDisabled = fileCount === 0 || !engineReady || isConverting;

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Operation:
          <select
            value={operationId}
            onChange={(e) => onOperationChange(e.target.value)}
            disabled={isConverting}
            className={selectClass}
          >
            {VIDEO_OPERATIONS.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </label>

        {badge && (
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {operation && (
        <p className="text-xs text-zinc-500 -mt-1">{operation.hint}</p>
      )}

      {controls.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center border-t border-zinc-100 pt-3">
          {controls.includes("preset") && (
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              Quality:
              <select
                value={options.presetId}
                onChange={(e) => onOptionChange("presetId", e.target.value)}
                disabled={isConverting}
                className={selectClass}
              >
                {COMPRESSION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {controls.includes("trim") && (
            <>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                From:
                <input
                  type="text"
                  inputMode="numeric"
                  value={options.startText}
                  onChange={(e) => onOptionChange("startText", e.target.value)}
                  disabled={isConverting}
                  placeholder="0:00"
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                To:
                <input
                  type="text"
                  inputMode="numeric"
                  value={options.endText}
                  onChange={(e) => onOptionChange("endText", e.target.value)}
                  disabled={isConverting}
                  placeholder="end"
                  className={inputClass}
                />
              </label>
            </>
          )}

          {controls.includes("audioBitrate") && (
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              Bitrate:
              <select
                value={options.audioBitrate}
                onChange={(e) => onOptionChange("audioBitrate", Number(e.target.value))}
                disabled={isConverting}
                className={selectClass}
              >
                {[96, 128, 192, 256].map((b) => (
                  <option key={b} value={b}>
                    {b} kbps
                  </option>
                ))}
              </select>
            </label>
          )}

          {controls.includes("gif") && (
            <>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                From:
                <input
                  type="text"
                  inputMode="numeric"
                  value={options.startText}
                  onChange={(e) => onOptionChange("startText", e.target.value)}
                  disabled={isConverting}
                  placeholder="0:00"
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                Length:
                <select
                  value={options.gifSeconds}
                  onChange={(e) => onOptionChange("gifSeconds", Number(e.target.value))}
                  disabled={isConverting}
                  className={selectClass}
                >
                  {[3, 5, 10, 15].map((s) => (
                    <option key={s} value={s}>
                      {s}s
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                Width:
                <select
                  value={options.gifWidth}
                  onChange={(e) => onOptionChange("gifWidth", Number(e.target.value))}
                  disabled={isConverting}
                  className={selectClass}
                >
                  {[320, 480, 640].map((w) => (
                    <option key={w} value={w}>
                      {w}px
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                FPS:
                <select
                  value={options.gifFps}
                  onChange={(e) => onOptionChange("gifFps", Number(e.target.value))}
                  disabled={isConverting}
                  className={selectClass}
                >
                  {[8, 12, 15, 24].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClear}
          disabled={isConverting || fileCount === 0}
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Clear
        </button>
        <button
          onClick={onConvert}
          disabled={convertDisabled}
          title={!engineReady ? "Engine loading…" : undefined}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600"
        >
          {isConverting
            ? "Processing…"
            : !engineReady
            ? "Engine loading…"
            : `Process ${fileCount} file${fileCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
