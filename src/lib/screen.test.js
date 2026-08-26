import { describe, it, expect } from "vitest";
import {
  contentSourceRect,
  isInNotch,
  isOutsideRoundedCorner,
  parseHexColor,
  DEFAULT_NOTCH,
  DEFAULT_CORNER_RADIUS,
} from "./screen.js";

describe("contentSourceRect", () => {
  it("uses the whole image in 'whole' mode", () => {
    expect(contentSourceRect(1000, 4000, 1.6, "whole")).toEqual({ x: 0, y: 0, w: 1000, h: 4000 });
  });

  it("crops a tall screenshot to the screen's aspect, anchored at the top", () => {
    // 1000 wide onto a 1.6 screen -> keep 625 tall, drop the rest off the bottom
    const r = contentSourceRect(1000, 4000, 1.6, "width");
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.w).toBe(1000);
    expect(r.h).toBeCloseTo(625, 6);
  });

  it("leaves a short image alone rather than padding it", () => {
    expect(contentSourceRect(1000, 400, 1.6, "width")).toEqual({ x: 0, y: 0, w: 1000, h: 400 });
  });

  it("falls back to the whole image for a nonsense aspect", () => {
    expect(contentSourceRect(800, 600, 0, "width")).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    expect(contentSourceRect(800, 600, NaN, "width")).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });
});

describe("isInNotch", () => {
  const notch = { enabled: true, width: 0.2, height: 0.1 };

  it("is false when disabled", () => {
    expect(isInNotch(0.5, 0.01, { ...notch, enabled: false })).toBe(false);
    expect(isInNotch(0.5, 0.01, null)).toBe(false);
  });

  it("catches the top-centre strip", () => {
    expect(isInNotch(0.5, 0.0, notch)).toBe(true);
    expect(isInNotch(0.45, 0.05, notch)).toBe(true);
    expect(isInNotch(0.55, 0.1, notch)).toBe(true);
  });

  it("excludes points too low or too far from centre", () => {
    expect(isInNotch(0.5, 0.2, notch)).toBe(false);
    expect(isInNotch(0.2, 0.05, notch)).toBe(false);
    expect(isInNotch(0.8, 0.05, notch)).toBe(false);
  });

  it("defaults to off so existing behaviour is unchanged", () => {
    expect(DEFAULT_NOTCH.enabled).toBe(false);
    expect(isInNotch(0.5, 0, DEFAULT_NOTCH)).toBe(false);
  });
});

describe("isOutsideRoundedCorner", () => {
  // 200x100 screen, 20% of the shorter side (100) -> r = 20
  const w = 200;
  const h = 100;
  const r = 20;

  it("is false everywhere when radius is 0 or unset, so existing behaviour is unchanged", () => {
    expect(isOutsideRoundedCorner(0, 0, w, h, 0)).toBe(false);
    expect(isOutsideRoundedCorner(0, 0, w, h, DEFAULT_CORNER_RADIUS)).toBe(false);
    expect(DEFAULT_CORNER_RADIUS).toBe(0);
  });

  it("never cuts points away from any corner", () => {
    expect(isOutsideRoundedCorner(w / 2, h / 2, w, h, 25)).toBe(false); // center
    expect(isOutsideRoundedCorner(w / 2, 0, w, h, 25)).toBe(false); // top edge, mid
    expect(isOutsideRoundedCorner(r + 1, r + 1, w, h, 20)).toBe(false); // just inside the corner box, near its inner edge
  });

  it("cuts the extreme corner point itself", () => {
    expect(isOutsideRoundedCorner(0, 0, w, h, 20)).toBe(true); // top-left
    expect(isOutsideRoundedCorner(w, 0, w, h, 20)).toBe(true); // top-right
    expect(isOutsideRoundedCorner(w, h, w, h, 20)).toBe(true); // bottom-right
    expect(isOutsideRoundedCorner(0, h, w, h, 20)).toBe(true); // bottom-left
  });

  it("draws the arc where distance to the corner's circle center equals the radius", () => {
    // top-left corner circle is centered at (r, r); a point exactly r away
    // along the diagonal should sit right on the boundary either way
    const cx = r;
    const cy = r;
    const onArc = [cx - r / Math.SQRT2, cy - r / Math.SQRT2];
    const justInside = [cx - (r - 1) / Math.SQRT2, cy - (r - 1) / Math.SQRT2];
    const justOutside = [cx - (r + 1) / Math.SQRT2, cy - (r + 1) / Math.SQRT2];
    expect(isOutsideRoundedCorner(...onArc, w, h, 20)).toBe(false);
    expect(isOutsideRoundedCorner(...justInside, w, h, 20)).toBe(false);
    expect(isOutsideRoundedCorner(...justOutside, w, h, 20)).toBe(true);
  });

  it("clamps an oversized radius request to 50% rather than overlapping corners unpredictably", () => {
    // radius 90% would try for r=90 (>h/2); should behave like 50% (r=50)
    expect(isOutsideRoundedCorner(0, 0, w, h, 90)).toBe(true);
    expect(isOutsideRoundedCorner(w / 2, h / 2, w, h, 90)).toBe(false); // center still untouched
  });

  it("scales radius off the shorter side, so a wide screen doesn't get an exaggerated corner", () => {
    // same 20% radius on a much wider screen: r is still based on min(w,h) = h = 100 -> r = 20
    expect(isOutsideRoundedCorner(0, 0, 1000, 100, 20)).toBe(true);
    expect(isOutsideRoundedCorner(25, 25, 1000, 100, 20)).toBe(false);
  });
});

describe("parseHexColor", () => {
  it("parses long and short form", () => {
    expect(parseHexColor("#000000")).toEqual([0, 0, 0]);
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
    expect(parseHexColor("1a2b3c")).toEqual([26, 43, 60]);
  });

  it("returns null for anything unparseable", () => {
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("nope")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
    expect(parseHexColor(null)).toBeNull();
    expect(parseHexColor(123)).toBeNull();
  });
});
