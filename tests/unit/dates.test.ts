import { describe, it, expect } from "bun:test";
import {
  getDateWindow,
  getComparisonWindow,
  getZonedEpochMs,
  shiftCalendarDate,
  formatPersianDate,
} from "../../src/lib/dates";

describe("Date Utilities & Timezone Calculations", () => {
  const fixedNow = new Date("2026-10-17T12:00:00.000Z"); // 15:30 in Tehran (UTC+03:30)

  it("calculates exact epoch ms for local midnight in Asia/Tehran", () => {
    // Midnight in Asia/Tehran on 2026-10-17 is 2026-10-16 20:30:00 UTC
    const midnightEpochMs = getZonedEpochMs("2026-10-17", "00:00:00.000", "Asia/Tehran");
    const d = new Date(midnightEpochMs);
    expect(d.toISOString()).toBe("2026-10-16T20:30:00.000Z");
  });

  it("shifts calendar date strings across day and month boundaries", () => {
    expect(shiftCalendarDate("2026-10-17", -1)).toBe("2026-10-16");
    expect(shiftCalendarDate("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftCalendarDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("computes accurate 'yesterday' date window in Asia/Tehran", () => {
    const win = getDateWindow("yesterday", "Asia/Tehran", fixedNow);

    expect(win.type).toBe("yesterday");
    expect(win.timezone).toBe("Asia/Tehran");

    // Yesterday for 2026-10-17 in Tehran is 2026-10-16 (from 2026-10-15 20:30:00 UTC to 2026-10-16 20:29:59.999 UTC)
    expect(new Date(win.startAt).toISOString()).toBe("2026-10-15T20:30:00.000Z");
    expect(new Date(win.endAt).toISOString()).toBe("2026-10-16T20:29:59.999Z");
    expect(win.endAt - win.startAt + 1).toBe(86_400_000); // Exactly 24 hours
  });

  it("computes accurate 'today' date window ending at current time", () => {
    const win = getDateWindow("today", "Asia/Tehran", fixedNow);

    expect(win.type).toBe("today");
    expect(new Date(win.startAt).toISOString()).toBe("2026-10-16T20:30:00.000Z");
    expect(win.endAt).toBe(fixedNow.getTime());
  });

  it("computes accurate '7d' date window", () => {
    const win = getDateWindow("7d", "Asia/Tehran", fixedNow);

    expect(win.type).toBe("7d");
    // Start of 6 days ago (7 calendar days inclusive)
    expect(new Date(win.startAt).toISOString()).toBe("2026-10-10T20:30:00.000Z");
    expect(win.endAt).toBe(fixedNow.getTime());
  });

  it("computes accurate '24h' date window ending at current time", () => {
    const win = getDateWindow("24h", "Asia/Tehran", fixedNow);
    expect(win.endAt).toBe(fixedNow.getTime());
    expect(win.startAt).toBe(fixedNow.getTime() - 24 * 60 * 60 * 1000);
    expect(win.labelPersian).toContain("۲۴ ساعت گذشته");
  });

  it("computes identical duration for comparison window", () => {
    const win = getDateWindow("yesterday", "Asia/Tehran", fixedNow);
    const comp = getComparisonWindow(win);

    const originalDuration = win.endAt - win.startAt + 1;
    const compDuration = comp.endAt - comp.startAt + 1;

    expect(compDuration).toBe(originalDuration);
    expect(comp.endAt).toBe(win.startAt - 1);
  });

  it("formats dates in Persian Shamsi calendar", () => {
    const epochMs = Date.UTC(2026, 9, 17, 12, 0, 0); // 2026-10-17 is 25 Mehr 1405
    const persianStr = formatPersianDate(epochMs, "Asia/Tehran");
    expect(persianStr).toContain("۱۴۰۵");
    expect(persianStr).toContain("مهر");
  });
});
