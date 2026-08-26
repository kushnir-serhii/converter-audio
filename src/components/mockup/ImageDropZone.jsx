import { useRef, useState } from "react";

export default function ImageDropZone({ label, hint, thumbnailUrl, onFile }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList) => {
    const file = fileList?.[0];
    if (file) onFile(file);
  };

  const openPicker = () => inputRef.current?.click();

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
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragOver ? "border-indigo-400 bg-indigo-50" : "border-zinc-300 bg-white"
        }`}
      >
        {thumbnailUrl ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={thumbnailUrl}
              alt=""
              className="max-h-28 rounded-lg border border-zinc-200 object-contain"
            />
            <p className="text-zinc-500 text-xs">
              Loaded — click to replace, or{" "}
              <span className="text-indigo-600 font-medium underline underline-offset-2">
                drop a new one
              </span>
            </p>
          </div>
        ) : (
          <>
            <div className="text-2xl mb-1">🖼️</div>
            <p className="text-zinc-700 font-medium text-sm">{label}</p>
            <p className="text-zinc-500 text-xs mt-1">
              or{" "}
              <span className="text-indigo-600 font-medium underline underline-offset-2">
                Browse
              </span>
            </p>
            {hint && <p className="text-zinc-400 text-xs mt-3">{hint}</p>}
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
