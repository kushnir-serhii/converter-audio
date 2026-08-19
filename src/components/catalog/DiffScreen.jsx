export default function DiffScreen({ diff, validation, oldVersion, newVersion, uploadKeys, onConfirm, onBack, uploading, error }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-4">
      <h3 className="font-medium text-zinc-800">Review changes</h3>

      <p className="text-sm text-zinc-600">
        Version <span className="font-mono">{oldVersion}</span> →{" "}
        <span className="font-mono font-medium">{newVersion}</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <Section title={`Added (${diff.added.length})`} color="text-emerald-600">
          {diff.added.map((t) => (
            <li key={t.id}>{t.id}</li>
          ))}
        </Section>
        <Section title={`Changed (${diff.changed.length})`} color="text-amber-600">
          {diff.changed.map((c) => (
            <li key={c.id}>{c.id}</li>
          ))}
        </Section>
        <Section title={`Unchanged (${diff.unchanged.length})`} color="text-zinc-400">
          <li>{diff.unchanged.length} entries</li>
        </Section>
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-700 mb-1">Objects to upload ({uploadKeys.length})</p>
        <ul className="text-xs text-zinc-500 font-mono max-h-32 overflow-y-auto">
          {uploadKeys.map((k) => (
            <li key={k}>{k}</li>
          ))}
          <li>catalog.json</li>
        </ul>
      </div>

      {validation.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
          {validation.warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
      )}

      {validation.errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
          {validation.errors.map((e, i) => (
            <p key={i}>✕ {e}</p>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={onBack} disabled={uploading} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40">
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!validation.valid || uploading}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {uploading ? "Uploading…" : "Confirm & upload"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div>
      <p className={`font-medium mb-1 ${color}`}>{title}</p>
      <ul className="text-zinc-600 max-h-32 overflow-y-auto">{children}</ul>
    </div>
  );
}
