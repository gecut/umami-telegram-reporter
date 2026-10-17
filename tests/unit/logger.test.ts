import { describe, it, expect } from "bun:test";
import { Redactor } from "../../src/lib/logger";

describe("Logger & Token Redactor", () => {
  it("redacts standard Telegram bot tokens", () => {
    const raw = "Connecting to 123456789:ABCdef-ghIJKlmnoPQRsTUVwxyZ12345678";
    const sanitized = Redactor.sanitize(raw);
    expect(sanitized).toBe("Connecting to [REDACTED_TELEGRAM_TOKEN]");
  });

  it("redacts Telegram tokens in API URLs with 'bot' prefix", () => {
    const url = "https://api.telegram.org/bot123456789:ABCdef-ghIJKlmnoPQRsTUVwxyZ12345678/sendMessage";
    const sanitized = Redactor.sanitize(url);
    expect(sanitized).toBe("https://api.telegram.org/[REDACTED_TELEGRAM_TOKEN]/sendMessage");
  });

  it("redacts registered exact secrets", () => {
    const secretApiKey = "umami_super_secret_production_key_xyz";
    Redactor.registerSecret(secretApiKey);

    const message = `API request failed with key ${secretApiKey} on endpoint`;
    const sanitized = Redactor.sanitize(message);
    expect(sanitized).toBe("API request failed with key [REDACTED_SECRET] on endpoint");
  });

  it("redacts Bearer and Basic authorization headers", () => {
    const text = "Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const sanitized = Redactor.sanitize(text);
    expect(sanitized).toContain("Bearer [REDACTED_AUTH_TOKEN]");
  });
});
