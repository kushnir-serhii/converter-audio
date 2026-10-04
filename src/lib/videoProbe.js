/**
 * Reads duration and dimensions from a video file using a detached
 * <video> element.
 *
 * Why not ffprobe: the wasm build has no ffprobe binary, and running an ffmpeg
 * pass purely to read metadata would mean loading the whole file into wasm
 * memory before the user has even chosen an operation. The browser's own
 * demuxer already knows this, costs nothing, and answers in milliseconds.
 *
 * The trade-off is codec coverage: a container the browser cannot play (some
 * MKV/AVI) resolves with nulls instead of throwing. Callers must treat every
 * field as optional — the conversion itself still works, we just cannot show
 * an estimate for it.
 */

const PROBE_TIMEOUT_MS = 8000;

export function probeVideo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ durationSec: null, width: null, height: null, playable: false }),
      PROBE_TIMEOUT_MS
    );

    video.preload = "metadata";
    video.muted = true;

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      finish({
        durationSec: duration,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        playable: true,
      });
    };

    video.onerror = () =>
      finish({ durationSec: null, width: null, height: null, playable: false });

    video.src = url;
  });
}
