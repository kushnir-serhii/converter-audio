import { describe, it, expect } from "vitest";
import {
  VIDEO_OPERATIONS,
  getOperation,
  getCompressionPreset,
  scaleFilter,
  parseClock,
  formatClock,
  estimateSeconds,
  describeEstimate,
  extensionOf,
} from "./videoFormats.js";

describe("scaleFilter", () => {
  it("returns null when the preset keeps the original resolution", () => {
    expect(scaleFilter({ width: 1920, height: 1080 }, null)).toBeNull();
  });

  it("never upscales", () => {
    expect(scaleFilter({ width: 640, height: 360 }, 720)).toBeNull();
    expect(scaleFilter({ width: 1280, height: 720 }, 720)).toBeNull();
  });

  it("downscales to an even width", () => {
    expect(scaleFilter({ width: 1920, height: 1080 }, 720)).toBe("scale=-2:720");
  });

  it("falls back to scaling when the probe failed", () => {
    expect(scaleFilter(null, 480)).toBe("scale=-2:480");
    expect(scaleFilter({ width: null, height: null }, 480)).toBe("scale=-2:480");
  });

  it("emits no unescaped comma, which would split the filtergraph", () => {
    expect(scaleFilter({ height: 2160 }, 1080)).not.toContain(",");
  });
});

describe("parseClock", () => {
  it("parses bare seconds", () => {
    expect(parseClock("30")).toBe(30);
  });

  it("parses mm:ss", () => {
    expect(parseClock("1:05")).toBe(65);
    expect(parseClock("10:00")).toBe(600);
  });

  it("parses fractional seconds", () => {
    expect(parseClock("1:05.5")).toBe(65.5);
  });

  it("rejects junk rather than guessing", () => {
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("1:2:3")).toBeNull();
    expect(parseClock("")).toBeNull();
    expect(parseClock(null)).toBeNull();
  });

  it("round-trips with formatClock", () => {
    expect(formatClock(parseClock("2:07"))).toBe("2:07");
  });
});

describe("formatClock", () => {
  it("pads seconds", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(5)).toBe("0:05");
  });

  it("handles unusable input", () => {
    expect(formatClock(NaN)).toBe("0:00");
    expect(formatClock(-1)).toBe("0:00");
  });
});

describe("operation args", () => {
  it("compress downscales only when the source is larger", () => {
    const op = getOperation("compress");
    const big = op.args({ presetId: "web", info: { width: 1920, height: 1080 } });
    expect(big).toContain("-vf");
    expect(big).toContain("scale=-2:720");

    const small = op.args({ presetId: "web", info: { width: 640, height: 360 } });
    expect(small).not.toContain("-vf");
  });

  it("compress uses the preset's crf and audio bitrate", () => {
    const op = getOperation("compress");
    const preset = getCompressionPreset("mobile");
    const args = op.args({ presetId: "mobile", info: { width: 1920, height: 1080 } });
    expect(args[args.indexOf("-crf") + 1]).toBe(String(preset.crf));
    expect(args[args.indexOf("-b:a") + 1]).toBe(`${preset.audioBitrate}k`);
  });

  it("trim seeks before the input so the copy stays fast", () => {
    const op = getOperation("trim");
    expect(op.preArgs({ startSec: 12 })).toEqual(["-ss", "12"]);
    expect(op.preArgs({ startSec: 0 })).toEqual([]);
  });

  it("trim passes a duration, not an absolute end time", () => {
    const op = getOperation("trim");
    const args = op.args({ startSec: 10, endSec: 25 });
    expect(args[args.indexOf("-t") + 1]).toBe("15");
    expect(args).toContain("-c");
    expect(args).toContain("copy");
  });

  it("trim omits -t when there is no end time", () => {
    const op = getOperation("trim");
    expect(op.args({ startSec: 5, endSec: null })).toEqual(["-c", "copy"]);
  });

  it("mute keeps the video stream untouched", () => {
    const args = getOperation("mute").args({});
    expect(args).toContain("copy");
    expect(args).toContain("-an");
  });

  it("extract-audio drops the video stream", () => {
    const args = getOperation("extract-audio").args({ audioBitrate: 192 });
    expect(args).toContain("-vn");
    expect(args[args.indexOf("-b:a") + 1]).toBe("192k");
  });

  it("gif builds a single-pass palette filtergraph", () => {
    const args = getOperation("gif").args({ gifFps: 12, gifWidth: 480, gifSeconds: 5 });
    const filter = args[args.indexOf("-vf") + 1];
    expect(filter).toContain("palettegen");
    expect(filter).toContain("paletteuse");
    expect(filter).toContain("fps=12");
  });
});

describe("extensions", () => {
  it("keeps the source container for copy operations", () => {
    const op = getOperation("trim");
    expect(op.extension({}, { name: "clip.mov" })).toBe(".mov");
  });

  it("falls back to mp4 for an extensionless file", () => {
    const op = getOperation("mute");
    expect(op.extension({}, { name: "clip" })).toBe(".mp4");
  });

  it("lowercases", () => {
    expect(extensionOf("CLIP.MOV")).toBe(".mov");
  });
});

describe("estimates", () => {
  it("scales with the operation cost", () => {
    const copy = estimateSeconds("trim", 60);
    const slow = estimateSeconds("compress", 60);
    expect(slow).toBeGreaterThan(copy);
  });

  it("never returns zero", () => {
    expect(estimateSeconds("trim", 60)).toBeGreaterThanOrEqual(1);
  });

  it("returns null without a known duration", () => {
    expect(estimateSeconds("compress", null)).toBeNull();
    expect(describeEstimate("compress", 0)).toBeNull();
  });

  it("switches to minutes for long jobs", () => {
    expect(describeEstimate("compress", 600)).toMatch(/min$/);
  });
});

describe("operation registry", () => {
  it("every operation exposes the full contract the hook calls", () => {
    for (const op of VIDEO_OPERATIONS) {
      expect(typeof op.args).toBe("function");
      expect(typeof op.preArgs).toBe("function");
      expect(typeof op.extension).toBe("function");
      expect(typeof op.mimeType).toBe("string");
      expect(Array.isArray(op.controls)).toBe(true);
    }
  });

  it("ids are unique", () => {
    const ids = VIDEO_OPERATIONS.map((op) => op.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
