import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";

const ffmpeg = new FFmpeg();

if (import.meta.env.DEV) {
  ffmpeg.on("log", ({ message }) => console.debug("[ffmpeg]", message));
}

let loadPromise = null;

export function loadFFmpeg() {
  if (ffmpeg.loaded) return Promise.resolve(ffmpeg);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const [blobCoreURL, blobWasmURL] = await Promise.all([
      toBlobURL(coreURL, "text/javascript"),
      toBlobURL(wasmURL, "application/wasm"),
    ]);
    await ffmpeg.load({ coreURL: blobCoreURL, wasmURL: blobWasmURL });
    return ffmpeg;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

function getExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx);
}

export async function convertFile(file, { args, outputName, mimeType }, onProgress) {
  const ff = await loadFFmpeg();
  const inputName = "input" + getExtension(file.name);
  await ff.writeFile(inputName, await fetchFile(file));
  const handler = ({ progress }) => onProgress(Math.max(0, Math.min(1, progress)));
  ff.on("progress", handler);
  try {
    const code = await ff.exec(["-i", inputName, ...args, outputName]);
    if (code !== 0) throw new Error("Conversion failed (ffmpeg exit " + code + ")");
    const data = await ff.readFile(outputName);
    return new Blob([data.buffer], { type: mimeType });
  } finally {
    ff.off("progress", handler);
    await ff.deleteFile(inputName).catch(() => {});
    await ff.deleteFile(outputName).catch(() => {});
  }
}

export { ffmpeg };
