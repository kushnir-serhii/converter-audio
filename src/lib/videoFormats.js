/**
 * Video operations for the browser engine.
 *
 * Everything here runs through the same single-threaded ffmpeg.wasm core the
 * audio tab already loads, so *speed* is the design constraint, not features.
 * Each operation declares how expensive it is:
 *
 *   "copy"   – stream copy, no re-encode. Finishes in about a second.
 *   "fast"   – re-encodes audio only, or writes few frames.
 *   "slow"   – full video re-encode. Budget several times the clip length.
 *
 * Adding an operation means adding an entry to VIDEO_OPERATIONS. The hook only
 * knows how to call `preArgs(options)` / `args(options)`, and the UI only knows
 * how to render the control ids listed in `controls`.
 *
 * Deliberately not here: VP9/WebM. libvpx in a single-threaded wasm build runs
 * roughly an order of magnitude slower than libx264 and would produce a tab
 * that looks frozen. It belongs in the native CLI, or behind WebCodecs.
 */

export const VIDEO_INPUT_EXTENSIONS = [
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
];

/** Browsers keep the whole input and output in wasm memory, which is 32-bit. */
export const SIZE_WARN_BYTES = 200 * 1024 * 1024;
export const SIZE_LIMIT_BYTES = 500 * 1024 * 1024;

export const COMPRESSION_PRESETS = [
  { id: "mobile", label: "Mobile — 480p", height: 480, crf: 30, audioBitrate: 96 },
  { id: "web", label: "Web — 720p", height: 720, crf: 28, audioBitrate: 128 },
  { id: "hd", label: "HD — 1080p", height: 1080, crf: 24, audioBitrate: 160 },
  { id: "original", label: "Keep resolution", height: null, crf: 26, audioBitrate: 128 },
];

export function getCompressionPreset(id) {
  return COMPRESSION_PRESETS.find((p) => p.id === id) || COMPRESSION_PRESETS[1];
}

/**
 * Builds a scale filter, or returns null when no scaling is needed.
 *
 * The target height is compared against the probed height in JS rather than
 * with ffmpeg's own `min(ih\,720)` expression: expression commas have to be
 * backslash-escaped inside a filtergraph, which is a classic source of silent
 * "filter not found" failures. We already know the real height, so we branch here.
 */
export function scaleFilter(info, targetHeight) {
  if (!targetHeight) return null;
  if (!info || !info.height) return `scale=-2:${targetHeight}`;
  if (info.height <= targetHeight) return null; // never upscale
  return `scale=-2:${targetHeight}`;
}

export function extensionOf(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

/** Seconds -> "1:05". Shared by the estimate label and the row metadata. */
export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** Parses "1:05" or "65" or "1:05.5" into seconds. Returns null when unusable. */
export function parseClock(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(:\d{1,2})?(\.\d+)?$/.test(trimmed)) return null;
  const [left, right] = trimmed.split(":");
  if (right === undefined) return Number(left);
  return Number(left) * 60 + Number(right);
}

export const VIDEO_OPERATIONS = [
  {
    id: "compress",
    label: "Compress to MP4",
    speed: "slow",
    hint: "Re-encodes every frame. This is the slow one — budget several times the clip length.",
    controls: ["preset"],
    mimeType: "video/mp4",
    extension: () => ".mp4",
    preArgs: () => [],
    args: ({ presetId, info }) => {
      const preset = getCompressionPreset(presetId);
      const out = [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        String(preset.crf),
        "-pix_fmt",
        "yuv420p",
      ];
      const scale = scaleFilter(info, preset.height);
      if (scale) out.push("-vf", scale);
      out.push("-c:a", "aac", "-b:a", `${preset.audioBitrate}k`);
      // Puts the moov atom first so the result can stream before it fully loads.
      out.push("-movflags", "+faststart");
      return out;
    },
  },
  {
    id: "trim",
    label: "Trim",
    speed: "copy",
    hint: "Stream copy — nothing is re-encoded, so quality is untouched and it finishes in about a second. Cuts snap to the nearest keyframe.",
    controls: ["trim"],
    mimeType: "video/mp4",
    extension: (_opts, file) => extensionOf(file.name) || ".mp4",
    // -ss in front of -i makes ffmpeg seek instead of decoding and discarding.
    preArgs: ({ startSec }) => (startSec > 0 ? ["-ss", String(startSec)] : []),
    args: ({ endSec, startSec }) => {
      const out = [];
      if (Number.isFinite(endSec) && endSec > startSec) {
        out.push("-t", String(endSec - startSec));
      }
      out.push("-c", "copy");
      return out;
    },
  },
  {
    id: "mute",
    label: "Remove audio",
    speed: "copy",
    hint: "Stream copy — drops the audio track and rewrites the container. Near-instant.",
    controls: [],
    mimeType: "video/mp4",
    extension: (_opts, file) => extensionOf(file.name) || ".mp4",
    preArgs: () => [],
    args: () => ["-c", "copy", "-an"],
  },
  {
    id: "extract-audio",
    label: "Extract audio (.m4a)",
    speed: "fast",
    hint: "Only the audio track is re-encoded, so this runs much faster than a video pass.",
    controls: ["audioBitrate"],
    mimeType: "audio/mp4",
    extension: () => ".m4a",
    preArgs: () => [],
    args: ({ audioBitrate }) => ["-vn", "-c:a", "aac", "-b:a", `${audioBitrate}k`],
  },
  {
    id: "gif",
    label: "Convert to GIF",
    speed: "medium",
    hint: "Generates an optimised palette in the same pass. Keep it short — GIF has no inter-frame compression, so long clips get huge.",
    controls: ["gif"],
    mimeType: "image/gif",
    extension: () => ".gif",
    preArgs: ({ startSec }) => (startSec > 0 ? ["-ss", String(startSec)] : []),
    args: ({ gifFps, gifWidth, gifSeconds }) => [
      "-t",
      String(gifSeconds),
      "-vf",
      `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      "-loop",
      "0",
    ],
  },
];

export function getOperation(id) {
  return VIDEO_OPERATIONS.find((op) => op.id === id);
}

/** Rough wall-clock estimate, used only to set expectations before a run. */
const SPEED_FACTORS = { copy: 0, fast: 0.12, medium: 1.5, slow: 8 };

export function estimateSeconds(operationId, durationSec) {
  const op = getOperation(operationId);
  if (!op) return null;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
  const factor = SPEED_FACTORS[op.speed] ?? 1;
  // Even a stream copy pays for reading the file into wasm memory.
  return Math.max(1, Math.round(durationSec * factor));
}

export function describeEstimate(operationId, durationSec) {
  const seconds = estimateSeconds(operationId, durationSec);
  if (seconds === null) return null;
  if (seconds < 5) return "a few seconds";
  if (seconds < 90) return `~${seconds}s`;
  return `~${Math.round(seconds / 60)} min`;
}
