/**
 * Formats a number using Latin digits with standard thousand separators.
 * Example: 1842 -> "1,842"
 */
export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Formats seconds into human-readable Persian duration.
 * Example: 165 -> "2 دقیقه و 45 ثانیه"
 */
export function formatDuration(totalSeconds: number | undefined | null): string {
  if (!totalSeconds || totalSeconds <= 0 || isNaN(totalSeconds)) {
    return "0 ثانیه";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ساعت`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} دقیقه`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ثانیه`);
  }

  return parts.join(" و ");
}

/**
 * Unicode Right-To-Left Mark (RLM)
 * Ensures lines starting with emojis or symbols are aligned RTL in Telegram.
 */
export const RLM = "\u200F";

/**
 * Unicode Left-To-Right Mark (LRM)
 * Ensures signs, numbers, or percentages do not get reversed by BiDi engines.
 */
export const LRM = "\u200E";

/**
 * Prepends RLM to line(s) to enforce RTL rendering in Telegram.
 * Handles both single-line and multiline strings properly.
 */
export function wrapRtlLine(text: string): string {
  if (!text.includes("\n")) {
    return text.length > 0 ? `${RLM}${text}` : text;
  }
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `${RLM}${line}` : line))
    .join("\n");
}

/**
 * Wraps technical or LTR tokens (percentages, numbers with signs) in LRM.
 */
export function wrapLtr(text: string): string {
  return `${LRM}${text}${LRM}`;
}
