import { describe, it, expect } from "bun:test";
import { SchedulerEngine } from "../../src/scheduler/engine";
import { ProjectRegistry, ProjectConfigSchema, type ProjectConfig } from "../../src/config/projects";
import { UmamiClient } from "../../src/umami/client";
import type { Bot } from "grammy";

describe("SchedulerEngine", () => {
  const sampleProjects: ProjectConfig[] = [
    ProjectConfigSchema.parse({
      id: "scheduled-proj-1",
      name: "پروژه زمان‌بندی‌شده یک",
      telegramChatId: -100111111,
      umamiWebsiteId: "uuid-1",
      timezone: "Asia/Tehran",
      schedule: { enabled: true, cron: "0 9 * * *", period: "yesterday" },
      trackedEvents: [],
      utmBreakdowns: [],
    }),
    ProjectConfigSchema.parse({
      id: "scheduled-proj-2",
      name: "پروژه زمان‌بندی‌شده دو",
      telegramChatId: -100222222,
      umamiWebsiteId: "uuid-2",
      timezone: "UTC",
      schedule: { enabled: true, cron: "0 10 * * *", period: "today" },
      trackedEvents: [],
      utmBreakdowns: [],
    }),
    ProjectConfigSchema.parse({
      id: "manual-only-proj",
      name: "پروژه دستی",
      telegramChatId: -100333333,
      umamiWebsiteId: "uuid-3",
      timezone: "Asia/Tehran",
      schedule: { enabled: false, cron: "0 9 * * *", period: "yesterday" },
      trackedEvents: [],
      utmBreakdowns: [],
    }),
  ];

  it("registers cron jobs only for enabled scheduled projects", async () => {
    const registry = new ProjectRegistry(sampleProjects);
    const sentMessages: Array<{ chatId: number; text: string }> = [];

    const mockBot = {
      api: {
        sendMessage: async (chatId: number, text: string) => {
          sentMessages.push({ chatId, text });
          return { message_id: 1 };
        },
      },
    } as unknown as Bot;

    const mockUmami = new UmamiClient({
      baseUrl: "https://mock.umami.local",
      apiKey: "test-key",
      fetchFn: async () => {
        return new Response(
          JSON.stringify({
            pageviews: 100,
            visitors: 50,
            visits: 60,
            bounces: 10,
            totaltime: 1200,
          }),
          { status: 200 }
        );
      },
    });

    const scheduler = new SchedulerEngine({
      bot: mockBot,
      projectRegistry: registry,
      umamiClient: mockUmami,
      interMessageDelayMs: 10,
    });

    scheduler.start();
    // 2 out of 3 projects have schedule.enabled: true
    expect(scheduler.getJobsCount()).toBe(2);

    await scheduler.stop();
    expect(scheduler.getJobsCount()).toBe(0);
  });

  it("dispatches scheduled report directly to the target project chat", async () => {
    const registry = new ProjectRegistry(sampleProjects);
    const sentMessages: Array<{ chatId: number; text: string }> = [];

    const mockBot = {
      api: {
        sendMessage: async (chatId: number, text: string) => {
          sentMessages.push({ chatId, text });
          return { message_id: 1 };
        },
      },
    } as unknown as Bot;

    const mockUmami = new UmamiClient({
      baseUrl: "https://mock.umami.local",
      apiKey: "test-key",
      fetchFn: async () => {
        return new Response(
          JSON.stringify({
            pageviews: 200,
            visitors: 80,
            visits: 90,
            bounces: 15,
            totaltime: 3000,
          }),
          { status: 200 }
        );
      },
    });

    const scheduler = new SchedulerEngine({
      bot: mockBot,
      projectRegistry: registry,
      umamiClient: mockUmami,
      interMessageDelayMs: 10,
    });

    const projectToDispatch = sampleProjects[0]!;
    await scheduler.dispatchProjectReport(projectToDispatch);

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0]?.chatId).toBe(-100111111);
    expect(sentMessages[0]?.text).toContain("پروژه زمان‌بندی‌شده یک");
    expect(sentMessages[0]?.text).toContain("افراد بازدیدکننده");

    await scheduler.stop();
  });
});
