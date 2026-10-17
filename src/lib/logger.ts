export class Redactor {
  private static readonly registeredSecrets: Set<string> = new Set();

  public static registerSecret(secret: string | undefined | null): void {
    if (secret && typeof secret === "string" && secret.trim().length >= 6) {
      Redactor.registeredSecrets.add(secret.trim());
    }
  }

  private static readonly PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
    // Telegram Bot Token (e.g. 123456789:ABCdef-ghIJKlmnoPQRsTUVwxyZ or bot123456789:...)
    { regex: /(?:bot)?\d{8,11}:[A-Za-z0-9_-]{35,}\b/g, replacement: "[REDACTED_TELEGRAM_TOKEN]" },
    // Authorization header (Bearer or Basic)
    { regex: /(Bearer\s+|Basic\s+)[A-Za-z0-9._~+/-]+=*/gi, replacement: "$1[REDACTED_AUTH_TOKEN]" },
    // Umami API Key header
    { regex: /(x-umami-api-key["':\s]+)[A-Za-z0-9._~+/-]+/gi, replacement: "$1[REDACTED_UMAMI_KEY]" },
    // Sensitive query parameters
    { regex: /([?&](token|key|apiKey|password|secret)=)[^&]+/gi, replacement: "$1[REDACTED]" },
  ];

  public static sanitize(text: string): string {
    if (!text || typeof text !== "string") return text;
    let sanitized = text;

    for (const secret of Redactor.registeredSecrets) {
      sanitized = sanitized.replaceAll(secret, "[REDACTED_SECRET]");
    }

    return Redactor.PATTERNS.reduce((acc, { regex, replacement }) => acc.replace(regex, replacement), sanitized);
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: LogLevel = "info";

  constructor(level: LogLevel = "info") {
    this.level = level;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[targetLevel] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const entry: Record<string, unknown> = {
      timestamp,
      level,
      message: Redactor.sanitize(message),
    };

    if (meta && Object.keys(meta).length > 0) {
      entry["meta"] = JSON.parse(Redactor.sanitize(JSON.stringify(meta)));
    }

    return JSON.stringify(entry);
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, meta));
    }
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, meta));
    }
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, meta));
    }
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      const mergedMeta: Record<string, unknown> = { ...meta };
      if (error instanceof Error) {
        mergedMeta["errorName"] = error.name;
        mergedMeta["errorMessage"] = Redactor.sanitize(error.message);
        mergedMeta["stack"] = error.stack ? Redactor.sanitize(error.stack) : undefined;
      } else if (error !== undefined) {
        mergedMeta["errorRaw"] = Redactor.sanitize(String(error));
      }

      console.error(this.formatMessage("error", message, mergedMeta));
    }
  }
}

export const logger = new Logger("info");
