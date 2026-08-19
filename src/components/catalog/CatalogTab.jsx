import { useState } from "react";
import { useCatalog } from "../../hooks/useCatalog.js";
import { CATEGORIES } from "../../lib/catalog.js";
import SettingsPanel from "./SettingsPanel.jsx";
import CatalogLoader from "./CatalogLoader.jsx";
import TrackForm from "./TrackForm.jsx";
import TrackBrowser from "./TrackBrowser.jsx";
import DiffScreen from "./DiffScreen.jsx";
import UploadProgress from "./UploadProgress.jsx";

export default function CatalogTab({ incomingSourceFile, onConsumeSourceFile }) {
  const catalog = useCatalog();
  const [formOpen, setFormOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [queuedIds, setQueuedIds] = useState([]);

  const sourceFile = formOpen && !replaceTarget ? incomingSourceFile : null;

  const openAdd = () => {
    setReplaceTarget(null);
    setFormOpen(true);
  };
  const openReplace = (track) => {
    setReplaceTarget(track);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setReplaceTarget(null);
    if (incomingSourceFile) onConsumeSourceFile?.();
  };

  const handleSubmitTrack = (entry, uploadItems, linkedKeys) => {
    catalog.addOrReplaceTrack(entry, uploadItems, linkedKeys);
    setQueuedIds((prev) => (prev.includes(entry.id) ? prev : [...prev, entry.id]));
    closeForm();
  };

  if (catalog.step === "load") {
    return (
      <div className="flex flex-col gap-4">
        <SettingsPanel credentials={catalog.credentials} onChange={catalog.setCredentials} />
        <CatalogLoader
          onLoadFromR2={catalog.loadFromR2}
          onImportFile={catalog.importFile}
          hasCredentials={catalog.hasCredentials}
          error={catalog.error}
        />
      </div>
    );
  }

  if (catalog.step === "diff") {
    return (
      <DiffScreen
        diff={catalog.diff}
        validation={catalog.validation}
        oldVersion={catalog.source.oldVersion}
        newVersion={catalog.version}
        uploadKeys={[...catalog.pendingUploads.keys()]}
        onConfirm={catalog.confirmUpload}
        onBack={catalog.backToWork}
        error={catalog.error}
      />
    );
  }

  if (catalog.step === "uploading" || catalog.step === "done") {
    return (
      <UploadProgress status={catalog.uploadStatus} done={catalog.step === "done"} onDone={catalog.reset} />
    );
  }

  // step === "work"
  return (
    <div className="flex flex-col gap-4">
      <SettingsPanel credentials={catalog.credentials} onChange={catalog.setCredentials} />

      <div className="rounded-2xl bg-white shadow-sm p-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Category:
          <select
            value={catalog.category}
            onChange={(e) => catalog.setCategory(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          Version:
          <input
            type="number"
            value={catalog.version}
            onChange={(e) => catalog.setSessionVersion(Number(e.target.value))}
            className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <span className="text-xs text-zinc-400">loaded v{catalog.source.oldVersion}</span>
        <div className="flex-1" />
        <button onClick={openAdd} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
          + Add track
        </button>
      </div>

      {formOpen && (
        <TrackForm
          category={replaceTarget ? replaceTarget.category : catalog.category}
          tracks={catalog.workingTracks}
          version={catalog.version}
          existingTrack={replaceTarget}
          initialSourceFile={sourceFile}
          onSubmit={handleSubmitTrack}
          onCancel={closeForm}
        />
      )}

      <TrackBrowser tracks={catalog.workingTracks} onPickReplace={openReplace} />

      {queuedIds.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm p-4">
          <p className="text-sm text-zinc-600 mb-1">Queued this session: {queuedIds.join(", ")}</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={catalog.goToDiff}
          disabled={queuedIds.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Review & upload
        </button>
      </div>
    </div>
  );
}
