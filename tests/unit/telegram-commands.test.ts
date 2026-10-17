import { describe, it, expect } from "bun:test";
import { parsePeriodArgument } from "../../src/telegram/bot";

describe("Telegram Command Argument Parsing", () => {
  it("defaults to 'yesterday' when no argument is supplied", () => {
    expect(parsePeriodArgument("")).toBe("yesterday");
    expect(parsePeriodArgument("   ")).toBe("yesterday");
  });

  it("parses English period arguments", () => {
    expect(parsePeriodArgument("today")).toBe("today");
    expect(parsePeriodArgument("yesterday")).toBe("yesterday");
    expect(parsePeriodArgument("7d")).toBe("7d");
    expect(parsePeriodArgument("30d")).toBe("30d");
    expect(parsePeriodArgument("week")).toBe("7d");
    expect(parsePeriodArgument("month")).toBe("30d");
  });

  it("parses Persian period arguments", () => {
    expect(parsePeriodArgument("امروز")).toBe("today");
    expect(parsePeriodArgument("دیروز")).toBe("yesterday");
    expect(parsePeriodArgument("هفته")).toBe("7d");
    expect(parsePeriodArgument("ماه")).toBe("30d");
  });

  it("returns null for unrecognized arguments", () => {
    expect(parsePeriodArgument("1year")).toBeNull();
    expect(parsePeriodArgument("random-word")).toBeNull();
    expect(parsePeriodArgument("2026-01-01")).toBeNull();
  });
});
