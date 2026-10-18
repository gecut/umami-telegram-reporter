export type Indicator = "positive" | "negative" | "neutral";

export interface DeltaResult {
  current: number;
  previous: number;
  diff: number;
  percent: number | null;
  formatted: string;
  indicator: Indicator;
  emoji: string;
  isNew: boolean;
}

export interface DeltaOptions {
  invertPolarity?: boolean; // When true, a decrease is positive and an increase is negative (e.g. bounce rate)
  fractionDigits?: number;
}

/**
 * Calculates percentage change between current and previous periods with robust edge-case handling.
 * Enforces BiDi protection so signs (+/-) do not flip in RTL Telegram clients.
 */
export function calculateDelta(
  current: number,
  previous: number,
  options: DeltaOptions = {}
): DeltaResult {
  const { invertPolarity = false, fractionDigits = 1 } = options;
  const diff = current - previous;

  // Case 1: Both zero
  if (current === 0 && previous === 0) {
    return {
      current,
      previous,
      diff: 0,
      percent: 0,
      formatted: "\u200E0%",
      indicator: "neutral",
      emoji: "⚪️",
      isNew: false,
    };
  }

  // Case 2: Growth from zero (New entry)
  if (previous === 0 && current > 0) {
    const indicator: Indicator = invertPolarity ? "negative" : "positive";
    const emoji = indicator === "positive" ? "🟢" : "🔴";
    const displayVal = Number.isInteger(current) ? current.toString() : current.toFixed(fractionDigits);
    return {
      current,
      previous,
      diff,
      percent: null,
      formatted: `\u200E+${displayVal} (جدید)`,
      indicator,
      emoji,
      isNew: true,
    };
  }

  // Case 3: Complete drop to zero
  if (current === 0 && previous > 0) {
    const indicator: Indicator = invertPolarity ? "positive" : "negative";
    const emoji = indicator === "positive" ? "🟢" : "🔴";
    return {
      current,
      previous,
      diff,
      percent: -100,
      formatted: "\u200E-100%",
      indicator,
      emoji,
      isNew: false,
    };
  }

  // Standard percentage calculation
  const rawPercent = (diff / previous) * 100;
  const roundedPercent = Number(rawPercent.toFixed(fractionDigits));

  if (roundedPercent === 0) {
    return {
      current,
      previous,
      diff,
      percent: 0,
      formatted: "\u200E0%",
      indicator: "neutral",
      emoji: "⚪️",
      isNew: false,
    };
  }

  let indicator: Indicator;
  if (roundedPercent > 0) {
    indicator = invertPolarity ? "negative" : "positive";
  } else {
    indicator = invertPolarity ? "positive" : "negative";
  }

  const emoji = indicator === "positive" ? "🟢" : "🔴";
  const sign = roundedPercent > 0 ? "+" : "";
  const formatted = `\u200E${sign}${roundedPercent}%`;

  return {
    current,
    previous,
    diff,
    percent: roundedPercent,
    formatted,
    indicator,
    emoji,
    isNew: false,
  };
}
