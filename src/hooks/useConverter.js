import { useCallback, useEffect, useRef, useState } from "react";
import { loadFFmpeg, convertFile } from "../lib/ffmpeg.js";
import { getFormat, INPUT_EXTENSIONS } from "../lib/formats.js";

function getExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

function basename(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? filename : filename.slice(0, idx);
}

function friendlyError(err) {
  const msg = String(err && err.message ? err.message : err).toLowerCase();
  if (msg.includes("memory") || msg.includes("abort")) {
    return "This file is too large to convert in the browser.";
  }
  if (msg.includes("conversion failed") || msg.includes("readfile")) {
    return "Couldn't convert this file — it may be corrupted or not a real audio file.";
  }
  return "Something went wrong converting this file.";
}

let nextId = 1;

export function useConverter() {
  const [files, setFiles] = useState([]);
  const [engineState, setEngineState] = useState("loading");
  const [isConverting, setIsConverting] = useState(false);
  const filesRef = useRef(files);
  const convertingRef = useRef(false);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

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

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList).filter((file) =>
      INPUT_EXTENSIONS.includes(getExtension(file.name))
    );
    const skippedCount = fileList.length - incoming.length;

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => f.file.name + "|" + f.file.size));
      const newRows = [];
      for (const file of incoming) {
        const key = file.name + "|" + file.size;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        newRows.push({
          id: nextId++,
          file,
          status: "queued",
          progress: 0,
          resultBlob: null,
          objectUrl: null,
          outputName: null,
          error: null,
        });
      }
      return [...prev, ...newRows];
    });

    return { skippedCount };
  }, []);

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

  const updateRow = useCallback((id, patch) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const convertAll = useCallback(async (formatId, bitrate) => {
    if (convertingRef.current) return;
    const format = getFormat(formatId);
    if (!format) return;

    convertingRef.current = true;
    setIsConverting(true);

    const usedNames = new Set();
    let index = 0;

    // Iterate by position, not a fixed snapshot: files added mid-run join
    // the end of the current run's queue (see 04-conversion-spec.md).
    while (index < filesRef.current.length) {
      const row = filesRef.current[index];
      const id = row.id;
      index++;

      updateRow(id, { status: "converting", progress: 0, error: null });

      try {
        const args = format.args(bitrate);
        const outputName = "output" + format.extension;
        const blob = await convertFile(
          row.file,
          { args, outputName, mimeType: format.mimeType },
          (progress) => updateRow(id, { progress })
        );

        const base = basename(row.file.name);
        let candidate = base + format.extension;
        let n = 1;
        while (usedNames.has(candidate)) {
          candidate = `${base} (${n})${format.extension}`;
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
  }, [updateRow]);

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
