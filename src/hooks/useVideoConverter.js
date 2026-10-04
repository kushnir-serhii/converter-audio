import { useCallback, useEffect, useRef, useState } from "react";
import { loadFFmpeg, convertFile } from "../lib/ffmpeg.js";
import { probeVideo } from "../lib/videoProbe.js";
import {
  VIDEO_INPUT_EXTENSIONS,
  SIZE_LIMIT_BYTES,
  getOperation,
  extensionOf,
} from "../lib/videoFormats.js";

function basename(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? filename : filename.slice(0, idx);
}

/**
 * ffmpeg.wasm is a 32-bit build: input, output and working buffers all share
 * one linear memory that tops out around 2 GB. An out-of-memory abort surfaces
 * as a generic "abort" or a RangeError, so the message has to explain the real
 * cause rather than repeat the exception.
 */
function friendlyError(err) {
  const msg = String(err && err.message ? err.message : err).toLowerCase();
  if (msg.includes("memory") || msg.includes("abort") || msg.includes("range")) {
    return "Ran out of browser memory. Try a shorter clip, a smaller preset, or use the desktop engine.";
  }
  if (msg.includes("conversion failed") || msg.includes("readfile")) {
    return "Couldn't process this file — the codec may not be supported by the browser engine.";
  }
  return "Something went wrong processing this file.";
}

let nextId = 1;

export function useVideoConverter() {
  const [files, setFiles] = useState([]);
  const [engineState, setEngineState] = useState("loading");
  const [isConverting, setIsConverting] = useState(false);
  const filesRef = useRef(files);
  const convertingRef = useRef(false);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // The core is a module-level singleton, so if the audio tab already loaded
  // it this resolves immediately and the user never sees the loading state.
  useEffect(() => {
    let cancelled = false;
    loadFFmpeg()
      .then(() => {
        if (!cancelled) setEngineState("ready");
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setEngineState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retryEngine = useCallback(() => {
    setEngineState("loading");
    loadFFmpeg()
      .then(() => setEngineState("ready"))
      .catch((err) => {
        console.error(err);
        setEngineState("error");
      });
  }, []);

  const updateRow = useCallback((id, patch) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addFiles = useCallback(
    (fileList) => {
      const candidates = Array.from(fileList).filter((file) =>
        VIDEO_INPUT_EXTENSIONS.includes(extensionOf(file.name))
      );
      const skippedCount = fileList.length - candidates.length;

      const accepted = [];
      let oversizedCount = 0;
      for (const file of candidates) {
        if (file.size > SIZE_LIMIT_BYTES) {
          oversizedCount++;
          continue;
        }
        accepted.push(file);
      }

      const queued = [];
      setFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => f.file.name + "|" + f.file.size));
        const newRows = [];
        for (const file of accepted) {
          const key = file.name + "|" + file.size;
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          const row = {
            id: nextId++,
            file,
            status: "queued",
            progress: 0,
            resultBlob: null,
            objectUrl: null,
            outputName: null,
            error: null,
            info: null, // filled in asynchronously by the probe below
          };
          newRows.push(row);
          queued.push(row);
        }
        return [...prev, ...newRows];
      });

      // Probing is fire-and-forget: a row is usable before its metadata lands,
      // the estimate simply appears a moment later.
      for (const row of queued) {
        probeVideo(row.file)
          .then((info) => updateRow(row.id, { info }))
          .catch(() => updateRow(row.id, { info: null }));
      }

      return { skippedCount, oversizedCount };
    },
    [updateRow]
  );

  const removeFile = useCallback((id) => {
    setFiles((prev) => {
      const row = prev.find((f) => f.id === id);
      if (!row || row.status === "converting") return prev;
      if (row.objectUrl) URL.revokeObjectURL(row.objectUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    if (convertingRef.current) return;
    setFiles((prev) => {
      for (const row of prev) {
        if (row.objectUrl) URL.revokeObjectURL(row.objectUrl);
      }
      return [];
    });
  }, []);

  /**
   * Runs every queued file through one operation, one at a time.
   *
   * Sequential on purpose: the wasm core is a single instance with a single
   * MEMFS, so two concurrent runs would fight over the same "input"/"output"
   * filenames and the same memory ceiling.
   */
  const convertAll = useCallback(
    async (operationId, options) => {
      if (convertingRef.current) return;
      const operation = getOperation(operationId);
      if (!operation) return;

      convertingRef.current = true;
      setIsConverting(true);

      const usedNames = new Set();
      let index = 0;

      while (index < filesRef.current.length) {
        const row = filesRef.current[index];
        const id = row.id;
        index++;

        updateRow(id, { status: "converting", progress: 0, error: null });

        try {
          const runOptions = { ...options, info: row.info };
          const extension = operation.extension(runOptions, row.file);
          const outputName = "output" + extension;

          const blob = await convertFile(
            row.file,
            {
              preArgs: operation.preArgs(runOptions),
              args: operation.args(runOptions),
              outputName,
              mimeType: operation.mimeType,
            },
            (progress) => updateRow(id, { progress })
          );

          const base = basename(row.file.name);
          let candidate = base + extension;
          let n = 1;
          while (usedNames.has(candidate)) {
            candidate = `${base} (${n})${extension}`;
            n++;
          }
          usedNames.add(candidate);

          const prevRow = filesRef.current.find((f) => f.id === id);
          if (prevRow && prevRow.objectUrl) URL.revokeObjectURL(prevRow.objectUrl);

          updateRow(id, {
            status: "done",
            progress: 1,
            resultBlob: blob,
            objectUrl: URL.createObjectURL(blob),
            outputName: candidate,
            error: null,
          });
        } catch (err) {
          console.error(err);
          updateRow(id, { status: "error", error: friendlyError(err), progress: 0 });
        }
      }

      convertingRef.current = false;
      setIsConverting(false);
    },
    [updateRow]
  );

  return {
    files,
    engineState,
    isConverting,
    addFiles,
    removeFile,
    clear,
    convertAll,
    retryEngine,
  };
}
