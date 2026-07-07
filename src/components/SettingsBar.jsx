import { OUTPUT_FORMATS, getFormat } from "../lib/formats.js";

export default function SettingsBar({
  formatId,
  bitrate,
  onFormatChange,
  onBitrateChange,
  fileCount,
  engineReady,
  isConverting,
  onConvert,
  onClear,
}) {
  const format = getFormat(formatId);
  const showBitrate = format && format.bitrates;

  const convertDisabled = fileCount === 0 || !engineReady || isConverting;

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Convert to:
          <select
            value={formatId}
            onChange={(e) => onFormatChange(e.target.value)}
            disabled={isConverting}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm bg-white"
          >
            {OUTPUT_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        {showBitrate && (
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Quality:
            <select
              value={bitrate}
              onChange={(e) => onBitrateChange(Number(e.target.value))}
              disabled={isConverting}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm bg-white"
            >
              {format.bitrates.map((b) => (
                <option key={b} value={b}>
                  {b} kbps
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

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
            ? "Converting…"
            : !engineReady
            ? "Engine loading…"
            : `Convert ${fileCount} file${fileCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
