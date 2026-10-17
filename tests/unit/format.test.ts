import { describe, it, expect } from "bun:test";
import { formatNumber, formatDuration, wrapRtlLine, RLM } from "../../src/lib/format";

describe("Formatting & BiDi Helpers", () => {
  it("formats numbers with Latin digits and thousand separators", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1842)).toBe("1,842");
    expect(formatNumber(1250000)).toBe("1,250,000");
    expect(formatNumber(null)).toBe("0");
  });

  it("formats duration in seconds to Persian words", () => {
    expect(formatDuration(0)).toBe("0 ثانیه");
    expect(formatDuration(45)).toBe("45 ثانیه");
    expect(formatDuration(165)).toBe("2 دقیقه و 45 ثانیه");
    expect(formatDuration(3600)).toBe("1 ساعت");
    expect(formatDuration(3725)).toBe("1 ساعت و 2 دقیقه و 5 ثانیه");
  });

  it("prepends RLM on lines for RTL alignment", () => {
    const line = "👥 کاربران: 10";
    const wrapped = wrapRtlLine(line);
    expect(wrapped.startsWith(RLM)).toBe(true);
    expect(wrapped).toBe(`${RLM}${line}`);
  });

  it("prepends RLM on each non-empty line of multiline text", () => {
    const text = "خط یک\n\nخط دو";
    const wrapped = wrapRtlLine(text);
    const lines = wrapped.split("\n");
    expect(lines[0]?.startsWith(RLM)).toBe(true);
    expect(lines[1]).toBe("");
    expect(lines[2]?.startsWith(RLM)).toBe(true);
  });
});
