import { describe, it, expect } from "vitest";
import { loupePlacement, naturalToClient } from "./loupe.js";

const SIZE = 160;
const GAP = 24;
const VW = 1200;
const VH = 900;

function overlaps(p, ax, ay) {
  return ax >= p.left && ax <= p.left + SIZE && ay >= p.top && ay <= p.top + SIZE;
}

describe("loupePlacement", () => {
  it("sits above-left of the anchor when there is room", () => {
    const p = loupePlacement(600, 500, SIZE, GAP, VW, VH);
    expect(p.left).toBe(600 - SIZE - GAP);
    expect(p.top).toBe(500 - SIZE - GAP);
  });

  it("flips to the right when the anchor is near the left edge", () => {
    const p = loupePlacement(20, 500, SIZE, GAP, VW, VH);
    expect(p.left).toBe(20 + GAP);
  });

  it("flips below when the anchor is near the top edge", () => {
    const p = loupePlacement(600, 10, SIZE, GAP, VW, VH);
    expect(p.top).toBe(10 + GAP);
  });

  it("stays inside the viewport in every corner", () => {
    for (const [x, y] of [
      [0, 0],
      [VW, 0],
      [0, VH],
      [VW, VH],
      [VW / 2, VH / 2],
    ]) {
      const p = loupePlacement(x, y, SIZE, GAP, VW, VH);
      expect(p.left).toBeGreaterThanOrEqual(GAP);
      expect(p.top).toBeGreaterThanOrEqual(GAP);
      expect(p.left + SIZE).toBeLessThanOrEqual(VW);
      expect(p.top + SIZE).toBeLessThanOrEqual(VH);
    }
  });

  it("never covers the anchor itself — the whole point of the offset", () => {
    for (const [x, y] of [
      [0, 0],
      [VW, 0],
      [0, VH],
      [VW, VH],
      [600, 450],
      [20, 20],
      [VW - 10, VH - 10],
    ]) {
      expect(overlaps(loupePlacement(x, y, SIZE, GAP, VW, VH), x, y)).toBe(false);
    }
  });
});

describe("naturalToClient", () => {
  const rect = { left: 100, top: 50, width: 400, height: 300 };

  it("maps the image's corners onto the element's corners", () => {
    expect(naturalToClient(rect, 0, 0, 800, 600)).toEqual({ x: 100, y: 50 });
    expect(naturalToClient(rect, 800, 600, 800, 600)).toEqual({ x: 500, y: 350 });
  });

  it("maps the centre to the centre", () => {
    expect(naturalToClient(rect, 400, 300, 800, 600)).toEqual({ x: 300, y: 200 });
  });

  it("degrades safely for a zero-sized image", () => {
    expect(naturalToClient(rect, 10, 10, 0, 0)).toEqual({ x: 100, y: 50 });
  });
});
