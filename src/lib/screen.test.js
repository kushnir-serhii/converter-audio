import { describe, it, expect } from "vitest";
import { contentSourceRect, isInNotch, parseHexColor, DEFAULT_NOTCH } from "./screen.js";

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
