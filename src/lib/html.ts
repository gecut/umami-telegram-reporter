/**
 * Bulletproof HTML escaping helper for Telegram Bot API HTML parse mode.
 * Replaces &, <, >, and " to prevent entity injection and broken formatting.
 */
export function escapeHtml(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tagged template literal that automatically escapes interpolated values for Telegram HTML.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((acc, str, i) => {
    const val = values[i - 1];
    return acc + escapeHtml(val as string | number) + str;
  });
}
