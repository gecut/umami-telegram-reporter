import { Cron } from "croner";
import type { Bot } from "grammy";
import type { ProjectConfig, ProjectRegistry } from "../config/projects";
import type { UmamiClient } from "../umami/client";
import { generateReport } from "../report/coordinator";
import { renderPersianReport } from "../report/renderer";
import { logger } from "../lib/logger";

export interface SchedulerOptions {
  bot: Bot;
  projectRegistry: ProjectRegistry;
  umamiClient: UmamiClient;
  interMessageDelayMs?: number;
}

export class SchedulerEngine {
  private readonly bot: Bot;
  private readonly projectRegistry: ProjectRegistry;
  private readonly umamiClient: UmamiClient;
  private readonly interMessageDelayMs: number;
  private readonly jobs: Cron[] = [];
  private readonly inFlightTasks: Set<Promise<void>> = new Set();
  private dispatchQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private isStopped = false;

  constructor(options: SchedulerOptions) {
    this.bot = options.bot;
    this.projectRegistry = options.projectRegistry;
    this.umamiClient = options.umamiClient;
    this.interMessageDelayMs = options.interMessageDelayMs ?? 500;
  }

  /**
   * Initializes cron jobs for all scheduled projects.
   */
  public start(): void {
    const projects = this.projectRegistry.getAll();
    let scheduledCount = 0;

    for (const project of projects) {
      if (!project.schedule.enabled) {
        continue;
      }

      const job = new Cron(
        project.schedule.cron,
        {
          timezone: project.timezone,
          protect: true, // Prevent concurrent execution if previous run is still sending
          catch: (err) => {
            logger.error(`[Scheduler] Cron execution failed for project ${project.id}`, err);
          },
        },
        () => {
          if (this.isStopped) return;
          this.enqueueDispatch(project);
        }
      );

      this.jobs.push(job);
      scheduledCount++;

      const nextRun = job.nextRun();
      logger.info(
        `[Scheduler] Scheduled project "${project.id}" (${project.schedule.cron} ${project.timezone}) — Next: ${nextRun?.toISOString() ?? "never"}`
      );
    }

    logger.info(`[Scheduler] Engine started with ${scheduledCount} active scheduled project(s).`);
  }

  private enqueueDispatch(project: ProjectConfig): void {
    this.dispatchQueue.push(async () => {
      await this.dispatchProjectReport(project);
    });
    this.processQueue().catch((err) => {
      logger.error("[Scheduler] Error in dispatch queue processor", err);
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.isStopped) return;
    this.isProcessingQueue = true;

    try {
      while (this.dispatchQueue.length > 0 && !this.isStopped) {
        const task = this.dispatchQueue.shift();
        if (task) {
          await task();
          if (this.interMessageDelayMs > 0 && this.dispatchQueue.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.interMessageDelayMs));
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Executes report generation and dispatches it to Telegram for a single project.
   */
  public async dispatchProjectReport(project: ProjectConfig): Promise<void> {
    if (this.isStopped) return;
    logger.info(`[Scheduler] Dispatching scheduled report for project "${project.id}"`);

    const sendTask = (async () => {
      try {
        const model = await generateReport(project, project.schedule.period, this.umamiClient);
        const reportHtml = renderPersianReport(model);

        await this.bot.api.sendMessage(project.telegramChatId, reportHtml, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });

        logger.info(`[Scheduler] Scheduled report successfully delivered to chat ${project.telegramChatId}`);
      } catch (err) {
        logger.error(`[Scheduler] Failed to generate/send scheduled report for project "${project.id}"`, err);
      }
    })();

    this.inFlightTasks.add(sendTask);
    try {
      await sendTask;
    } finally {
      this.inFlightTasks.delete(sendTask);
    }
  }

  /**
   * Stops all active cron schedules cleanly and awaits in-flight dispatches.
   */
  public async stop(): Promise<void> {
    this.isStopped = true;
    logger.info(`[Scheduler] Stopping ${this.jobs.length} scheduled jobs...`);
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs.length = 0;
    this.dispatchQueue = [];

    if (this.inFlightTasks.size > 0) {
      logger.info(`[Scheduler] Awaiting ${this.inFlightTasks.size} in-flight dispatch tasks to complete...`);
      await Promise.race([
        Promise.allSettled(Array.from(this.inFlightTasks)),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      logger.info("[Scheduler] In-flight dispatch tasks settled.");
    }
  }

  public getJobsCount(): number {
    return this.jobs.length;
  }
}
