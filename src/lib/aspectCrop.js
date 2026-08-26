/**
 * Output aspect-ratio presets and the "cover fit" math used to place a
 * scene photo (any resolution) into a chosen output canvas without
 * distorting it — the same idea as CSS `object-fit: cover`, which is how
 * the live portfolio cards already render these images.
 */

export const ASPECT_PRESETS = [
  { id: "portfolio", label: "Portfolio card — 628 × 500", w: 628, h: 500 },
  { id: "square", label: "Square — 1:1", w: 1000, h: 1000 },
  { id: "wide", label: "Wide — 16:9", w: 1600, h: 900 },
  { id: "tall", label: "Story — 9:16", w: 900, h: 1600 },
  { id: "custom", label: "Custom", w: null, h: null },
];

export function getPreset(id) {
  return ASPECT_PRESETS.find((p) => p.id === id) ?? ASPECT_PRESETS[0];
}

/** Resolves the id/custom-size pair the UI tracks into concrete output pixels. */
export function resolveOutputSize(presetId, customW, customH) {
  const preset = getPreset(presetId);
  if (preset.id !== "custom") return { w: preset.w, h: preset.h };
  const w = Math.round(Number(customW));
  const h = Math.round(Number(customH));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16) {
    throw new Error("Custom size needs both width and height, at least 16px each.");
  }
  return { w, h };
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

/**
 * Computes the scale + offset that fits `srcW`×`srcH` to fully *cover* a
 * `dstW`×`dstH` box (scales up/down, never letterboxes) — matching CSS
 * `object-fit: cover`. `focus` (0..1 on each axis) nudges which part of the
 * overflow is kept; {x:0.5,y:0.5} is centered, the default.
 */
export function coverTransform(srcW, srcH, dstW, dstH, focus = { x: 0.5, y: 0.5 }) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const scaledW = srcW * scale;
  const scaledH = srcH * scale;
  const offsetX = -(scaledW - dstW) * clamp01(focus.x);
  const offsetY = -(scaledH - dstH) * clamp01(focus.y);
  return { scale, offsetX, offsetY };
}

/**
 * Export scale multipliers. A portfolio card rendered at 628x500 is a 1x
 * asset; on a HiDPI ("retina") display the browser has two device pixels for
 * every CSS pixel, so a 1x image is upscaled and looks soft no matter how
 * cleanly it was produced. Shipping 2x and letting the page display it at the
 * same CSS size is the cheapest real gain in apparent sharpness — and unlike
 * sharpening it improves the whole frame, scene photo included.
 */
export const EXPORT_SCALES = [1, 2, 3];

/** Multiplies an output size by an export scale, guarding against bad input. */
export function scaleOutputSize({ w, h }, scale) {
  const s = EXPORT_SCALES.includes(scale) ? scale : 1;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

/** Applies a coverTransform (or any {scale, offsetX, offsetY}) to a point. */
export function applyTransform({ scale, offsetX, offsetY }, x, y) {
  return [x * scale + offsetX, y * scale + offsetY];
}
