import { describe, it, expect } from "vitest";
import {
  solveHomography,
  applyHomography,
  centroid,
  defaultQuad,
  quadExtent,
  quadBounds,
  sampleBilinear,
} from "./perspective.js";

describe("solveHomography / applyHomography", () => {
  it("maps a unit square to itself as the identity", () => {
    const square = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const h = solveHomography(square, square);
    for (const [x, y] of square) {
      const [X, Y] = applyHomography(h, x, y);
      expect(X).toBeCloseTo(x, 6);
      expect(Y).toBeCloseTo(y, 6);
    }
  });

  it("reproduces all 4 correspondences exactly for a real quad", () => {
    const src = [
      [0, 0],
      [100, 0],
      [100, 80],
      [0, 80],
    ];
    const dst = [
      [161, 143],
      [590, 143],
      [664, 451],
      [247, 538],
    ];
    const h = solveHomography(src, dst);
    src.forEach(([x, y], i) => {
      const [X, Y] = applyHomography(h, x, y);
      expect(X).toBeCloseTo(dst[i][0], 4);
      expect(Y).toBeCloseTo(dst[i][1], 4);
    });
  });

  it("maps the rectangle's center somewhere inside the destination quad", () => {
    const src = [
      [0, 0],
      [100, 0],
      [100, 80],
      [0, 80],
    ];
    const dst = [
      [161, 143],
      [590, 143],
      [664, 451],
      [247, 538],
    ];
    const h = solveHomography(src, dst);
    const [cx, cy] = applyHomography(h, 50, 40);
    // roughly the centroid of the destination quad
    const [ex, ey] = centroid(dst);
    expect(cx).toBeGreaterThan(ex - 120);
    expect(cx).toBeLessThan(ex + 120);
    expect(cy).toBeGreaterThan(ey - 120);
    expect(cy).toBeLessThan(ey + 120);
  });

  it("throws on a degenerate (collinear) destination", () => {
    const src = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const dst = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    expect(() => solveHomography(src, dst)).toThrow();
  });
});

describe("defaultQuad", () => {
  it("insets symmetrically from all four edges", () => {
    const q = defaultQuad(600, 500, 0.2);
    const [tl, tr, br, bl] = q;
    expect(tl).toEqual([120, 100]);
    expect(tr).toEqual([480, 100]);
    expect(br).toEqual([480, 400]);
    expect(bl).toEqual([120, 400]);
  });
});

describe("quadExtent", () => {
  it("uses the longer of each pair of opposing edges", () => {
    // 3-4-5 trapezoid so every edge length is exact:
    //   top    (0,0)->(100,0)    = 100
    //   bottom (0,80)->(160,80)  = 160   <- longer, so w = 160
    //   left   (0,0)->(0,80)     = 80
    //   right  (100,0)->(160,80) = 100   <- longer, so h = 100
    const quad = [
      [0, 0],
      [100, 0],
      [160, 80],
      [0, 80],
    ];
    const e = quadExtent(quad);
    expect(e.w).toBeCloseTo(160, 6);
    expect(e.h).toBeCloseTo(100, 6);
  });

  it("is symmetric for a plain rectangle", () => {
    const e = quadExtent([
      [10, 20],
      [110, 20],
      [110, 70],
      [10, 70],
    ]);
    expect(e.w).toBeCloseTo(100, 6);
    expect(e.h).toBeCloseTo(50, 6);
  });
});

describe("quadBounds", () => {
  it("covers the quad, expanded by a pixel", () => {
    const b = quadBounds(
      [
        [10.2, 20.8],
        [100, 20],
        [110, 70],
        [5, 60],
      ],
      1000,
      1000
    );
    expect(b.x).toBeLessThanOrEqual(5);
    expect(b.y).toBeLessThanOrEqual(20);
    expect(b.x + b.w).toBeGreaterThanOrEqual(110);
    expect(b.y + b.h).toBeGreaterThanOrEqual(70);
  });

  it("clips to the canvas and never goes negative", () => {
    const b = quadBounds(
      [
        [-50, -50],
        [50, -40],
        [60, 40],
        [-40, 30],
      ],
      40,
      40
    );
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.x + b.w).toBeLessThanOrEqual(40);
    expect(b.y + b.h).toBeLessThanOrEqual(40);
  });

  it("reports an empty box for a quad entirely off-canvas", () => {
    const b = quadBounds(
      [
        [500, 500],
        [600, 500],
        [600, 600],
        [500, 600],
      ],
      100,
      100
    );
    expect(b.w * b.h).toBe(0);
  });
});

describe("sampleBilinear", () => {
  // 2x2 RGBA image: black, white / white, black (red channel 0,255,255,0)
  const data = new Uint8ClampedArray([
    0, 0, 0, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 0, 0, 0, 255,
  ]);
  const out = [0, 0, 0, 0];

  it("returns the exact texel at integer coordinates", () => {
    expect(sampleBilinear(data, 2, 2, 0, 0, out)[0]).toBeCloseTo(0);
    expect(sampleBilinear(data, 2, 2, 1, 0, out)[0]).toBeCloseTo(255);
    expect(sampleBilinear(data, 2, 2, 0, 1, out)[0]).toBeCloseTo(255);
    expect(sampleBilinear(data, 2, 2, 1, 1, out)[0]).toBeCloseTo(0);
  });

  it("blends halfway between two texels", () => {
    expect(sampleBilinear(data, 2, 2, 0.5, 0, out)[0]).toBeCloseTo(127.5);
  });

  it("averages all four at the center", () => {
    expect(sampleBilinear(data, 2, 2, 0.5, 0.5, out)[0]).toBeCloseTo(127.5);
  });

  it("clamps rather than reading out of bounds", () => {
    expect(sampleBilinear(data, 2, 2, -5, -5, out)[0]).toBeCloseTo(0);
    expect(sampleBilinear(data, 2, 2, 99, 99, out)[0]).toBeCloseTo(0);
  });
});

describe("inverse mapping round-trip", () => {
  it("maps quad corners back onto the source rectangle's corners", () => {
    const quad = [
      [161, 143],
      [590, 143],
      [664, 451],
      [247, 538],
    ];
    const srcRect = [
      [0, 0],
      [800, 0],
      [800, 600],
      [0, 600],
    ];
    const inv = solveHomography(quad, srcRect);
    quad.forEach(([x, y], i) => {
      const [u, v] = applyHomography(inv, x, y);
      expect(u).toBeCloseTo(srcRect[i][0], 3);
      expect(v).toBeCloseTo(srcRect[i][1], 3);
    });
  });
});
