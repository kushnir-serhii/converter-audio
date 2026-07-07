import { useRef, useState } from "react";

export default function DropZone({ compact, onFiles, skippedNotice }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList) => {
    if (fileList && fileList.length > 0) onFiles(fileList);
  };

  const openPicker = () => inputRef.current?.click();

  const inputEl = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac"
      className="hidden"
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <div>
        <button
          onClick={openPicker}
          className="w-full rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          + Add more files
        </button>
        {inputEl}
        {skippedNotice && (
          <p className="mt-2 text-xs text-zinc-500">{skippedNotice}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver ? "border-indigo-400 bg-indigo-50" : "border-zinc-300 bg-white"
        }`}
      >
        <div className="text-3xl mb-2">⬇</div>
        <p className="text-zinc-700 font-medium">Drag & drop audio files here</p>
        <p className="text-zinc-500 text-sm mt-1">
          or{" "}
          <span className="text-indigo-600 font-medium underline underline-offset-2">
            Browse files
          </span>
        </p>
        <p className="text-zinc-400 text-xs mt-4">
          MP3, M4A/AAC, WAV, OGG, FLAC · multiple OK
        </p>
      </div>
      {inputEl}
      {skippedNotice && (
        <p className="mt-2 text-xs text-zinc-500">{skippedNotice}</p>
      )}
    </div>
  );
}
