import { writeFileSync, unlinkSync } from "node:fs";
import { getEnv } from "./config/env";
import { loadProjects } from "./config/projects";
import { UmamiClient } from "./umami/client";
import { createReporterBot } from "./telegram/bot";
import { SchedulerEngine } from "./scheduler/engine";
import { logger, Redactor } from "./lib/logger";

const HEARTBEAT_FILE = "/tmp/heartbeat.json";

function updateHeartbeat(): void {
  try {
    writeFileSync(
      HEARTBEAT_FILE,
      JSON.stringify({
        status: "ok",
        timestamp: Date.now(),
        uptime: Math.round(process.uptime()),
      }),
      "utf-8"
    );
  } catch {
    // Ignore temporary fs write glitches in /tmp
  }
}

async function main(): Promise<void> {
  console.log("🚀 Initializing Umami Telegram Reporter service...\n");

  // 1. Load and validate configurations
  const env = getEnv();
  logger.setLevel(env.LOG_LEVEL);

  // Register secrets for token redaction in all logs
  Redactor.registerSecret(env.TELEGRAM_BOT_TOKEN);
  Redactor.registerSecret(env.UMAMI_API_KEY);

  logger.info("[Main] Loading project configurations...", { path: env.PROJECTS_CONFIG_PATH });
  const projectRegistry = loadProjects(env.PROJECTS_CONFIG_PATH);
  const projects = projectRegistry.getAll();
  logger.info(`[Main] Successfully loaded ${projects.length} project(s).`);

  // 2. Initialize Read-Only Umami Client
  const umamiClient = new UmamiClient({
    baseUrl: env.UMAMI_BASE_URL,
    apiKey: env.UMAMI_API_KEY,
    timeoutMs: env.UMAMI_TIMEOUT_MS,
  });

  // 3. Initialize Telegram Bot
  logger.info("[Main] Initializing Telegram bot engine...");
  const bot = createReporterBot({
    token: env.TELEGRAM_BOT_TOKEN,
    projectRegistry,
    umamiClient,
  });

  // 4. Initialize and Start Scheduler
  const scheduler = new SchedulerEngine({
    bot,
    projectRegistry,
    umamiClient,
  });
  scheduler.start();

  // 5. Start Heartbeat Watchdog
  updateHeartbeat();
  const heartbeatInterval = setInterval(updateHeartbeat, 15_000);

  // 6. Setup Graceful Shutdown
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`[Shutdown] Received ${signal}. Stopping services gracefully...`);

    clearInterval(heartbeatInterval);
    try {
      unlinkSync(HEARTBEAT_FILE);
    } catch {
      // Ignore if file already removed
    }

    try {
      await scheduler.stop();
      await bot.stop();
      logger.info("[Shutdown] All background services stopped cleanly.");
      process.exit(0);
    } catch (err) {
      logger.error("[Shutdown] Error occurred during shutdown", err);
      process.exit(1);
    }
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  // 7. Launch Telegram Long Polling
  logger.info("[Main] Starting Telegram long polling listener...");
  await bot.start({
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"],
    onStart: (botInfo) => {
      logger.info(`[Telegram] Bot polling active as @${botInfo.username} (ID: ${botInfo.id})`);
      console.log(`\n✨ Umami Telegram Reporter is running as @${botInfo.username}\n`);
    },
  });
}

if (import.meta.main) {
  main().catch((err) => {
    logger.error("[Fatal] Unhandled exception during startup", err);
    console.error(`\n❌ Fatal startup error: ${Redactor.sanitize((err as Error).message)}`);
    process.exit(1);
  });
}
