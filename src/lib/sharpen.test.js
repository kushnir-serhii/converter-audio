import { describe, it, expect } from "vitest";
import { unsharpMask } from "./sharpen.js";

function makeEdge(w, h) {
  // left half dark, right half light — one vertical edge down the middle
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = x < w / 2 ? 80 : 160;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return d;
}

const at = (d, w, x, y) => d[(y * w + x) * 4];

describe("unsharpMask", () => {
  it("increases contrast across an edge", () => {
    const w = 16, h = 8;
    const d = makeEdge(w, h);
    const before = at(d, w, w / 2, 4) - at(d, w, w / 2 - 1, 4);
    unsharpMask(d, w, h, 1.0, 1);
    const after = at(d, w, w / 2, 4) - at(d, w, w / 2 - 1, 4);
    expect(after).toBeGreaterThan(before);
  });

  it("leaves a flat region unchanged", () => {
    const w = 12, h = 12;
    const d = new Uint8ClampedArray(w * h * 4).fill(120);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    const copy = Uint8ClampedArray.from(d);
    unsharpMask(d, w, h, 0.8, 1);
    expect(Array.from(d)).toEqual(Array.from(copy));
  });

  it("is a no-op at amount 0", () => {
    const w = 16, h = 8;
    const d = makeEdge(w, h);
    const copy = Uint8ClampedArray.from(d);
    unsharpMask(d, w, h, 0, 1);
    expect(Array.from(d)).toEqual(Array.from(copy));
  });

  it("never writes outside 0..255", () => {
    const w = 16, h = 8;
    const d = makeEdge(w, h);
    unsharpMask(d, w, h, 8, 2);
    for (const v of d) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(255);
  });

  it("skips partially transparent pixels (the quad's antialiased rim)", () => {
    const w = 16, h = 8;
    const d = makeEdge(w, h);
    const i = (4 * w + 8) * 4;
    d[i + 3] = 120;              // mark one pixel as rim
    const kept = d[i];
    unsharpMask(d, w, h, 1.5, 1);
    expect(d[i]).toBe(kept);
  });

  it("leaves alpha untouched", () => {
    const w = 16, h = 8;
    const d = makeEdge(w, h);
    unsharpMask(d, w, h, 1.0, 1);
    for (let i = 3; i < d.length; i += 4) expect(d[i]).toBe(255);
  });
});
