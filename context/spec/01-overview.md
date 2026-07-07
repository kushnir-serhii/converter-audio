# Audio Converter — Project Overview

## What we are building

A **browser-based audio converter** with a friendly drag-and-drop UI. All conversion
happens locally in the user's browser via **ffmpeg.wasm** — no backend, no uploads,
no ffmpeg installation required. The app is a static site, so it can be hosted for
free (GitHub Pages, Vercel, Netlify) and shared as a link.

## Primary use case

Convert MP3 files to AAC. Secondary: convert between other common audio formats
(MP3, AAC/M4A, WAV, OGG, FLAC) in any direction.

## Core requirements (agreed with the owner)

1. **Batch conversion** — user can drop multiple files and convert them all in one go.
2. **Settings** — output format dropdown + bitrate/quality selector applied to the batch.
3. **Simple and usable** — the owner has never used ffmpeg; the UI must not expose
   raw ffmpeg concepts. Pick file(s) → choose format → Convert → Download.
4. **Shareable** — deployable as a static site; works for anyone opening the link.
5. **Privacy by design** — files never leave the device (worth stating in the UI,
   it is a selling point).

## Tech stack (decided)

| Concern      | Choice                                   |
|--------------|------------------------------------------|
| UI framework | React 19 + Vite 6                        |
| Styling      | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Conversion   | `@ffmpeg/ffmpeg` 0.12.x + `@ffmpeg/util` + `@ffmpeg/core` (single-threaded core) |
| Language     | JavaScript (JSX). TypeScript optional but not required. |
| Hosting      | Static build (`vite build`) → GitHub Pages or Vercel |

**Why the single-threaded `@ffmpeg/core`:** the multi-threaded core needs
`SharedArrayBuffer`, which requires COOP/COEP headers that GitHub Pages cannot set.
Single-threaded works everywhere. Audio files are small, so speed is acceptable.

## Non-goals (v1)

- No video conversion.
- No server/backend of any kind.
- No accounts, history, or persistence.
- No per-file individual settings (one format+bitrate applies to the whole batch).
- No ZIP download of results (each file downloads individually; "Download all"
  just triggers each download in sequence).

## Spec documents in this folder

1. `01-overview.md` — this file.
2. `02-architecture.md` — project structure, ffmpeg.wasm integration details, pitfalls.
3. `03-ui-spec.md` — screens, components, states, UX copy.
4. `04-conversion-spec.md` — formats, ffmpeg commands, bitrate mapping, error handling.
5. `05-implementation-plan.md` — ordered build steps with acceptance criteria.
