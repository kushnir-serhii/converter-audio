import { useRef } from "react";

export default function CatalogLoader({ onLoadFromR2, onImportFile, hasCredentials, error }) {
  const inputRef = useRef(null);

  return (
    <div className="rounded-2xl bg-white shadow-sm p-6 flex flex-col items-center gap-4 text-center">
      <div className="text-3xl">📚</div>
      <p className="text-zinc-700 font-medium">Load the current catalog to get started</p>
      <p className="text-zinc-500 text-sm max-w-sm">
        The tool keeps the loaded catalog as a backup in memory before any changes are written.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          onClick={onLoadFromR2}
          disabled={!hasCredentials}
          title={!hasCredentials ? "Enter R2 credentials above first" : undefined}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          Load from R2
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Import file…
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
