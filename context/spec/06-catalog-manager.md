# 06 — Catalog Manager (ALMA catalog.json for Cloudflare R2)

- **Status:** Draft (v1)
- **Date:** 2026-07-18
- **Extends:** 01-overview (this is the first feature beyond plain conversion)
- **Consumer:** the ALMA app's remote media catalog
  (`alma/src/api/mediaCatalog.ts` Zod schema; bucket behind `alma.calmisu.com`,
  WAF header `X-Alma-Client` on `/sounds/*`)

## 1. What we are building

A new "Catalog" mode in the converter: after (or instead of) converting audio, the
user assembles/updates ALMA's `catalog.json` and uploads both the files and the
catalog to Cloudflare R2 — without hand-editing JSON or the R2 dashboard.

Decisions locked with the owner (2026-07-18):

| Question | Decision |
| --- | --- |
| Upload | The tool uploads to R2 itself (S3 API, user's keys); local export stays as fallback |
| Track metadata (titles en/es/uk, etc.) | Entered manually in the UI when adding |
| Replace mode | Same `id`, `sound` bumped to a new `_vN` filename; the old R2 object is never touched (device caches key off the basename) |
| Categories | Use the catalog's real categories: `master`, `nature`, `frequency`, `chimes` (no renaming; ALMA app unchanged) |
| `gradientKey` | **Dropped** — the tool never writes it (see §7 ALMA-side note) |
| `image` | Optional per track; image filename independently editable, same `_vN` auto-versioning as sound |
| `isPro` | Editable per track; **default `true` for `master`**, `false` for all other categories |

## 2. Core workflow

```
[Load current catalog] → [pick category] → [add/replace tracks] → [review diff] → [upload]
```

### 2.1 Load the previous catalog (owner requirement)

- **Primary:** "Load from R2" — S3 `GetObject catalog.json` with the stored keys.
- **Fallback:** "Import file…" — pick a local `catalog.json`.
- On every successful load the tool keeps the untouched original in memory as the
  **backup**; before any upload it (a) triggers a local download of
  `catalog.backup.v<oldVersion>.<timestamp>.json` and (b) uploads the same backup
  object to R2 next to the catalog. Restoring = re-uploading a backup file via the
  same Import flow.

### 2.2 Add a track (default mode)

1. Select **category** (`master` / `nature` / `frequency` / `chimes`). The sound key
   folder is derived from existing entries of that category in the loaded catalog
   (e.g. `nature` → `sounds/nature/`); if the category has no entries yet, fall back
   to a built-in map.
2. Pick the source file — either a result of the converter's own batch (post-convert
   "Send to catalog" button on each converted file) or any local file.
3. **Main name** (owner requirement): auto-suggested from the source filename
   (kebab-case, no extension, no `_vN`), freely editable. It becomes both the track
   `id` and the basename: `<mainName>_v<version>.m4a`.
4. **Version** (owner requirement): one number selected once per session (defaults to
   `catalog.version + 1`). It is appended to every new/replaced filename (`_vN`) and
   written to `catalog.json`'s top-level `version` on export — always consistent.
5. Metadata form: titles (en/es/uk — all three required), optional descriptions and
   `styleLabels` (shown only for categories that use them in the loaded catalog),
   `isPro` (defaulted per §1), `order` (auto = max(order in category) + 1, editable).
6. Optional **image**, two distinct modes per track (a small select next to the
   track row):
   - **Upload image:** pick a file; image name auto-suggested from main name,
     independently editable; stored as `images/<imageName>_v<version>.<ext>`
     (folder derived from existing entries the same way as sounds) and included
     in the upload set.
   - **Link by name (owner requirement):** open the PC file picker, but take ONLY
     the selected file's name — nothing is read or uploaded. The name (prefixed
     with the category's image folder) is written into the entry's `image` key
     as-is, no `_vN` appended — for images that already exist in R2 under their
     final names. Validation warns (not blocks) that the referenced key cannot be
     verified from the browser.

### 2.3 Replace a track

- Pick an existing entry from the loaded catalog (searchable list, grouped by
  category). The form opens pre-filled.
- New sound (and/or image) file → filename becomes `<mainName>_v<version>.<ext>`
  with the session version; the entry's `sound`/`image` keys update; `id`, `order`,
  titles stay unless edited.
- The previous R2 object is left in place (older app installs keep working off
  their cached catalog).

### 2.4 Review & upload

- **Diff screen before anything is written:** added / changed / unchanged entries,
  old vs new `version`, and the exact list of objects to upload. Nothing uploads
  without an explicit confirm.
- Upload order (matters — the catalog must never reference a missing object):
  1. backup catalog object, 2. all sound/image files, 3. `catalog.json` last.
- Per-object progress + retry; a failed file upload aborts before the catalog step.

## 3. R2 access (browser-only constraint)

No backend exists (01-overview non-goal stands). Upload goes straight from the
browser via the S3-compatible API with **AWS SigV4-signed `fetch`** requests:

- Credentials: R2 Account ID, Access Key ID, Secret — entered once in a Settings
  panel, kept in `localStorage` only (this is a personal tool; the page stays a
  static site and the keys never leave the device — consistent with the project's
  privacy stance).
- **One-time bucket setup:** an R2 CORS rule allowing `GET,PUT` from the tool's
  origin (and `localhost:5173` for dev). Document the exact JSON in the README.
- Signing: a tiny SigV4 implementation via WebCrypto (`crypto.subtle`) — no AWS SDK
  dependency needed for GET/PUT of small objects.
- Fallback "Export locally": writes the new `catalog.json` + renamed files as
  downloads for manual dashboard upload (works with zero setup).

## 4. Validation (runs before the diff screen)

- `id` unique across the catalog; `order` unique within its category.
- Every `sound`/`image` key referenced by a new/changed entry is in the upload set.
- New `version` > loaded `version`.
- Filenames match `^[a-z0-9-]+_v\d+\.(m4a|webp|png|jpg)$`.
- Sound files are AAC/m4a (re-offer conversion if the user picked a wav/mp3).

## 5. Suggested extras (owner asked for ideas) — build in this order

1. **Edge & loudness check with offered fix (high value):** run each sound through
   ffmpeg.wasm `astats` before upload and check the ALMA prep rules
   (`alma/tools/audio-pipeline/AUDIO_PREP_GUIDE.md`): baked fades / silence at loop
   edges (the calming-rain defect), start↔end level mismatch > 3 dB, clipping,
   loudness far from the category target (−16 LUFS master / −20 ambient / −3 dB
   peak chimes). Each finding shows a dialog: **"Fix" or "Keep as is"** — Fix
   applies the corresponding ffmpeg.wasm processing in place (trim faded/silent
   edges to the steady-level region; loudness-normalize to the category target)
   and re-runs the check so the user sees the result. Never a hard block.
2. **Session persistence:** remember credentials, last category, last version in
   `localStorage`; "resume where I left off".
3. **Catalog browser:** read-only table of the whole catalog with per-category
   counts, order gaps, isPro totals — cheap sanity view.
4. **Delete/retire mode (later):** remove an entry from the catalog (file stays in
   R2); needs its own confirm + backup, keep out of v1.

(A `durationSec` catalog field was considered and **rejected** 2026-07-18: ALMA
already probes durations on device once the file is cached, and a value written at
catalog time can drift from the actually-queued file — e.g. the on-device loop-bake
changes the playable file's length. On-device probing stays the single source of
truth.)

## 6. Implementation plan

1. **Catalog core (no network):** catalog load/parse/validate module + Zod-like
   schema in `src/lib/catalog.js`; version/rename helpers (`_vN` math); unit-test
   the pure parts (add Vitest — the project has no test runner yet).
2. **UI:** new "Catalog" tab alongside the converter; category picker, add/replace
   forms, diff screen. Reuse DropZone/FileRow patterns; Tailwind v4.
3. **R2 client:** SigV4 signer + GET/PUT wrapper + Settings panel + CORS README
   section. "Export locally" fallback ships in the same step.
4. **Converter integration:** "Send to catalog" on converted files; enforce m4a.
5. **Extras** §5.1 and §5.2 (astats checks + durationSec), then §5.3–5.4.

## 7. ALMA-side follow-ups (separate, in the alma repo)

- `mediaCatalog.ts`: **remove `gradientKey` outright** (schema + its consumers). No
  optional-field compatibility phase needed — the owner is currently the only user
  of the app, so there are no old installs with cached catalogs to protect. Do this
  in the alma repo before the first gradientKey-less catalog upload, or the app's
  Zod parse will reject it.
- Nothing else changes: categories, paths, `_vN` convention and the WAF header all
  stay as-is.
