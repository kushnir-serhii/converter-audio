import { useState } from "react";
import { useVideoConverter } from "../../hooks/useVideoConverter.js";
import { getOperation, parseClock } from "../../lib/videoFormats.js";
import DropZone from "../DropZone.jsx";
import VideoSettingsBar from "./VideoSettingsBar.jsx";
import VideoFileRow from "./VideoFileRow.jsx";

const DEFAULT_OPTIONS = {
  presetId: "web",
  startText: "",
  endText: "",
  audioBitrate: 192,
  gifSeconds: 5,
  gifWidth: 480,
  gifFps: 12,
};

function triggerDownload(row) {
  const a = document.createElement("a");
  a.href = row.objectUrl;
  a.download = row.outputName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function VideoTab({ onSendToCatalog }) {
  // App renders one shared EngineStatus for every tab, so this hook's own
  // engineState is used only to gate the button, never to render a second banner.
  const {
    files,
    engineState,
    isConverting,
    addFiles,
    removeFile,
    clear,
    convertAll,
  } = useVideoConverter();

  const [operationId, setOperationId] = useState("compress");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [notice, setNotice] = useState("");

  const setOption = (key, value) => setOptions((prev) => ({ ...prev, [key]: value }));

  const handleFiles = (fileList) => {
    const { skippedCount, oversizedCount } = addFiles(fileList);
    const messages = [];
    if (skippedCount > 0) {
      messages.push(
        `Skipped ${skippedCount} file${skippedCount === 1 ? "" : "s"} that ${
          skippedCount === 1 ? "isn't" : "aren't"
        } video.`
      );
    }
    if (oversizedCount > 0) {
      messages.push(
        `Skipped ${oversizedCount} file${
          oversizedCount === 1 ? "" : "s"
        } over 500 MB — too large for the browser engine.`
      );
    }
    if (messages.length > 0) {
      setNotice(messages.join(" "));
      setTimeout(() => setNotice(""), 6000);
    }
  };

  const handleConvert = () => {
    const operation = getOperation(operationId);
    if (!operation) return;

    // Text inputs are parsed here rather than in the operation so a malformed
    // "1:2:3" never reaches ffmpeg as a silently-wrong seek offset.
    const startSec = parseClock(options.startText) ?? 0;
    const endSec = parseClock(options.endText);

    if (options.startText && parseClock(options.startText) === null) {
      setNotice('Start time should look like "0:30" or "30".');
      setTimeout(() => setNotice(""), 5000);
      return;
    }
    if (options.endText && endSec === null) {
      setNotice('End time should look like "1:30" or "90".');
      setTimeout(() => setNotice(""), 5000);
      return;
    }
    if (endSec !== null && endSec <= startSec) {
      setNotice("End time must be after the start time.");
      setTimeout(() => setNotice(""), 5000);
      return;
    }

    convertAll(operationId, { ...options, startSec, endSec });
  };

  return (
    <>
      <DropZone
        compact={files.length > 0}
        onFiles={handleFiles}
        skippedNotice={notice}
        accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi"
        title="Drag & drop video files here"
        formatHint="MP4, MOV, WebM, MKV, AVI · up to 500 MB each"
        addMoreLabel="+ Add more videos"
      />

      <VideoSettingsBar
        operationId={operationId}
        options={options}
        onOperationChange={setOperationId}
        onOptionChange={setOption}
        fileCount={files.length}
        engineReady={engineState === "ready"}
        isConverting={isConverting}
        onConvert={handleConvert}
        onClear={clear}
      />

      {files.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm p-4">
          {files.map((row) => (
            <VideoFileRow
              key={row.id}
              row={row}
              operationId={operationId}
              onRemove={removeFile}
              onDownload={triggerDownload}
              onSendToCatalog={onSendToCatalog}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-400 text-center">
        Heavy jobs — 4K, long clips, batches — belong in the desktop engine. This tab is
        capped by what a browser tab can hold in memory.
      </p>
    </>
  );
}
