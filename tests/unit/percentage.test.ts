import { describe, it, expect } from "bun:test";
import { calculateDelta } from "../../src/lib/percentage";

describe("Percentage & Delta Calculations", () => {
  it("calculates standard positive growth", () => {
    const res = calculateDelta(150, 100);
    expect(res.diff).toBe(50);
    expect(res.percent).toBe(50);
    expect(res.formatted).toBe("\u200E+50%");
    expect(res.indicator).toBe("positive");
    expect(res.emoji).toBe("🟢");
    expect(res.isNew).toBe(false);
  });

  it("calculates standard negative drop", () => {
    const res = calculateDelta(75, 100);
    expect(res.diff).toBe(-25);
    expect(res.percent).toBe(-25);
    expect(res.formatted).toBe("\u200E-25%");
    expect(res.indicator).toBe("negative");
    expect(res.emoji).toBe("🔴");
    expect(res.isNew).toBe(false);
  });

  it("handles zero vs zero as neutral 0%", () => {
    const res = calculateDelta(0, 0);
    expect(res.diff).toBe(0);
    expect(res.percent).toBe(0);
    expect(res.formatted).toBe("\u200E0%");
    expect(res.indicator).toBe("neutral");
    expect(res.emoji).toBe("⚪️");
    expect(res.isNew).toBe(false);
  });

  it("handles growth from zero as new entry without division by zero", () => {
    const res = calculateDelta(18, 0);
    expect(res.diff).toBe(18);
    expect(res.percent).toBeNull();
    expect(res.formatted).toBe("\u200E+18 (جدید)");
    expect(res.indicator).toBe("positive");
    expect(res.emoji).toBe("🟢");
    expect(res.isNew).toBe(true);
  });

  it("handles drop to zero as -100%", () => {
    const res = calculateDelta(0, 50);
    expect(res.diff).toBe(-50);
    expect(res.percent).toBe(-100);
    expect(res.formatted).toBe("\u200E-100%");
    expect(res.indicator).toBe("negative");
    expect(res.emoji).toBe("🔴");
  });

  it("inverts polarity for bounce rate (decrease is positive, increase is negative)", () => {
    // Drop in bounce rate: from 40% to 25% -> good (🟢 positive)
    const dropRes = calculateDelta(25, 40, { invertPolarity: true });
    expect(dropRes.diff).toBe(-15);
    expect(dropRes.indicator).toBe("positive");
    expect(dropRes.emoji).toBe("🟢");

    // Rise in bounce rate: from 25% to 40% -> bad (🔴 negative)
    const riseRes = calculateDelta(40, 25, { invertPolarity: true });
    expect(riseRes.diff).toBe(15);
    expect(riseRes.indicator).toBe("negative");
    expect(riseRes.emoji).toBe("🔴");
  });
});
