import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { EnvSchema, resetEnvCache } from "../../src/config/env";
import {
  ProjectConfigSchema,
  loadProjects,
  resetProjectRegistryCache,
} from "../../src/config/projects";
import { writeFileSync, unlinkSync } from "node:fs";

describe("Configuration Schema Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetEnvCache();
    resetProjectRegistryCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("validates valid environment configuration", () => {
    const valid = {
      TELEGRAM_BOT_TOKEN: "123456789:ABCdef-ghIJKlmnoPQRsTUVwxyZ01234567",
      UMAMI_BASE_URL: "https://api.umami.is/v1/",
      UMAMI_API_KEY: "valid-key-123",
      LOG_LEVEL: "info",
    };

    const parsed = EnvSchema.parse(valid);
    expect(parsed.UMAMI_BASE_URL).toBe("https://api.umami.is/v1"); // Stripped trailing slash
    expect(parsed.PROJECTS_CONFIG_PATH).toBe("./projects.json"); // Default applied
  });

  it("rejects invalid bot token format", () => {
    const invalid = {
      TELEGRAM_BOT_TOKEN: "not-a-valid-token",
      UMAMI_BASE_URL: "https://api.umami.is/v1",
      UMAMI_API_KEY: "valid-key",
    };

    expect(() => EnvSchema.parse(invalid)).toThrow("Invalid Telegram Bot Token format");
  });

  it("validates project configuration with IANA timezone", () => {
    const validProject = {
      id: "my-shop",
      name: "فروشگاه من",
      telegramChatId: -100123456789,
      umamiWebsiteId: "b3e34b45-21dc-4a37-b769-cf4d97f5b801",
      timezone: "Asia/Tehran",
    };

    const parsed = ProjectConfigSchema.parse(validProject);
    expect(parsed.id).toBe("my-shop");
    expect(parsed.schedule.enabled).toBe(false);
  });

  it("rejects invalid IANA timezone in project config", () => {
    const invalidProject = {
      id: "my-shop",
      name: "فروشگاه من",
      telegramChatId: -100123456789,
      umamiWebsiteId: "b3e34b45-21dc-4a37-b769-cf4d97f5b801",
      timezone: "Invalid/Not_A_Timezone",
    };

    expect(() => ProjectConfigSchema.parse(invalidProject)).toThrow("Invalid IANA timezone identifier");
  });

  it("detects and rejects duplicate telegramChatId in project file", () => {
    const tempConfigPath = "./temp-test-projects.json";
    const duplicateData = [
      {
        id: "proj-1",
        name: "پروژه ۱",
        telegramChatId: -100111111111,
        umamiWebsiteId: "id-1",
      },
      {
        id: "proj-2",
        name: "پروژه ۲",
        telegramChatId: -100111111111, // Duplicate!
        umamiWebsiteId: "id-2",
      },
    ];

    writeFileSync(tempConfigPath, JSON.stringify(duplicateData));
    try {
      expect(() => loadProjects(tempConfigPath)).toThrow("Duplicate telegramChatId detected");
    } finally {
      unlinkSync(tempConfigPath);
    }
  });

  it("validates valid cron expressions in schedule config", () => {
    const projectWithCron = {
      id: "shop",
      name: "فروشگاه",
      telegramChatId: -100123456789,
      umamiWebsiteId: "id-1",
      schedule: {
        enabled: true,
        cron: "30 8 * * *",
        period: "yesterday" as const,
      },
    };

    const parsed = ProjectConfigSchema.parse(projectWithCron);
    expect(parsed.schedule.cron).toBe("30 8 * * *");
  });

  it("rejects invalid cron expression syntax", () => {
    const projectWithBadCron = {
      id: "shop",
      name: "فروشگاه",
      telegramChatId: -100123456789,
      umamiWebsiteId: "id-1",
      schedule: {
        enabled: true,
        cron: "invalid-cron-string",
        period: "yesterday" as const,
      },
    };

    expect(() => ProjectConfigSchema.parse(projectWithBadCron)).toThrow("Invalid cron expression format");
  });
});
