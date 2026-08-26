import { describe, it, expect } from "vitest";
import {
  getPreset,
  resolveOutputSize,
  coverTransform,
  applyTransform,
  scaleOutputSize,
} from "./aspectCrop.js";

describe("getPreset / resolveOutputSize", () => {
  it("falls back to the portfolio preset for an unknown id", () => {
    expect(getPreset("nope").id).toBe("portfolio");
  });

  it("resolves a built-in preset to its fixed pixels", () => {
    expect(resolveOutputSize("square")).toEqual({ w: 1000, h: 1000 });
  });

  it("resolves custom to the given width/height, rounded", () => {
    expect(resolveOutputSize("custom", "800.6", "450.2")).toEqual({ w: 801, h: 450 });
  });

  it("rejects a custom size that's missing or too small", () => {
    expect(() => resolveOutputSize("custom", "", "500")).toThrow();
    expect(() => resolveOutputSize("custom", "10", "10")).toThrow();
  });
});

describe("coverTransform / applyTransform", () => {
  it("scales a wider source up to cover a taller box, centered", () => {
    // src 400x200 (2:1) into a 100x100 box -> must scale by 100/200=0.5 on height
    const t = coverTransform(400, 200, 100, 100);
    expect(t.scale).toBeCloseTo(0.5);
    // scaled width = 200, overflow 100, centered -> offsetX = -50
    expect(t.offsetX).toBeCloseTo(-50);
    expect(t.offsetY).toBeCloseTo(0);
  });

  it("maps the source's center to the destination box's center by default", () => {
    const t = coverTransform(400, 200, 100, 100);
    const [x, y] = applyTransform(t, 200, 100);
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(50);
  });

  it("shifts the crop toward one edge when focus is off-center", () => {
    const centered = coverTransform(400, 200, 100, 100, { x: 0.5, y: 0.5 });
    const left = coverTransform(400, 200, 100, 100, { x: 0, y: 0.5 });
    expect(left.offsetX).toBeGreaterThan(centered.offsetX);
    expect(left.offsetX).toBeCloseTo(0);
  });
});

describe("scaleOutputSize", () => {
  it("multiplies both dimensions", () => {
    expect(scaleOutputSize({ w: 628, h: 500 }, 2)).toEqual({ w: 1256, h: 1000 });
    expect(scaleOutputSize({ w: 628, h: 500 }, 3)).toEqual({ w: 1884, h: 1500 });
  });

  it("is identity at 1x", () => {
    expect(scaleOutputSize({ w: 628, h: 500 }, 1)).toEqual({ w: 628, h: 500 });
  });

  it("falls back to 1x for an unsupported scale", () => {
    expect(scaleOutputSize({ w: 100, h: 80 }, 7)).toEqual({ w: 100, h: 80 });
    expect(scaleOutputSize({ w: 100, h: 80 }, undefined)).toEqual({ w: 100, h: 80 });
  });
});
