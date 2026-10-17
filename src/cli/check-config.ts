import { existsSync } from "node:fs";
import { getEnv } from "../config/env";
import { loadProjects } from "../config/projects";

function runConfigCheck(): void {
  console.log("🔍 Checking Umami Telegram Reporter configuration...\n");

  let hasErrors = false;

  // 1. Check Environment Variables
  try {
    const env = getEnv();
    console.log("✅ Environment Variables (.env):");
    console.log(`   - UMAMI_BASE_URL: ${env.UMAMI_BASE_URL}`);
    console.log(`   - TELEGRAM_BOT_TOKEN: [CONFIGURED - ${env.TELEGRAM_BOT_TOKEN.slice(0, 6)}...]`);
    console.log(`   - UMAMI_API_KEY: [CONFIGURED]`);
    console.log(`   - PROJECTS_CONFIG_PATH: ${env.PROJECTS_CONFIG_PATH}`);
    console.log(`   - LOG_LEVEL: ${env.LOG_LEVEL}`);
  } catch (err) {
    console.error("❌ Environment validation error:");
    console.error(`   ${(err as Error).message}\n`);
    hasErrors = true;
  }

  // 2. Check Projects Configuration File
  const projectsPath =
    process.env["PROJECTS_CONFIG_PATH"] ??
    (process.argv.includes("--example") || !existsSync("./projects.json")
      ? "./projects.example.json"
      : "./projects.json");

  try {
    const registry = loadProjects(projectsPath);
    const projects = registry.getAll();

    console.log(`\n✅ Projects Configuration (${projectsPath}):`);
    console.log(`   - Total Projects: ${projects.length}`);

    for (const p of projects) {
      console.log(`   👉 Project "${p.id}" (${p.name}):`);
      console.log(`      • Telegram Chat ID: ${p.telegramChatId}`);
      console.log(`      • Umami Website ID: ${p.umamiWebsiteId}`);
      console.log(`      • Timezone: ${p.timezone}`);
      console.log(`      • Schedule: ${p.schedule.enabled ? `Enabled (${p.schedule.cron} - ${p.schedule.period})` : "Disabled"}`);
      console.log(`      • Tracked Events: ${p.trackedEvents.length} configured`);
      console.log(`      • UTM Breakdowns: ${p.utmBreakdowns.length} configured`);
    }
  } catch (err) {
    console.error(`\n❌ Project configuration validation error (${projectsPath}):`);
    console.error(`   ${(err as Error).message}\n`);
    hasErrors = true;
  }

  if (hasErrors) {
    console.error("\n❌ Configuration check FAILED. Please resolve errors above.");
    process.exit(1);
  } else {
    console.log("\n✨ All configurations are structurally VALID!");
  }
}

if (import.meta.main) {
  runConfigCheck();
}
