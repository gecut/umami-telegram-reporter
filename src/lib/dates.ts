export type DateWindowType = "today" | "yesterday" | "24h" | "7d" | "30d";

export interface DateWindow {
  type: DateWindowType;
  timezone: string;
  startAt: number; // Unix epoch ms
  endAt: number;   // Unix epoch ms
  startDate: Date;
  endDate: Date;
  labelPersian: string;
}

/**
 * Accurately parses a calendar date string (YYYY-MM-DD) and time string (HH:mm:ss.SSS)
 * in a given IANA timezone into exact UTC epoch milliseconds.
 */
export function getZonedEpochMs(dateStr: string, timeStr: string, timeZone: string): number {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const [hStr, mStr, sStr] = timeStr.split(":");
  const hour = Number(hStr);
  const minute = Number(mStr);
  const second = parseFloat(sStr ?? "0");
  const secInt = Math.floor(second);
  const ms = Math.round((second - secInt) * 1000);

  // Construct UTC date as baseline approximation
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, secInt, ms));

  // Determine timezone offset by formatting utcGuess in target timezone
  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = tzFormatter.formatToParts(utcGuess);
  const partMap: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      partMap[part.type] = Number(part.value);
    }
  }

  // Handle midnight 24 hour quirk in en-US
  const tzHour = (partMap["hour"] ?? 0) === 24 ? 0 : (partMap["hour"] ?? 0);
  const tzYear = partMap["year"] ?? year;
  const tzMonth = partMap["month"] ?? month;
  const tzDay = partMap["day"] ?? day;
  const tzMin = partMap["minute"] ?? minute;
  const tzSec = partMap["second"] ?? secInt;

  const asUtcInTz = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, tzSec, ms);
  const offsetMs = asUtcInTz - utcGuess.getTime();

  return utcGuess.getTime() - offsetMs;
}

/**
 * Shifts a YYYY-MM-DD calendar date string by a given number of days.
 */
export function shiftCalendarDate(dateStr: string, days: number): string {
  const [yStr, mStr, dStr] = dateStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

/**
 * Formats a Date or epoch ms into Persian Shamsi calendar date.
 * Example: "شنبه، ۲۶ مهر ۱۴۰۵"
 */
export function formatPersianDate(
  dateOrMs: Date | number,
  timeZone: string = "Asia/Tehran"
): string {
  const date = typeof dateOrMs === "number" ? new Date(dateOrMs) : dateOrMs;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Computes exact epoch millisecond boundaries for any IANA timezone.
 */
export function getDateWindow(
  type: DateWindowType,
  timeZone: string = "Asia/Tehran",
  now: Date = new Date()
): DateWindow {
  // Calendar date in target timezone
  const datePartsFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = datePartsFormatter.format(now); // 'YYYY-MM-DD'

  let startStr: string;
  let endStr: string;
  let endAt: number;
  let labelPersian: string;

  switch (type) {
    case "today": {
      startStr = todayStr;
      endStr = todayStr;
      const startAt = getZonedEpochMs(startStr, "00:00:00.000", timeZone);
      endAt = now.getTime(); // Up to current moment for today
      labelPersian = `امروز (${formatPersianDate(now, timeZone)})`;
      return {
        type,
        timezone: timeZone,
        startAt,
        endAt,
        startDate: new Date(startAt),
        endDate: new Date(endAt),
        labelPersian,
      };
    }

    case "yesterday": {
      const yesterdayStr = shiftCalendarDate(todayStr, -1);
      startStr = yesterdayStr;
      endStr = yesterdayStr;
      const startAt = getZonedEpochMs(startStr, "00:00:00.000", timeZone);
      endAt = getZonedEpochMs(endStr, "23:59:59.999", timeZone);
      labelPersian = `دیروز (${formatPersianDate(startAt, timeZone)})`;
      return {
        type,
        timezone: timeZone,
        startAt,
        endAt,
        startDate: new Date(startAt),
        endDate: new Date(endAt),
        labelPersian,
      };
    }

    case "24h": {
      const endAt = now.getTime();
      const startAt = endAt - 24 * 60 * 60 * 1000;
      labelPersian = `۲۴ ساعت گذشته (${formatPersianDate(startAt, timeZone)} تا الان)`;
      return {
        type,
        timezone: timeZone,
        startAt,
        endAt,
        startDate: new Date(startAt),
        endDate: new Date(endAt),
        labelPersian,
      };
    }

    case "7d": {
      startStr = shiftCalendarDate(todayStr, -6);
      endStr = todayStr;
      const startAt = getZonedEpochMs(startStr, "00:00:00.000", timeZone);
      endAt = now.getTime();
      labelPersian = `۷ روز گذشته (${formatPersianDate(startAt, timeZone)} تا امروز)`;
      return {
        type,
        timezone: timeZone,
        startAt,
        endAt,
        startDate: new Date(startAt),
        endDate: new Date(endAt),
        labelPersian,
      };
    }

    case "30d": {
      startStr = shiftCalendarDate(todayStr, -29);
      endStr = todayStr;
      const startAt = getZonedEpochMs(startStr, "00:00:00.000", timeZone);
      endAt = now.getTime();
      labelPersian = `۳۰ روز گذشته (${formatPersianDate(startAt, timeZone)} تا امروز)`;
      return {
        type,
        timezone: timeZone,
        startAt,
        endAt,
        startDate: new Date(startAt),
        endDate: new Date(endAt),
        labelPersian,
      };
    }
  }
}

/**
 * Computes the preceding comparison period of identical duration.
 */
export function getComparisonWindow(window: DateWindow): DateWindow {
  const duration = window.endAt - window.startAt + 1;
  const prevEndAt = window.startAt - 1;
  const prevStartAt = prevEndAt - duration + 1;

  return {
    type: window.type,
    timezone: window.timezone,
    startAt: prevStartAt,
    endAt: prevEndAt,
    startDate: new Date(prevStartAt),
    endDate: new Date(prevEndAt),
    labelPersian: `دوره معادل قبلی (${formatPersianDate(prevStartAt, window.timezone)} تا ${formatPersianDate(prevEndAt, window.timezone)})`,
  };
}
