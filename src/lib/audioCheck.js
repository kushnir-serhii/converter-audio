import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg } from "./ffmpeg.js";
import { parseAstatsRmsLevel, parseAstatsPeakLevel, parseLoudnormMeasuredI } from "./audioAnalysis.js";

export { parseAstatsRmsLevel, parseAstatsPeakLevel, parseLoudnormMeasuredI };

// §5.1 — edge/loudness pre-upload check, per AUDIO_PREP_GUIDE.md targets.
export const CATEGORY_TARGETS = {
  master: { type: "lufs", value: -16 },
  nature: { type: "lufs", value: -20 },
  frequency: { type: "lufs", value: -20 },
  chimes: { type: "peak", value: -3 },
};

const EDGE_WINDOW_SEC = 1;
const SILENCE_THRESHOLD_DB = -50;
const MISMATCH_THRESHOLD_DB = 3;
const LOUDNESS_TOLERANCE_LU = 2;
const CLIP_THRESHOLD_DB = -0.1;

async function runAndCollectLog(ff, args) {
  const lines = [];
  const handler = ({ message }) => lines.push(message);
  ff.on("log", handler);
  try {
    await ff.exec(args);
  } finally {
    ff.off("log", handler);
  }
  return lines.join("\n");
}

async function probeDuration(ff, inputName) {
  const log = await runAndCollectLog(ff, ["-i", inputName]);
  const match = log.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

async function measureWindowRms(ff, inputName, start, dur) {
  const args = ["-ss", String(start), "-t", String(dur), "-i", inputName, "-af", "astats=metadata=0", "-f", "null", "-"];
  const log = await runAndCollectLog(ff, args);
  return parseAstatsRmsLevel(log);
}

async function measureOverall(ff, inputName) {
  const log = await runAndCollectLog(ff, ["-i", inputName, "-af", "astats=metadata=0", "-f", "null", "-"]);
  return { rms: parseAstatsRmsLevel(log), peak: parseAstatsPeakLevel(log) };
}

async function measureLoudness(ff, inputName) {
  const log = await runAndCollectLog(ff, [
    "-i",
    inputName,
    "-af",
    "loudnorm=print_format=json",
    "-f",
    "null",
    "-",
  ]);
  return parseLoudnormMeasuredI(log);
}

/**
 * Runs ffmpeg.wasm astats/loudnorm analysis on a sound file and returns the
 * findings described in §5.1. Never a hard block — callers decide what to
 * show the user per finding.
 */
export async function checkAudio(file, category) {
  const ff = await loadFFmpeg();
  const inputName = "check-input" + (file.name.match(/\.[^./]+$/)?.[0] || ".m4a");
  await ff.writeFile(inputName, await fetchFile(file));

  try {
    const duration = await probeDuration(ff, inputName);
    const { rms: overallRms, peak } = await measureOverall(ff, inputName);
    const target = CATEGORY_TARGETS[category];
    const findings = [];

    if (duration && duration > EDGE_WINDOW_SEC * 2) {
      const [startRms, endRms] = await Promise.all([
        measureWindowRms(ff, inputName, 0, EDGE_WINDOW_SEC),
        measureWindowRms(ff, inputName, Math.max(0, duration - EDGE_WINDOW_SEC), EDGE_WINDOW_SEC),
      ]);

      if (startRms !== null && startRms <= SILENCE_THRESHOLD_DB) {
        findings.push({ type: "edge-silence-start", message: `Near-silence at the start (${startRms.toFixed(1)} dB RMS) — likely a baked-in fade/silence.` });
      }
      if (endRms !== null && endRms <= SILENCE_THRESHOLD_DB) {
        findings.push({ type: "edge-silence-end", message: `Near-silence at the end (${endRms.toFixed(1)} dB RMS) — likely a baked-in fade/silence.` });
      }
      if (
        startRms !== null &&
        endRms !== null &&
        Number.isFinite(startRms) &&
        Number.isFinite(endRms) &&
        Math.abs(startRms - endRms) > MISMATCH_THRESHOLD_DB
      ) {
        findings.push({
          type: "edge-mismatch",
          message: `Start↔end level mismatch: ${startRms.toFixed(1)} dB vs ${endRms.toFixed(1)} dB (> ${MISMATCH_THRESHOLD_DB} dB) — will sound like a step on every loop.`,
        });
      }
    }

    if (peak !== null && peak >= CLIP_THRESHOLD_DB) {
      findings.push({ type: "clipping", message: `Peak level is ${peak.toFixed(1)} dB — clipping risk.` });
    }

    if (target) {
      if (target.type === "peak") {
        if (peak !== null && Math.abs(peak - target.value) > LOUDNESS_TOLERANCE_LU) {
          findings.push({
            type: "loudness",
            message: `Peak is ${peak.toFixed(1)} dB, target for ${category} is ${target.value} dB.`,
          });
        }
      } else {
        const measured = await measureLoudness(ff, inputName);
        if (measured !== null && Math.abs(measured - target.value) > LOUDNESS_TOLERANCE_LU) {
          findings.push({
            type: "loudness",
            message: `Measured loudness is ${measured.toFixed(1)} LUFS, target for ${category} is ${target.value} LUFS.`,
          });
        }
      }
    }

    return { findings, overallRms, peak, duration };
  } finally {
    await ff.deleteFile(inputName).catch(() => {});
  }
}

/**
 * Applies the offered fix: trims near-silent/faded edges, then loudness- or
 * peak-normalizes to the category target. Returns a new Blob to re-check.
 */
export async function applyAudioFix(file, category, mimeType = "audio/mp4") {
  const ff = await loadFFmpeg();
  const ext = file.name.match(/\.[^./]+$/)?.[0] || ".m4a";
  const inputName = "fix-input" + ext;
  const outputName = "fix-output" + ext;
  await ff.writeFile(inputName, await fetchFile(file));

  const target = CATEGORY_TARGETS[category];
  const filters = [
    `silenceremove=start_periods=1:start_threshold=${SILENCE_THRESHOLD_DB}dB:start_silence=0.05:stop_periods=1:stop_threshold=${SILENCE_THRESHOLD_DB}dB:stop_silence=0.05`,
  ];
  if (target?.type === "lufs") {
    filters.push(`loudnorm=I=${target.value}:TP=-1:LRA=11`);
  } else if (target?.type === "peak") {
    filters.push(`speechnorm=p=1:t=${target.value}dB`);
  }

  try {
    await ff.exec(["-i", inputName, "-af", filters.join(","), "-c:a", "aac", "-b:a", "192k", outputName]);
    const data = await ff.readFile(outputName);
    return new Blob([data.buffer], { type: mimeType });
  } finally {
    await ff.deleteFile(inputName).catch(() => {});
    await ff.deleteFile(outputName).catch(() => {});
  }
}
