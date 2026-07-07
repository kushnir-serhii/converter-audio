# UI Specification

Single-page app, one screen, no routing. Target: someone who has never heard of
ffmpeg. Everything below is v1 scope.

## Layout (top to bottom)

```
┌──────────────────────────────────────────────────────┐
│  🎵 Audio Converter                                   │
│  Convert audio files right in your browser.           │
│  Your files never leave your device.                  │
├──────────────────────────────────────────────────────┤
│  [EngineStatus banner — only while engine loads/fails]│
├──────────────────────────────────────────────────────┤
│  ┌ DropZone ─────────────────────────────────────┐   │
│  │        ⬇  Drag & drop audio files here        │   │
│  │           or  [ Browse files ]                │   │
│  │     MP3, M4A/AAC, WAV, OGG, FLAC · multiple OK │   │
│  └───────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────┤
│  SettingsBar:                                         │
│  Convert to: [ AAC (.m4a) ▾ ]  Quality: [ 192 kbps ▾ ]│
│                       [ Convert N files ]  [ Clear ]  │
├──────────────────────────────────────────────────────┤
│  FileList (one FileRow per file):                     │
│  ♪ song-one.mp3      4.2 MB   ████████░░ 80%          │
│  ♪ song-two.mp3      3.1 MB   ✓ Done      [Download]  │
│  ♪ broken.mp3        1.0 MB   ✕ Failed — not a valid  │
│                               audio file   [Remove]   │
│                                     [ Download all ]  │
└──────────────────────────────────────────────────────┘
```

## Components

### EngineStatus
- While ffmpeg core is loading: slim banner "Loading converter engine… (one-time,
  ~30 MB)" with an indeterminate progress bar.
- On load failure: red banner "Couldn't load the converter engine. Check your
  connection and refresh." with a Retry button.
- Hidden once loaded. Convert button is disabled (with tooltip/label
  "Engine loading…") until the engine is ready — but users CAN add files and
  pick settings while it loads.

### DropZone
- Large rounded dashed-border area; entire area clickable → opens file picker
  (`<input type="file" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac">`).
- Dragover state: border/background highlight.
- Adding files appends to the existing queue (doesn't replace it). Duplicate
  file (same name + size) is skipped silently.
- Non-audio files dropped: reject with a small inline notice
  "Skipped 2 files that aren't audio." (filter by extension/MIME).
- After the queue has items, the DropZone shrinks to a compact strip
  ("+ Add more files") to give the list room.

### SettingsBar
- **Convert to** select — options from `formats.js`: AAC (.m4a) *default*,
  MP3, WAV, OGG, FLAC.
- **Quality** select — bitrate options depend on chosen format
  (see 04-conversion-spec.md). Hidden entirely for lossless formats (WAV, FLAC).
- **Convert** primary button, label "Convert N file(s)". Disabled when: queue
  empty, engine not loaded, or conversion already running (then shows
  "Converting…").
- **Clear** secondary button — removes all files (confirm not needed; it's
  non-destructive to the originals). Disabled mid-conversion.
- Changing settings after a conversion resets rows in `done`/`error` back to
  `queued` visual? **No** — keep results; new settings only apply to the next
  Convert run, which re-converts every non-`done` row. Simpler rule for v1:
  **Convert always (re)converts ALL rows in the list** with current settings,
  overwriting previous results. Document this in a tooltip.

### FileRow states
| state       | visual                                                        |
|-------------|---------------------------------------------------------------|
| `queued`    | filename, human size (e.g. "4.2 MB"), grey dot "Ready"        |
| `converting`| determinate progress bar + percent                            |
| `done`      | green check, output size ("→ 2.9 MB"), **Download** button     |
| `error`     | red ✕ + short friendly message (see 04 §Error handling), Remove|
- Every row has a small ✕/Remove control (disabled for the row currently converting).

### Download all
- Appears under the list when ≥ 2 rows are `done`.
- Triggers each row's download sequentially (~300 ms apart).

## Visual style (Tailwind v4)

- Clean, centered, max-width ~`max-w-2xl`, generous whitespace.
- Neutral background (`bg-zinc-50`), white cards with `rounded-2xl shadow-sm`.
- One accent color for primary actions (indigo or violet). Green = success,
  red = error only.
- System font stack is fine. No component library needed; plain Tailwind.
- Must look fine on mobile (single column already; ensure controls wrap).
- Dark mode: nice-to-have, NOT required for v1.

## Copy rules

- Never show raw ffmpeg output/errors to the user (log them to console instead).
- Say "AAC (.m4a)" not "aac codec in mp4 container".
- Footer line: "Powered by ffmpeg.wasm · Files are processed locally and never uploaded."
