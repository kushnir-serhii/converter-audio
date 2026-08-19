import { useState } from "react";
import { useConverter } from "./hooks/useConverter.js";
import { getFormat } from "./lib/formats.js";
import EngineStatus from "./components/EngineStatus.jsx";
import DropZone from "./components/DropZone.jsx";
import SettingsBar from "./components/SettingsBar.jsx";
import FileList from "./components/FileList.jsx";
import CatalogTab from "./components/catalog/CatalogTab.jsx";

export default function App() {
  const {
    files,
    engineState,
    isConverting,
    addFiles,
    removeFile,
    clear,
    convertAll,
    retryEngine,
  } = useConverter();

  const [formatId, setFormatId] = useState("aac");
  const [bitrate, setBitrate] = useState(getFormat("aac").defaultBitrate);
  const [skippedNotice, setSkippedNotice] = useState("");
  const [tab, setTab] = useState("convert");
  const [catalogSourceFile, setCatalogSourceFile] = useState(null);

  const sendToCatalog = (row) => {
    const file = new File([row.resultBlob], row.outputName, { type: row.resultBlob.type });
    setCatalogSourceFile(file);
    setTab("catalog");
  };

  const handleFormatChange = (id) => {
    setFormatId(id);
    const format = getFormat(id);
    if (format.defaultBitrate) setBitrate(format.defaultBitrate);
  };

  const handleFiles = (fileList) => {
    const { skippedCount } = addFiles(fileList);
    if (skippedCount > 0) {
      setSkippedNotice(
        `Skipped ${skippedCount} file${skippedCount === 1 ? "" : "s"} that ${
          skippedCount === 1 ? "isn't" : "aren't"
        } audio.`
      );
      setTimeout(() => setSkippedNotice(""), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="mx-auto max-w-2xl flex flex-col gap-4">
        <header className="text-center mb-2">
          <h1 className="text-2xl font-semibold text-zinc-900">🎵 Audio Converter</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Convert audio files right in your browser.
            <br />
            Your files never leave your device.
          </p>
        </header>

        <EngineStatus engineState={engineState} onRetry={retryEngine} />

        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
          {[
            ["convert", "Convert"],
            ["catalog", "Catalog"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "convert" && (
          <>
            <DropZone
              compact={files.length > 0}
              onFiles={handleFiles}
              skippedNotice={skippedNotice}
            />

            <SettingsBar
              formatId={formatId}
              bitrate={bitrate}
              onFormatChange={handleFormatChange}
              onBitrateChange={setBitrate}
              fileCount={files.length}
              engineReady={engineState === "ready"}
              isConverting={isConverting}
              onConvert={() => convertAll(formatId, bitrate)}
              onClear={clear}
            />

            {files.length > 0 && (
              <FileList files={files} onRemove={removeFile} onSendToCatalog={sendToCatalog} />
            )}
          </>
        )}

        {tab === "catalog" && (
          <CatalogTab
            incomingSourceFile={catalogSourceFile}
            onConsumeSourceFile={() => setCatalogSourceFile(null)}
          />
        )}

        <footer className="text-center text-xs text-zinc-400 mt-4">
          Powered by ffmpeg.wasm · Files are processed locally and never uploaded.
        </footer>
      </div>
    </div>
  );
}
