import { useState } from "react";
import {
  slugify,
  nextOrderForCategory,
  defaultIsPro,
  categoryUsesStyleLabels,
  buildSoundKey,
  buildImageKey,
  linkedImageKey,
  isAcceptedSoundFile,
  isAcceptedImageFile,
} from "../../lib/catalog.js";
import { contentTypeFor } from "../../lib/r2.js";
import AudioCheckDialog from "./AudioCheckDialog.jsx";

const LANGS = [
  ["en", "English"],
  ["es", "Español"],
  ["uk", "Українська"],
];

function LocalizedInputs({ label, value, onChange, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-zinc-600">{label}</span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {LANGS.map(([code, name]) => (
          <input
            key={code}
            value={value[code] || ""}
            onChange={(e) => onChange({ ...value, [code]: e.target.value })}
            placeholder={name}
            required={required}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        ))}
      </div>
    </div>
  );
}

function extOf(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
}

export default function TrackForm({ category, tracks, version, existingTrack, initialSourceFile, onSubmit, onCancel }) {
  const mode = existingTrack ? "replace" : "add";
  const usesStyleLabels = categoryUsesStyleLabels(tracks, category);

  const [mainName, setMainName] = useState(
    existingTrack ? existingTrack.id : initialSourceFile ? slugify(initialSourceFile.name) : ""
  );
  const [mainNameTouched, setMainNameTouched] = useState(false);
  const [soundFile, setSoundFile] = useState(initialSourceFile || null);
  const [soundFileChecked, setSoundFileChecked] = useState(false);
  const [titles, setTitles] = useState(existingTrack?.titles || { en: "", es: "", uk: "" });
  const [descriptions, setDescriptions] = useState(existingTrack?.descriptions || { en: "", es: "", uk: "" });
  const [styleLabels, setStyleLabels] = useState(existingTrack?.styleLabels || { en: "", es: "", uk: "" });
  const [isPro, setIsPro] = useState(existingTrack ? existingTrack.isPro : defaultIsPro(category));
  const [order, setOrder] = useState(existingTrack ? existingTrack.order : nextOrderForCategory(tracks, category));

  const [imageMode, setImageMode] = useState(existingTrack?.image ? "keep" : "none");
  const [imageFile, setImageFile] = useState(null);
  const [imageName, setImageName] = useState("");
  const [linkedImageName, setLinkedImageName] = useState("");

  const [formError, setFormError] = useState("");

  const handleSoundFile = (file) => {
    setSoundFile(file);
    setSoundFileChecked(false);
    if (!mainNameTouched) setMainName(slugify(file.name));
  };

  const handleImageUploadFile = (file) => {
    setImageFile(file);
    if (!imageName) setImageName(mainName || slugify(file.name));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    if (!mainName.trim()) return setFormError("Main name is required.");
    if (!titles.en.trim() || !titles.es.trim() || !titles.uk.trim()) {
      return setFormError("Titles in all three languages (en/es/uk) are required.");
    }
    if (mode === "add" && !soundFile) return setFormError("Pick a sound file.");
    if (soundFile && !isAcceptedSoundFile(soundFile.name)) {
      return setFormError("The sound file must be .m4a — convert it in the Convert tab first.");
    }
    if (soundFile && !soundFileChecked) {
      return setFormError("Run the audio check below (or skip it) before submitting.");
    }
    if (imageMode === "upload") {
      if (!imageFile) return setFormError("Pick an image file.");
      if (!isAcceptedImageFile(imageFile.name)) return setFormError("Image must be .webp/.png/.jpg.");
      if (!imageName.trim()) return setFormError("Image name is required.");
    }
    if (imageMode === "link" && !linkedImageName.trim()) {
      return setFormError("Pick a file to read its name from.");
    }

    const uploadItems = [];
    const linkedKeys = [];

    let soundKey = existingTrack?.sound;
    if (soundFile) {
      soundKey = buildSoundKey(tracks, category, mainName.trim(), version);
      uploadItems.push({ key: soundKey, body: soundFile, contentType: contentTypeFor(soundKey) });
    }

    let imageKey;
    if (imageMode === "keep") {
      imageKey = existingTrack?.image;
    } else if (imageMode === "upload") {
      imageKey = buildImageKey(tracks, category, imageName.trim(), version, extOf(imageFile.name));
      uploadItems.push({ key: imageKey, body: imageFile, contentType: contentTypeFor(imageKey) });
    } else if (imageMode === "link") {
      imageKey = linkedImageKey(tracks, category, linkedImageName.trim());
      linkedKeys.push(imageKey);
    }

    const clean = (loc) => (loc.en.trim() ? { en: loc.en.trim(), es: loc.es.trim(), uk: loc.uk.trim() } : undefined);

    const entry = {
      id: existingTrack ? existingTrack.id : mainName.trim(),
      category,
      titles: { en: titles.en.trim(), es: titles.es.trim(), uk: titles.uk.trim() },
      ...(existingTrack?.gradientKey ? { gradientKey: existingTrack.gradientKey } : {}),
      isPro,
      sound: soundKey,
      order: Number(order),
    };
    const desc = clean(descriptions);
    if (desc) entry.descriptions = desc;
    if (usesStyleLabels || (styleLabels.en || "").trim()) {
      const sl = clean(styleLabels);
      if (sl) entry.styleLabels = sl;
    }
    if (imageKey) entry.image = imageKey;

    onSubmit(entry, uploadItems, linkedKeys);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white shadow-sm p-4 flex flex-col gap-4">
      <h3 className="font-medium text-zinc-800">
        {mode === "add" ? "Add track" : `Replace "${existingTrack.id}"`} — {category}
      </h3>

      <label className="flex flex-col gap-1 text-sm text-zinc-600">
        Sound file {mode === "replace" && "(optional — leave empty to keep the current one)"}
        <input
          type="file"
          accept=".m4a,audio/mp4"
          onChange={(e) => e.target.files?.[0] && handleSoundFile(e.target.files[0])}
          className="text-sm"
        />
        {soundFile && <span className="text-xs text-zinc-500">{soundFile.name}</span>}
      </label>

      {soundFile && !soundFileChecked && (
        <AudioCheckDialog
          file={soundFile}
          category={category}
          onDone={(finalFile) => {
            setSoundFile(finalFile);
            setSoundFileChecked(true);
          }}
        />
      )}

      <label className="flex flex-col gap-1 text-sm text-zinc-600">
        Main name {mode === "replace" ? "(used only for a new filename; id stays the same)" : "(becomes the id)"}
        <input
          value={mainName}
          onChange={(e) => {
            setMainName(e.target.value);
            setMainNameTouched(true);
          }}
          disabled={mode === "replace"}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-50 disabled:text-zinc-400"
        />
      </label>

      <LocalizedInputs label="Titles *" value={titles} onChange={setTitles} required />
      <LocalizedInputs label="Descriptions" value={descriptions} onChange={setDescriptions} />
      {(usesStyleLabels || mode === "replace") && (
        <LocalizedInputs label="Style labels" value={styleLabels} onChange={setStyleLabels} />
      )}

      <div className="flex flex-wrap gap-4 items-end">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" checked={isPro} onChange={(e) => setIsPro(e.target.checked)} />
          isPro
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-600">
          Order
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        <span className="text-sm text-zinc-600">Image</span>
        <div className="flex flex-wrap gap-3 text-sm">
          {existingTrack?.image && (
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={imageMode === "keep"} onChange={() => setImageMode("keep")} />
              Keep current ({existingTrack.image})
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={imageMode === "none"} onChange={() => setImageMode("none")} />
            None
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={imageMode === "upload"} onChange={() => setImageMode("upload")} />
            Upload image
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={imageMode === "link"} onChange={() => setImageMode("link")} />
            Link by name
          </label>
        </div>

        {imageMode === "upload" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="file"
              accept=".webp,.png,.jpg,.jpeg,image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUploadFile(e.target.files[0])}
              className="text-sm"
            />
            <input
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              placeholder="image name"
              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}

        {imageMode === "link" && (
          <div className="flex flex-col gap-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setLinkedImageName(f.name);
                e.target.value = "";
              }}
              className="text-sm"
            />
            <span className="text-xs text-zinc-500">
              {linkedImageName ? `Will reference: ${linkedImageName} (name only — nothing is read or uploaded)` : "Pick a file just to read its name"}
            </span>
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={Boolean(soundFile) && !soundFileChecked}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {mode === "add" ? "Add to session" : "Queue replacement"}
        </button>
      </div>
    </form>
  );
}
