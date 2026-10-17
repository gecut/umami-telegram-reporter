import { Bot } from "grammy";
import { getEnv } from "../config/env";
import { loadProjects, type ProjectConfig } from "../config/projects";
import { UmamiClient } from "../umami/client";
import { generateReport } from "../report/coordinator";
import { renderPersianReport } from "../report/renderer";
import { Redactor } from "../lib/logger";

async function runDryRun(): Promise<void> {
  const isFixtureMode = process.argv.includes("--fixture");

  console.log("🚀 Starting Umami Telegram Reporter Dry-Run...\n");

  if (isFixtureMode) {
    console.log("📦 Mode: Offline Fixture Mode");
    await runFixtureDryRun();
    return;
  }

  // 1. Load Configurations
  console.log("1️⃣ Loading and validating configurations...");
  const env = getEnv();
  Redactor.registerSecret(env.TELEGRAM_BOT_TOKEN);
  Redactor.registerSecret(env.UMAMI_API_KEY);

  const registry = loadProjects(env.PROJECTS_CONFIG_PATH);
  const projects = registry.getAll();
  console.log(`   ✔ Loaded ${projects.length} project(s) from ${env.PROJECTS_CONFIG_PATH}`);

  const primaryProject = projects[0];
  if (!primaryProject) {
    throw new Error("No projects found in configuration.");
  }

  // 2. Verify Telegram Token via harmless getMe call
  console.log("\n2️⃣ Verifying Telegram Bot token via getMe()...");
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  try {
    const me = await bot.api.getMe();
    console.log(`   ✔ Connected to Telegram as @${me.username} (Bot ID: ${me.id})`);
  } catch (err) {
    console.error(`   ❌ Failed to verify Telegram Bot Token: ${Redactor.sanitize((err as Error).message)}`);
    console.error("   (Ensure TELEGRAM_BOT_TOKEN in .env is correct and outbound HTTPS is reachable)");
    process.exit(1);
  }

  // 3. Verify Umami API Connectivity
  console.log(`\n3️⃣ Verifying Umami API connectivity at ${env.UMAMI_BASE_URL}...`);
  const umamiClient = new UmamiClient({
    baseUrl: env.UMAMI_BASE_URL,
    apiKey: env.UMAMI_API_KEY,
  });

  try {
    const website = await umamiClient.getWebsite(primaryProject.umamiWebsiteId);
    console.log(`   ✔ Umami website verified: "${website.name}" (${website.domain}) [ID: ${website.id}]`);
  } catch (err) {
    console.warn(`   ⚠️ Could not fetch website metadata: ${(err as Error).message}`);
    console.warn(`   (Attempting direct stats read for ${primaryProject.umamiWebsiteId}...)`);
  }

  // 4. Generate Sample Report Locally
  console.log(`\n4️⃣ Generating sample local report for project "${primaryProject.name}" (yesterday)...`);
  try {
    const model = await generateReport(primaryProject, "yesterday", umamiClient);
    const reportHtml = renderPersianReport(model);

    console.log("\n" + "=".repeat(60));
    console.log("📝 GENERATED TELEGRAM REPORT OUTPUT (STDOUT ONLY):");
    console.log("=".repeat(60) + "\n");
    console.log(reportHtml);
    console.log("\n" + "=".repeat(60));
    console.log("✨ Dry-run successfully completed! Zero messages were dispatched to live groups.");
  } catch (err) {
    console.error(`   ❌ Error during report generation: ${Redactor.sanitize((err as Error).message)}`);
    process.exit(1);
  }
}

async function runFixtureDryRun(): Promise<void> {
  const sampleProject: ProjectConfig = {
    id: "sample-demo",
    name: "فروشگاه نمونه",
    telegramChatId: -100123456789,
    umamiWebsiteId: "mock-website-id-1234",
    timezone: "Asia/Tehran",
    schedule: {
      enabled: true,
      cron: "0 9 * * *",
      period: "yesterday",
    },
    trackedEvents: [
      { name: "add_to_cart", label: "افزودن به سبد" },
      { name: "checkout", label: "خرید نهایی" },
    ],
    utmBreakdowns: [
      { source: "Instagram", dimensions: ["utmContent"] },
    ],
  };

  const mockClient = new UmamiClient({
    baseUrl: "https://mock.umami.internal",
    apiKey: "mock-api-key",
    fetchFn: async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/stats")) {
        return new Response(
          JSON.stringify({
            pageviews: 4200,
            visitors: 1840,
            visits: 2150,
            bounces: 650,
            totaltime: 320000,
            comparison: {
              pageviews: 3800,
              visitors: 1650,
              visits: 1980,
              bounces: 700,
              totaltime: 290000,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("type=path")) {
        return new Response(
          JSON.stringify([
            { x: "/", y: 920 },
            { x: "/products/wood-table", y: 450 },
            { x: "/checkout", y: 180 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("type=referrer")) {
        return new Response(
          JSON.stringify([
            { x: "google.com", y: 740 },
            { x: "t.me", y: 310 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("type=utmSource")) {
        return new Response(
          JSON.stringify([
            { x: "Instagram", y: 380 },
            { x: "Telegram", y: 190 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("type=utmContent")) {
        return new Response(
          JSON.stringify([
            { x: "Story", y: 220 },
            { x: "Bio", y: 160 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("type=event")) {
        return new Response(
          JSON.stringify([
            { x: "add_to_cart", y: 48 },
            { x: "checkout", y: 16 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    },
  });

  const model = await generateReport(sampleProject, "yesterday", mockClient);
  const reportHtml = renderPersianReport(model);

  console.log("\n" + "=".repeat(60));
  console.log("📝 GENERATED MOCK FIXTURE REPORT:");
  console.log("=".repeat(60) + "\n");
  console.log(reportHtml);
  console.log("\n" + "=".repeat(60));
  console.log("✨ Offline fixture dry-run completed successfully!");
}

if (import.meta.main) {
  runDryRun().catch((err) => {
    console.error(`Dry-run encountered an error: ${Redactor.sanitize((err as Error).message)}`);
    process.exit(1);
  });
}
