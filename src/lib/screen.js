/**
 * How the screenshot sits on the device screen: which part of it is used,
 * what shows through in front of it, and what sits behind it.
 */

export const CONTENT_FITS = [
  { id: "width", label: "Fit width — crop bottom" },
  { id: "whole", label: "Fit whole screenshot" },
];

/**
 * The sub-rectangle of the source screenshot that gets mapped onto the screen.
 *
 * "whole" maps the entire image, which squashes a tall full-page capture into
 * a 16:10 screen. "width" instead keeps the full width and takes only as much
 * height as the screen's aspect allows, cropping the rest off the bottom — the
 * way a real browser shows a long page, with the fold doing the cutting.
 */
export function contentSourceRect(srcW, srcH, screenAspect, fit = "width") {
  const whole = { x: 0, y: 0, w: srcW, h: srcH };
  if (fit !== "width") return whole;
  if (!(screenAspect > 0) || !(srcW > 0) || !(srcH > 0)) return whole;

  const wantedH = srcW / screenAspect;
  // Already shorter than the screen would allow — nothing to crop.
  if (!(wantedH > 0) || wantedH >= srcH) return whole;
  return { x: 0, y: 0, w: srcW, h: wantedH };
}

/**
 * A camera notch / housing at the top centre of the screen, in normalized
 * screen coordinates (0..1 across the screen, 0..1 down it).
 *
 * Real laptops have the camera *in front of* the display, so a composited
 * screenshot that paints straight over it looks wrong. Leaving this region
 * untouched lets the original photo — the actual notch, with its real
 * lighting — show through, which is both correct and free.
 */
export const DEFAULT_NOTCH = { enabled: false, width: 0.14, height: 0.05 };

export function isInNotch(sx, sy, notch) {
  if (!notch || !notch.enabled) return false;
  const halfW = notch.width / 2;
  return sy <= notch.height && Math.abs(sx - 0.5) <= halfW;
}

/**
 * Rounded screen corners.
 *
 * Radius is a percentage of the screen's *shorter* side — the same idea as
 * CSS `border-radius: N%`, but measured against `min(w, h)` rather than each
 * axis separately, so a radius that reads as "nicely rounded" on a narrow
 * phone screen doesn't look barely-there once applied to a wide monitor.
 *
 * The test runs in the same normalized, un-warped screen space as the notch
 * above (against the source rectangle, before the homography), rather than
 * against the warped destination quad. That means a corner that's a true
 * circular arc on the flat screenshot becomes the correct *ellipse* once
 * perspective is applied — exactly like a real rounded screen photographed
 * at an angle — for free, with no extra geometry to warp.
 */
export const DEFAULT_CORNER_RADIUS = 0;

export function isOutsideRoundedCorner(u, v, w, h, radiusPercent) {
  if (!(radiusPercent > 0) || !(w > 0) || !(h > 0)) return false;
  const r = Math.min(radiusPercent, 50) / 100 * Math.min(w, h);
  if (!(r > 0)) return false;

  let cx, cy;
  if (u < r && v < r) {
    cx = r;
    cy = r;
  } else if (u > w - r && v < r) {
    cx = w - r;
    cy = r;
  } else if (u > w - r && v > h - r) {
    cx = w - r;
    cy = h - r;
  } else if (u < r && v > h - r) {
    cx = r;
    cy = h - r;
  } else {
    return false; // not near any corner
  }
  return Math.hypot(u - cx, v - cy) > r;
}

/**
 * Parses "#rgb" / "#rrggbb" into [r,g,b]. Returns null for anything else, so
 * callers can treat "no valid backing colour" as "don't paint a backing".
 */
export function parseHexColor(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
