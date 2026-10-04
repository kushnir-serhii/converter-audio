import {
  SIZE_WARN_BYTES,
  describeEstimate,
  formatClock,
} from "../../lib/videoFormats.js";

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** "1920×1080 · 1:24 · 48.2 MB" — whichever parts we actually know. */
function describeSource(file, info) {
  const parts = [];
  if (info && info.width && info.height) parts.push(`${info.width}×${info.height}`);
  if (info && info.durationSec) parts.push(formatClock(info.durationSec));
  parts.push(humanSize(file.size));
  return parts.join(" · ");
}

export default function VideoFileRow({
  row,
  operationId,
  onRemove,
  onDownload,
  onSendToCatalog,
}) {
  const { file, status, progress, error, outputName, resultBlob, info } = row;
  const removeDisabled = status === "converting";
  const canSendToCatalog =
    status === "done" && outputName && outputName.toLowerCase().endsWith(".m4a");

  const estimate =
    status === "queued" && info && info.durationSec
      ? describeEstimate(operationId, info.durationSec)
      : null;

  const heavy = status === "queued" && file.size > SIZE_WARN_BYTES;

  const savings =
    status === "done" && resultBlob && file.size > 0
      ? Math.round((1 - resultBlob.size / file.size) * 100)
      : null;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-100 last:border-b-0">
      <span className="text-lg shrink-0">▶</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">{file.name}</p>
        <p className="text-xs text-zinc-500">{describeSource(file, info)}</p>

        {status === "queued" && (
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-zinc-300" />
            Ready{estimate ? ` — ${estimate}` : ""}
          </p>
        )}

        {heavy && (
          <p className="text-xs text-amber-600 mt-1">
            Large file — the browser engine keeps it all in memory. If it fails, use a
            shorter clip.
          </p>
        )}

        {status === "converting" && (
          <div className="mt-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">{Math.round(progress * 100)}%</p>
          </div>
        )}

        {status === "done" && (
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            ✓ Done{resultBlob ? ` — ${humanSize(resultBlob.size)}` : ""}
            {savings !== null && savings > 0 ? ` (${savings}% smaller)` : ""}
          </p>
        )}

        {status === "error" && <p className="text-xs text-red-600 mt-1">✕ {error}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canSendToCatalog && onSendToCatalog && (
          <button
            onClick={() => onSendToCatalog(row)}
            className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Send to catalog
          </button>
        )}
        {status === "done" && (
          <button
            onClick={() => onDownload(row)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Download
          </button>
        )}
        <button
          onClick={() => onRemove(row.id)}
          disabled={removeDisabled}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
