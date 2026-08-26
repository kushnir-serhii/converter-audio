/**
 * Unsharp masking for the warped layer.
 *
 * Any large minification — and squeezing a 2560px screenshot into a ~350px
 * laptop screen is a big one — costs local contrast even when the resampling
 * is done correctly. Area-averaging is the *right* answer for avoiding
 * aliasing, but it necessarily softens edges: a 1px UI line spread across a
 * seventh of a pixel becomes a faint smear. Unsharp masking restores some of
 * that apparent edge contrast by subtracting a blurred copy from the original.
 *
 * It cannot invent detail that minification destroyed. It makes what survived
 * read more crisply, which is a real perceptual gain but not a substitute for
 * framing the screenshot so less has to be thrown away in the first place.
 */

/** Separable 3-tap blur (1-2-1), run `passes` times to approximate a Gaussian. */
function blurRGB(src, w, h, passes) {
  let cur = Float32Array.from(src);
  let tmp = new Float32Array(cur.length);

  for (let p = 0; p < passes; p++) {
    // horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const i = row + x * 4;
        const xm = row + (x > 0 ? x - 1 : 0) * 4;
        const xp = row + (x < w - 1 ? x + 1 : w - 1) * 4;
        for (let k = 0; k < 3; k++) {
          tmp[i + k] = (cur[xm + k] + 2 * cur[i + k] + cur[xp + k]) / 4;
        }
        tmp[i + 3] = cur[i + 3];
      }
    }
    // vertical
    for (let y = 0; y < h; y++) {
      const ym = (y > 0 ? y - 1 : 0) * w * 4;
      const yp = (y < h - 1 ? y + 1 : h - 1) * w * 4;
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const i = row + x * 4;
        const o = x * 4;
        for (let k = 0; k < 3; k++) {
          cur[i + k] = (tmp[ym + o + k] + 2 * tmp[i + k] + tmp[yp + o + k]) / 4;
        }
      }
    }
  }
  return cur;
}

/**
 * Sharpens the RGB channels of an RGBA buffer in place.
 *
 * `amount` 0 disables it entirely; ~0.6 is a natural-looking default for this
 * much minification; above ~1.5 halos start showing on high-contrast edges.
 * `passes` widens the radius.
 *
 * Alpha is left untouched, and pixels that are not fully opaque are skipped —
 * those are the antialiased rim of the quad, where sharpening would draw a
 * bright fringe along the edge of the screen.
 */
export function unsharpMask(data, w, h, amount = 0.6, passes = 1) {
  if (!(amount > 0) || w < 3 || h < 3) return data;

  const blurred = blurRGB(data, w, h, passes);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) continue;
    for (let k = 0; k < 3; k++) {
      const v = data[i + k] + amount * (data[i + k] - blurred[i + k]);
      data[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return data;
}
