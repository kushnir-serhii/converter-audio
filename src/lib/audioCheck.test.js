import { describe, it, expect } from "vitest";
import { parseAstatsRmsLevel, parseAstatsPeakLevel, parseLoudnormMeasuredI } from "./audioAnalysis.js";

describe("parseAstatsRmsLevel", () => {
  it("parses the Overall RMS level line", () => {
    const log = "[Parsed_astats_0 @ 0x0] Overall\n[Parsed_astats_0 @ 0x0] RMS level dB: -18.234000";
    expect(parseAstatsRmsLevel(log)).toBeCloseTo(-18.234, 3);
  });

  it("handles -inf as -Infinity", () => {
    const log = "Overall] RMS level dB: -inf";
    expect(parseAstatsRmsLevel(log)).toBe(-Infinity);
  });

  it("returns null when the pattern isn't present", () => {
    expect(parseAstatsRmsLevel("nothing useful here")).toBeNull();
  });
});

describe("parseAstatsPeakLevel", () => {
  it("parses the Overall Peak level line", () => {
    const log = "Overall] Peak level dB: -0.500000";
    expect(parseAstatsPeakLevel(log)).toBeCloseTo(-0.5, 3);
  });
});

describe("parseLoudnormMeasuredI", () => {
  it("extracts input_i from the loudnorm json block", () => {
    const log = `[Parsed_loudnorm_0 @ 0x0]\n{\n\t"input_i" : "-19.20",\n\t"input_tp" : "-1.00"\n}`;
    expect(parseLoudnormMeasuredI(log)).toBeCloseTo(-19.2, 2);
  });

  it("returns null when absent", () => {
    expect(parseLoudnormMeasuredI("no json here")).toBeNull();
  });
});
