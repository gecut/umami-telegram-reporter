import { describe, it, expect } from "bun:test";
import type { ProjectConfig } from "../../src/config/projects";
import { UmamiClient } from "../../src/umami/client";
import { generateReport } from "../../src/report/coordinator";
import { renderPersianReport } from "../../src/report/renderer";
import { calculateDelta } from "../../src/lib/percentage";

describe("Report Coordinator & Persian Renderer", () => {
  const sampleProject: ProjectConfig = {
    id: "test-proj",
    name: "فروشگاه تست",
    telegramChatId: -100123456,
    umamiWebsiteId: "test-uuid-1",
    timezone: "Asia/Tehran",
    schedule: { enabled: true, cron: "0 9 * * *", period: "yesterday" },
    trackedEvents: [
      { name: "signup", label: "ثبت‌نام کاربر" },
      { name: "purchase", label: "خرید نهایی" },
    ],
    utmBreakdowns: [
      { source: "Instagram", dimensions: ["utmContent"] },
    ],
  };

  it("coordinates and renders a complete Persian report from mock responses", async () => {
    const mockClient = new UmamiClient({
      baseUrl: "https://mock.umami.local",
      apiKey: "test-key",
      fetchFn: async (url: string | URL | Request) => {
        const u = url.toString();
        if (u.includes("/stats")) {
          return new Response(
            JSON.stringify({
              pageviews: 1000,
              visitors: 400,
              visits: 500,
              bounces: 150,
              totaltime: 60000,
              comparison: {
                pageviews: 800,
                visitors: 350,
                visits: 450,
                bounces: 160,
                totaltime: 50000,
              },
            }),
            { status: 200 }
          );
        }
        if (u.includes("type=path")) {
          return new Response(
            JSON.stringify([
              { x: "/home", y: 300 },
              { x: "/cart", y: 100 },
            ]),
            { status: 200 }
          );
        }
        if (u.includes("type=referrer")) {
          return new Response(
            JSON.stringify([{ x: "google.com", y: 250 }]),
            { status: 200 }
          );
        }
        if (u.includes("type=utmSource")) {
          return new Response(
            JSON.stringify([{ x: "Instagram", y: 150 }]),
            { status: 200 }
          );
        }
        if (u.includes("type=utmContent")) {
          return new Response(
            JSON.stringify([{ x: "Story", y: 90 }, { x: "Bio", y: 60 }]),
            { status: 200 }
          );
        }
        if (u.includes("type=event")) {
          return new Response(
            JSON.stringify([
              { x: "signup", y: 25 },
              { x: "purchase", y: 10 },
            ]),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      },
    });

    const model = await generateReport(sampleProject, "yesterday", mockClient);
    expect(model.summary.visitors.value).toBe(400);
    expect(model.summary.visitors.delta.percent).toBeCloseTo(14.3, 1);
    expect(model.topPages.length).toBe(2);
    expect(model.events.length).toBe(2);
    expect(model.events[0]?.label).toBe("ثبت‌نام کاربر");

    const html = renderPersianReport(model);
    expect(html).toContain("فروشگاه تست");
    expect(html).toContain("کاربران یکتا");
    expect(html).toContain("ثبت‌نام کاربر: 25");
    expect(html).toContain("خرید نهایی: 10");
    expect(html).toContain("Instagram");
    expect(html).toContain("<code>Story</code>: 90");
    expect(html).toContain("<code>Bio</code>: 60");
  });

  it("handles zero traffic gracefully with polite Persian notice", async () => {
    const mockClient = new UmamiClient({
      baseUrl: "https://mock.umami.local",
      apiKey: "test-key",
      fetchFn: async (url: string | URL | Request) => {
        const u = url.toString();
        if (u.includes("/stats")) {
          return new Response(
            JSON.stringify({
              pageviews: 0,
              visitors: 0,
              visits: 0,
              bounces: 0,
              totaltime: 0,
            }),
            { status: 200 }
          );
        }
        return new Response("[]", { status: 200 });
      },
    });

    const model = await generateReport(sampleProject, "yesterday", mockClient);
    const html = renderPersianReport(model);

    expect(html).toContain("هیچ ترافیکی برای وب‌سایت ثبت نشده است");
    expect(html).not.toContain("NaN");
  });

  it("degrades gracefully when optional metric query fails", async () => {
    const mockClient = new UmamiClient({
      baseUrl: "https://mock.umami.local",
      apiKey: "test-key",
      fetchFn: async (url: string | URL | Request) => {
        const u = url.toString();
        if (u.includes("/stats")) {
          return new Response(
            JSON.stringify({
              pageviews: 50,
              visitors: 20,
              visits: 25,
              bounces: 5,
              totaltime: 1000,
            }),
            { status: 200 }
          );
        }
        if (u.includes("type=path")) {
          // Simulate 500 error on path metrics
          return new Response("Internal Server Error", { status: 500 });
        }
        return new Response("[]", { status: 200 });
      },
    });

    const model = await generateReport(sampleProject, "yesterday", mockClient);
    expect(model.summary.visitors.value).toBe(20);
    expect(model.topPages.length).toBe(0);
    expect(model.warnings.length).toBeGreaterThan(0);

    const html = renderPersianReport(model);
    expect(html).toContain("امکان دریافت فهرست صفحات پربازدید وجود نداشت");
  });

  it("escapes malicious HTML injection in page paths and referrers", async () => {
    const mockClient = new UmamiClient({
      baseUrl: "https://mock.umami.local",
      apiKey: "test-key",
      fetchFn: async (url: string | URL | Request) => {
        const u = url.toString();
        if (u.includes("/stats")) {
          return new Response(
            JSON.stringify({ pageviews: 10, visitors: 5, visits: 5, bounces: 0, totaltime: 100 }),
            { status: 200 }
          );
        }
        if (u.includes("type=path")) {
          return new Response(
            JSON.stringify([{ x: "<script>alert('xss')</script>", y: 5 }]),
            { status: 200 }
          );
        }
        return new Response("[]", { status: 200 });
      },
    });

    const model = await generateReport(sampleProject, "yesterday", mockClient);
    const html = renderPersianReport(model);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert('xss')&lt;/script&gt;");
  });

  it("safely truncates long reports without breaking HTML tags", () => {
    // Construct a model with 100 long page entries that exceed 3800 chars
    const bigModel = {
      projectId: "big-proj",
      projectName: "پروژه بزرگ",
      websiteId: "w1",
      timezone: "Asia/Tehran",
      period: "yesterday" as const,
      periodLabel: "دیروز",
      generatedAt: new Date(),
      summary: {
        visitors: { value: 100, previous: 90, delta: calculateDelta(100, 90) },
        visits: { value: 120, previous: 100, delta: calculateDelta(120, 100) },
        pageviews: { value: 500, previous: 400, delta: calculateDelta(500, 400) },
        bounceRate: { value: 30, previous: 35, delta: calculateDelta(30, 35, { invertPolarity: true }) },
        avgDurationSeconds: { value: 120, previous: 100, delta: calculateDelta(120, 100) },
      },
      topPages: Array.from({ length: 150 }, (_, i) => ({
        name: `/very/long/path/name/for/testing/truncation/safety/page_${i}`,
        count: 100 - i,
      })),
      topReferrers: [],
      utmSources: [],
      utmBreakdowns: [],
      events: [],
      warnings: [],
    };

    const rendered = renderPersianReport(bigModel);
    expect(rendered.length).toBeLessThanOrEqual(4096);
    expect(rendered).toContain("...(ادامه موارد به علت محدودیت طول پیام خلاصه شد)");
    // Check that tags are not broken (e.g. no dangling <code without >)
    const openCodes = (rendered.match(/<code>/g) || []).length;
    const closeCodes = (rendered.match(/<\/code>/g) || []).length;
    expect(openCodes).toBe(closeCodes);
  });
});
