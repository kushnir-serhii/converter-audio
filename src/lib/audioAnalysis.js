// Pure ffmpeg-log parsers, split out from audioCheck.js so they're testable
// under Node (audioCheck.js pulls in ffmpeg.js, which instantiates
// FFmpeg() at import time and only runs in a browser).

// astats prints per-channel stats first, then an "Overall" section — take
// whatever comes after the last "Overall" marker so we read the summary,
// not a single channel.
function overallSection(log) {
  const idx = log.lastIndexOf("Overall");
  return idx === -1 ? log : log.slice(idx);
}

export function parseAstatsRmsLevel(log) {
  const match =
    overallSection(log).match(/RMS level dB:\s*(-?[\d.]+|-inf)/i) || log.match(/RMS_level=(-?[\d.]+|-inf)/i);
  if (!match) return null;
  return match[1] === "-inf" ? -Infinity : Number(match[1]);
}

export function parseAstatsPeakLevel(log) {
  const match =
    overallSection(log).match(/Peak level dB:\s*(-?[\d.]+|-inf)/i) || log.match(/Peak_level=(-?[\d.]+|-inf)/i);
  if (!match) return null;
  return match[1] === "-inf" ? -Infinity : Number(match[1]);
}

export function parseLoudnormMeasuredI(log) {
  const match = log.match(/"input_i"\s*:\s*"(-?[\d.]+)"/);
  return match ? Number(match[1]) : null;
}
