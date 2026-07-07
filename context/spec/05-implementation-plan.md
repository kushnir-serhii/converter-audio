# Implementation Plan (ordered steps)

Work through the steps in order; each has acceptance criteria. Read
`02-architecture.md`, `03-ui-spec.md`, `04-conversion-spec.md` before starting.

## Step 0 — Preconditions

- Node.js 20+ available (`node -v`).
- Repo currently contains only `.gitignore` and `context/`. Scaffold in place —
  do NOT create a nested subfolder for the app.

## Step 1 — Scaffold Vite + React + Tailwind v4

1. Create `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`,
   `src/index.css` (`@import "tailwindcss";`), `src/App.jsx` (placeholder).
   Use the exact dependency versions from `02-architecture.md`.
2. `npm install`.
3. ✅ Accept: `npm run dev` serves a styled placeholder page (Tailwind class
   visibly applied, e.g. colored heading).

## Step 2 — ffmpeg engine module

1. Implement `src/lib/ffmpeg.js` per `02-architecture.md` (singleton, local
   core via `?url` imports + `toBlobURL`, `loadFFmpeg`, `convertFile` with
   progress callback and FS cleanup).
2. Implement `src/lib/formats.js` per `04-conversion-spec.md`.
3. Temporary smoke test: on app mount, load engine and log `ffmpeg.loaded`.
4. ✅ Accept: dev console shows engine loaded, no worker 404s. Also verify once
   with `npm run build && npm run preview` (bundled worker paths differ!).

## Step 3 — Queue state (`src/hooks/useConverter.js`)

State: `files: [{ id, file, status, progress, resultBlob, outputName, error }]`,
`engineState: 'loading'|'ready'|'error'`, `isConverting`.

API: `addFiles(FileList)` (dedupe by name+size, filter by INPUT_EXTENSIONS),
`removeFile(id)`, `clear()`, `convertAll(formatId, bitrate)` — sequential loop,
per-row try/catch, errors don't stop the batch (see `04-conversion-spec.md`).

✅ Accept: hook logic drives a barebones unstyled list correctly end-to-end
(add → convert → blob present / error captured).

## Step 4 — UI components

Build per `03-ui-spec.md`: `EngineStatus`, `DropZone` (drag & drop + picker +
compact mode), `SettingsBar` (format select, bitrate select hidden for
lossless, Convert/Clear buttons with disabled rules), `FileList`/`FileRow`
(4 states, progress bar, Download button, Remove), "Download all".

✅ Accept: full happy path in the browser — drop 3 MP3s, Convert to AAC 192k,
watch sequential progress, download all three `.m4a` files, they play.

## Step 5 — Edge cases & polish

- Fake audio file (renamed .txt) → friendly row error, batch continues.
- Object URL revocation on remove/clear.
- Duplicate output-name suffixing.
- Mobile layout check (~375 px wide).
- Header + privacy footer copy from `03-ui-spec.md`.

✅ Accept: verification checklist in `04-conversion-spec.md` §Verification
passes fully, in BOTH `npm run dev` and `npm run preview` builds.

## Step 6 — Deploy readiness (optional in v1, cheap to include)

- Add `base: "/converter-audio/"` note in README for GitHub Pages, or leave
  base as `/` for Vercel/Netlify.
- Write a short `README.md`: what it is, `npm install`, `npm run dev`,
  `npm run build`, deploy hint.
- ✅ Accept: `npm run build` output in `dist/` opens and works via `npm run preview`.

## Explicitly out of scope (do not build)

TypeScript migration, tests beyond the manual checklist, dark mode, ZIP
downloads, per-file settings, video support, PWA/offline caching, i18n.

## Notes for the implementing model

- The two highest-risk items are (a) the ffmpeg worker path under Vite and
  (b) prod-vs-dev asset resolution. Both are addressed in `02-architecture.md`
  — follow it literally before improvising, and test `preview` early (Step 2),
  not at the end.
- Keep components dumb; all conversion/queue logic lives in the hook and `lib/`.
- Commit after each step with a clear message.
