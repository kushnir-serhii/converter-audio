const ICONS = { uploading: "…", done: "✓", error: "✕" };
const COLORS = { uploading: "text-indigo-500", done: "text-emerald-600", error: "text-red-600" };

export default function UploadProgress({ status, done, onDone }) {
  const entries = Object.entries(status);

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-3">
      <h3 className="font-medium text-zinc-800">{done ? "Upload complete" : "Uploading…"}</h3>
      <ul className="text-sm font-mono flex flex-col gap-1 max-h-64 overflow-y-auto">
        {entries.map(([key, s]) => (
          <li key={key} className={COLORS[s]}>
            {ICONS[s]} {key}
          </li>
        ))}
      </ul>
      {done && (
        <div className="flex justify-end">
          <button onClick={onDone} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Start a new session
          </button>
        </div>
      )}
    </div>
  );
}
