# Architecture & ffmpeg.wasm Integration

## Project structure

```
converter-audio/
├─ index.html
├─ package.json
├─ vite.config.js
├─ context/spec/           # these spec files (do not ship)
└─ src/
   ├─ main.jsx             # React entry, imports index.css
   ├─ index.css            # single line: @import "tailwindcss";
   ├─ App.jsx              # layout shell, wires everything together
   ├─ lib/
   │  ├─ ffmpeg.js         # FFmpeg singleton: load, convert, progress events
   │  └─ formats.js        # format/bitrate definitions (see 04-conversion-spec.md)
   ├─ hooks/
   │  └─ useConverter.js   # state machine for the batch queue (see below)
   └─ components/
      ├─ DropZone.jsx      # drag & drop + file picker
      ├─ SettingsBar.jsx   # format + bitrate selectors
      ├─ FileList.jsx      # queue table
      ├─ FileRow.jsx       # one file: name, size, status, progress, download
      └─ EngineStatus.jsx  # "Loading converter engine…" banner
```

## Dependencies

```json
"dependencies": {
  "@ffmpeg/core": "^0.12.10",
  "@ffmpeg/ffmpeg": "^0.12.15",
  "@ffmpeg/util": "^0.12.2",
  "react": "^19.1.0",
  "react-dom": "^19.1.0"
},
"devDependencies": {
  "@tailwindcss/vite": "^4.1.0",
  "@vitejs/plugin-react": "^4.5.0",
  "tailwindcss": "^4.1.0",
  "vite": "^6.3.5"
}
```

## vite.config.js (required, non-obvious)

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // ffmpeg.wasm spawns a Web Worker internally; Vite pre-bundling
    // breaks the worker's URL resolution. Must be excluded.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});
```

If deploying to GitHub Pages under a repo path, also set
`base: "/converter-audio/"` in this config.

## ffmpeg.wasm integration (`src/lib/ffmpeg.js`)

### Loading

- Create **one** `FFmpeg` instance for the whole app (module-level singleton).
  Loading the ~31 MB wasm core is expensive; never re-create it per file.
- Bundle the core locally instead of a CDN (works offline, no CORS surprises):

```js
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import coreURL from "@ffmpeg/core/dist/esm/ffmpeg-core.js?url";
import wasmURL from "@ffmpeg/core/dist/esm/ffmpeg-core.wasm?url";

const ffmpeg = new FFmpeg();

export async function loadFFmpeg(onLog) {
  if (ffmpeg.loaded) return ffmpeg;
  await ffmpeg.load({
    coreURL: await toBlobURL(coreURL, "text/javascript"),
    wasmURL: await toBlobURL(wasmURL, "application/wasm"),
  });
  return ffmpeg;
}
```

- `toBlobURL` matters: the core JS resolves its wasm path relative to itself,
  and blob URLs sidestep that.
- **Fallback** if the local `?url` import fights the bundler: load from
  `https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js` (and `.wasm`)
  through `toBlobURL`. Ship this only if the local import provably fails.

### Converting one file

```js
import { fetchFile } from "@ffmpeg/util";

export async function convertFile(file, { args, outputName, mimeType }, onProgress) {
  const ff = await loadFFmpeg();
  const inputName = "input" + getExtension(file.name); // sanitize: never use raw user filename
  await ff.writeFile(inputName, await fetchFile(file));
  const handler = ({ progress }) => onProgress(Math.min(1, progress));
  ff.on("progress", handler);
  try {
    const code = await ff.exec(["-i", inputName, ...args, outputName]);
    if (code !== 0) throw new Error("Conversion failed (ffmpeg exit " + code + ")");
    const data = await ff.readFile(outputName);
    return new Blob([data.buffer], { type: mimeType });
  } finally {
    ff.off("progress", handler);
    // Always clean the in-memory FS or batches leak memory
    await ff.deleteFile(inputName).catch(() => {});
    await ff.deleteFile(outputName).catch(() => {});
  }
}
```

### Concurrency model

- The single-threaded core executes **one `exec` at a time**. The batch queue
  must convert files **sequentially** (a simple `for` loop over the queue).
  Do not fire parallel `exec` calls on one instance.

### Known pitfalls (do not skip)

1. `optimizeDeps.exclude` in Vite config — without it the internal worker 404s in dev.
2. Progress events (`progress` field) are 0..1 floats; can occasionally exceed 1
   or jump backwards near the end — clamp to [0, 1].
3. Input filenames: users can have unicode/spaces/emoji in names. Write to the
   virtual FS under a sanitized name (`input.mp3`), keep the display name in React state.
4. Memory: `writeFile`/`readFile` copies live in wasm memory. Delete both files
   after each conversion (see `finally` above). For very large files (>1 GB) the
   32-bit wasm heap can OOM — catch the error and show a friendly message
   (see 04-conversion-spec.md §Error handling).
5. The engine load takes seconds on first visit (~31 MB). Start loading
   **immediately on app mount** (not on first Convert click), and show status.

## Download mechanism

`URL.createObjectURL(blob)` + programmatic `<a download="name.m4a">` click.
Revoke object URLs (`URL.revokeObjectURL`) when a file is removed from the list
or the page resets, to avoid leaking blobs. "Download all" iterates the
completed rows and triggers each download with a ~300 ms delay between clicks
(browsers throttle rapid multi-downloads).

## Output naming

`song.mp3` → `song.m4a` (same basename, new extension). If two queue entries
produce the same output name, append ` (1)`, ` (2)`, … to the download name.
