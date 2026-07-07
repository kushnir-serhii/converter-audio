# Conversion Specification

Single source of truth: `src/lib/formats.js`. Components must not hard-code
ffmpeg arguments.

## Supported INPUT formats (v1)

MP3, M4A/AAC, WAV, OGG (Vorbis/Opus), FLAC. Accept by extension:
`.mp3 .m4a .aac .wav .ogg .oga .flac`. ffmpeg auto-detects the real format from
content, so a wrong extension usually still works — extensions are only a UI filter.

## Supported OUTPUT formats

| id     | Label       | Extension | ffmpeg args (before output name)      | MIME         | Bitrate options (kbps)        | Default |
|--------|-------------|-----------|----------------------------------------|--------------|-------------------------------|---------|
| `aac`  | AAC (.m4a)  | `.m4a`    | `-c:a aac -b:a {bitrate}k`             | `audio/mp4`  | 96, 128, 192, 256             | 192     |
| `mp3`  | MP3         | `.mp3`    | `-c:a libmp3lame -b:a {bitrate}k`      | `audio/mpeg` | 96, 128, 192, 256, 320        | 192     |
| `ogg`  | OGG Vorbis  | `.ogg`    | `-c:a libvorbis -b:a {bitrate}k`       | `audio/ogg`  | 96, 128, 192, 256             | 192     |
| `wav`  | WAV         | `.wav`    | `-c:a pcm_s16le`                        | `audio/wav`  | — (lossless, hide selector)   | —       |
| `flac` | FLAC        | `.flac`   | `-c:a flac`                             | `audio/flac` | — (lossless, hide selector)   | —       |

Full command per file (input written to virtual FS as `input.<ext>`):

```
-i input.<ext> [format args] -vn output.<outext>
```

- `-vn` strips embedded cover art video streams — without it, files with album
  art can fail or produce odd outputs in some containers.
- The AAC encoder is ffmpeg's built-in `aac` (the wasm core has no libfdk).
  Quality at 192k is fine for this use case.
- Do NOT pass `-map_metadata`; default behavior copies common tags where the
  container supports it, which is good enough for v1.

## Same-format conversion

If input extension == output format (e.g. mp3 → mp3), still convert (user may
want to change bitrate). No special casing.

## `formats.js` shape

```js
export const OUTPUT_FORMATS = [
  {
    id: "aac",
    label: "AAC (.m4a)",
    extension: ".m4a",
    mimeType: "audio/mp4",
    bitrates: [96, 128, 192, 256],   // null for lossless
    defaultBitrate: 192,
    args: (bitrate) => ["-c:a", "aac", "-b:a", `${bitrate}k`, "-vn"],
  },
  // ... mp3, ogg, wav, flac
];
export const INPUT_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".flac"];
```

## Batch queue semantics (`useConverter` hook)

- Files convert **strictly sequentially** (single-threaded wasm core).
- Row status lifecycle: `queued → converting → done | error`.
- One failing file must NOT stop the batch — mark it `error`, continue with the next.
- Pressing Convert while idle: converts every row in the list with current
  settings (re-converting `done` rows too — settings may have changed).
- Adding files mid-conversion: allowed; they join the end of the current run's
  queue if the run is still active, otherwise wait for next Convert.
- Removing the currently-converting row: not allowed (button disabled).

## Error handling (user-facing messages)

| Condition | Detection | Message shown on row |
|---|---|---|
| Corrupt / not really audio | `exec` returns non-zero or `readFile` throws | "Couldn't convert this file — it may be corrupted or not a real audio file." |
| Out of memory (huge file)  | exception containing "memory" / abort | "This file is too large to convert in the browser." |
| Engine failed to load      | `load()` rejects | Banner (see 03-ui-spec.md), not a row error |
| Anything else              | catch-all | "Something went wrong converting this file." |

Always `console.error` the raw error; also attach an ffmpeg `log` listener in
dev and mirror it to `console.debug` — invaluable when debugging codec issues.

## Verification checklist (manual, after implementation)

1. Convert a real MP3 → AAC; play the resulting `.m4a` in Windows Media Player
   or the browser (`<audio>` sanity check is enough).
2. MP3 with embedded album art → AAC succeeds (validates `-vn`).
3. Batch of 3+ files converts sequentially with visible per-row progress.
4. Rename a `.txt` to `.mp3`, add it → row shows friendly error, batch continues.
5. WAV → FLAC and FLAC → MP3 round-trip works.
6. File with spaces + non-ASCII in name converts and downloads with the correct
   output name.
7. `npm run build && npm run preview` — production build works identically
   (worker/wasm paths behave differently in build vs dev; MUST test both).
