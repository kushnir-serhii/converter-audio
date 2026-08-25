/**
 * Perspective (homography) warp for Canvas 2D.
 *
 * Canvas 2D exposes only affine transforms, so there is no built-in way to
 * draw an image into an arbitrary quadrilateral with true perspective. The
 * common workaround is to chop the source into a grid of triangles and draw
 * each with its own affine matrix. That approach is used widely, and it is
 * what this file used to do — but it is fundamentally seam-prone: each
 * triangle is rasterized and sampled independently, so neighbours disagree
 * by a fraction of a value along every shared edge. On flat or noisy content
 * you get away with it; on dark UI screenshots the shared edges show up as a
 * regular 45° hatch, because every grid cell's hypotenuse becomes a seam.
 *
 * This implementation instead does what image libraries do: inverse mapping.
 * For each destination pixel we apply the inverse homography to find where it
 * came from in the source and sample there. There are no primitives and no
 * shared edges, so seams cannot occur — the artifact class is eliminated
 * rather than mitigated.
 */

import { unsharpMask } from "./sharpen.js";

/**
 * Gaussian elimination with partial pivoting. Solves A·x = B for x, where A
 * is n×n and B has n entries.
 */
function gaussianSolve(A, B) {
  const n = A.length;
  const M = A.map((row, i) => [...row, B[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-10) {
      throw new Error("Degenerate points — no unique transform exists for this quad.");
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pv;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Solves for the homography mapping each `src` point to the corresponding
 * `dst` point (4 correspondences, in matching order). Returns the 8
 * coefficients [a,b,c,d,e,f,g,h] of:
 *
 *   X = (a*x + b*y + c) / (g*x + h*y + 1)
 *   Y = (d*x + e*y + f) / (g*x + h*y + 1)
 */
export function solveHomography(src, dst) {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("solveHomography needs exactly 4 point correspondences.");
  }
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    B.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    B.push(Y);
  }
  return gaussianSolve(A, B);
}

/** Projects one point through a homography returned by solveHomography. */
export function applyHomography(h, x, y) {
  const [a, b, c, d, e, f, g, hh] = h;
  const w = g * x + hh * y + 1;
  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * The approximate on-screen size, in destination pixels, that the warped
 * image will occupy — the longest opposing edges of the quad.
 */
export function quadExtent(quad) {
  const [tl, tr, br, bl] = quad;
  return {
    w: Math.max(dist(tl, tr), dist(bl, br)),
    h: Math.max(dist(tl, bl), dist(tr, br)),
  };
}

/** Integer bounding box of a quad, expanded by one pixel and clipped to a canvas. */
export function quadBounds(quad, canvasW, canvasH) {
  const xs = quad.map((p) => p[0]);
  const ys = quad.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1);
  const x1 = Math.min(canvasW, Math.ceil(Math.max(...xs)) + 1);
  const y1 = Math.min(canvasH, Math.ceil(Math.max(...ys)) + 1);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/**
 * Bilinear sample of an RGBA buffer at fractional (x, y), clamped at edges.
 * Writes the result into `out` (length-4 array) to avoid allocating per pixel.
 */
export function sampleBilinear(data, w, h, x, y, out) {
  let x0 = Math.floor(x);
  let y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  let x1 = x0 + 1;
  let y1 = y0 + 1;

  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 < 0) x1 = 0;
  if (y1 < 0) y1 = 0;
  if (x0 > w - 1) x0 = w - 1;
  if (y0 > h - 1) y0 = h - 1;
  if (x1 > w - 1) x1 = w - 1;
  if (y1 > h - 1) y1 = h - 1;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  for (let k = 0; k < 4; k++) {
    out[k] =
      data[i00 + k] * w00 + data[i10 + k] * w10 + data[i01 + k] * w01 + data[i11 + k] * w11;
  }
  return out;
}

/**
 * Shrinks the source toward the size it will occupy on screen, by repeated
 * halving. Each halving area-averages 2×2, which is the cheap way to get
 * proper minification — sampling a 2560px screenshot directly into a 350px
 * screen would read 4 texels per output pixel and ignore the other ~45,
 * turning thin UI lines into aliased mush.
 *
 * SUPERSAMPLE keeps a little detail headroom above the exact target.
 */
const SUPERSAMPLE = 1.4;

function toCanvas(source, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

function prescaleSource(image, srcW, srcH, targetW, targetH) {
  const wantW = Math.max(1, Math.min(srcW, Math.ceil(targetW * SUPERSAMPLE)));
  const wantH = Math.max(1, Math.min(srcH, Math.ceil(targetH * SUPERSAMPLE)));

  let curW = srcW;
  let curH = srcH;
  let current = image;

  while (curW > wantW * 2 && curH > wantH * 2) {
    const nextW = Math.max(wantW, Math.floor(curW / 2));
    const nextH = Math.max(wantH, Math.floor(curH / 2));
    current = toCanvas(current, nextW, nextH);
    curW = nextW;
    curH = nextH;
  }

  if (curW !== wantW || curH !== wantH) {
    current = toCanvas(current, wantW, wantH);
    curW = wantW;
    curH = wantH;
  }

  // Always hand back a canvas so pixels can be read out.
  if (!current.getContext) current = toCanvas(current, curW, curH);
  return { canvas: current, w: curW, h: curH };
}

/**
 * Number of sub-samples per axis inside each destination pixel. 2 gives 4
 * samples per pixel: enough to antialias the quad's own edges and to absorb
 * the residual minification left after prescaling.
 */
const SUB = 2;

/**
 * Draws `image` warped into `quad` — the 4 destination points in `ctx`'s
 * coordinate space, ordered TL, TR, BR, BL.
 *
 * Implemented by inverse mapping every destination pixel through the
 * homography, so the result contains no seams of any kind.
 */
export function drawWarpedImage(ctx, image, quad, { sharpen = 0.6 } = {}) {
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;
  if (!naturalW || !naturalH) return;

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const box = quadBounds(quad, canvasW, canvasH);
  if (box.w <= 0 || box.h <= 0) return;

  const extent = quadExtent(quad);
  const src = prescaleSource(image, naturalW, naturalH, extent.w, extent.h);
  const srcCtx = src.canvas.getContext("2d", { willReadFrequently: true });
  const srcData = srcCtx.getImageData(0, 0, src.w, src.h).data;

  // Homography straight from destination space to source space.
  const srcRect = [
    [0, 0],
    [src.w, 0],
    [src.w, src.h],
    [0, src.h],
  ];
  let inv;
  try {
    inv = solveHomography(quad, srcRect);
  } catch {
    return; // degenerate quad — nothing sensible to draw
  }
  const [ia, ib, ic, id, ie, iff, ig, ih] = inv;

  const out = new ImageData(box.w, box.h);
  const outData = out.data;
  const texel = [0, 0, 0, 0];
  const step = 1 / SUB;
  const offset = step / 2;
  const total = SUB * SUB;

  for (let py = 0; py < box.h; py++) {
    for (let px = 0; px < box.w; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let inside = 0;

      for (let sy = 0; sy < SUB; sy++) {
        const dy = box.y + py + offset + sy * step;
        for (let sx = 0; sx < SUB; sx++) {
          const dx = box.x + px + offset + sx * step;

          const w = ig * dx + ih * dy + 1;
          if (w === 0) continue;
          const u = (ia * dx + ib * dy + ic) / w;
          const v = (id * dx + ie * dy + iff) / w;

          // Outside the source rectangle means outside the quad.
          if (u < 0 || v < 0 || u > src.w || v > src.h) continue;

          sampleBilinear(srcData, src.w, src.h, u - 0.5, v - 0.5, texel);
          r += texel[0];
          g += texel[1];
          b += texel[2];
          inside++;
        }
      }

      if (inside === 0) continue;
      const o = (py * box.w + px) * 4;
      outData[o] = r / inside;
      outData[o + 1] = g / inside;
      outData[o + 2] = b / inside;
      outData[o + 3] = (inside / total) * 255;
    }
  }

  // Restore some of the local contrast that minification necessarily costs.
  unsharpMask(outData, box.w, box.h, sharpen, 1);

  // Via a temp canvas rather than putImageData, so the edge alpha composites
  // over the scene instead of replacing it.
  const tmp = document.createElement("canvas");
  tmp.width = box.w;
  tmp.height = box.h;
  tmp.getContext("2d").putImageData(out, 0, 0);

  const saved = ctx.getTransform ? ctx.getTransform() : null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tmp, box.x, box.y);
  if (saved) ctx.setTransform(saved);
}

/** Centroid of an arbitrary polygon. */
export function centroid(points) {
  const n = points.length;
  const sum = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / n, sum[1] / n];
}

/** Default starting quad: a centered rectangle inset from the image edges. */
export function defaultQuad(w, h, inset = 0.22) {
  const ix = w * inset;
  const iy = h * inset;
  return [
    [ix, iy],
    [w - ix, iy],
    [w - ix, h - iy],
    [ix, h - iy],
  ];
}
