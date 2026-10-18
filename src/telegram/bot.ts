import { Bot, GrammyError, HttpError } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import type { ProjectRegistry } from "../config/projects";
import type { UmamiClient } from "../umami/client";
import { generateReport } from "../report/coordinator";
import { renderPersianReport } from "../report/renderer";
import { ChatRateLimiter } from "./rate-limiter";
import { logger } from "../lib/logger";
import { wrapRtlLine } from "../lib/format";
import { escapeHtml } from "../lib/html";
import type { DateWindowType } from "../lib/dates";

export interface BotContextOptions {
  token: string;
  projectRegistry: ProjectRegistry;
  umamiClient: UmamiClient;
  rateLimiter?: ChatRateLimiter;
}

export function parsePeriodArgument(arg: string): DateWindowType | null {
  const clean = arg.trim().toLowerCase();
  if (!clean || clean === "yesterday" || clean === "دیروز") {
    return "yesterday";
  }
  if (clean === "today" || clean === "امروز") {
    return "today";
  }
  if (clean === "7d" || clean === "هفته" || clean === "week") {
    return "7d";
  }
  if (clean === "30d" || clean === "ماه" || clean === "month") {
    return "30d";
  }
  return null;
}

export function createReporterBot(options: BotContextOptions): Bot {
  const { token, projectRegistry, umamiClient } = options;
  const rateLimiter = options.rateLimiter ?? new ChatRateLimiter(15);

  const bot = new Bot(token);

  // Auto-retry Telegram rate limits (429) and network blips
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 60,
    })
  );

  // Command: /start
  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id;
    const project = projectRegistry.findByChatId(chatId);

    if (!project) {
      await ctx.reply(
        wrapRtlLine(
          `🔒 <b>چت غیرمجاز</b>\nاین چت برای دریافت آمار ثبت نشده است.\nشناسه چت شما: <code>${chatId}</code>`
        ),
        { parse_mode: "HTML" }
      );
      return;
    }

    await ctx.reply(
      wrapRtlLine(
        `👋 سلام! ربات گزارش‌دهی تحلیلی امامی برای پروژه <b>${escapeHtml(project.name)}</b> آماده به کار است.\n\nبرای دریافت گزارش از دستور /report استفاده کنید.`
      ),
      { parse_mode: "HTML" }
    );
  });

  // Command: /help
  bot.command("help", async (ctx) => {
    await ctx.reply(
      wrapRtlLine(
        `📚 <b>راهنمای دستورات ربات آمارگیر امامی</b>\n\n` +
          `🔹 <code>/report</code> — دریافت گزارش روز گذشته (پیش‌فرض)\n` +
          `🔹 <code>/report today</code> (یا <code>امروز</code>) — آمار لحظه‌ای از بامداد امروز تا الان\n` +
          `🔹 <code>/report yesterday</code> (یا <code>دیروز</code>) — آمار کامل روز گذشته\n` +
          `🔹 <code>/report 7d</code> (یا <code>هفته</code>) — گزارش تحلیلی ۷ روز گذشته\n` +
          `🔹 <code>/report 30d</code> (یا <code>ماه</code>) — گزارش تحلیلی ۳۰ روز گذشته\n` +
          `🔹 <code>/status</code> — وضعیت اتصال ربات به پروژه\n` +
          `🔹 <code>/help</code> — نمایش این راهنما\n\n` +
          `💡 <i>در گروه‌ها می‌توانید دستورات را به شکل /report@BotName نیز ارسال فرمایید.</i>`
      ),
      { parse_mode: "HTML" }
    );
  });

  // Command: /status
  bot.command("status", async (ctx) => {
    const chatId = ctx.chat.id;
    const project = projectRegistry.findByChatId(chatId);

    if (!project) {
      await ctx.reply(
        wrapRtlLine(
          `🔒 <b>چت غیرمجاز</b>\nاین چت در سامانه ثبت نشده است.\nشناسه چت: <code>${chatId}</code>`
        ),
        { parse_mode: "HTML" }
      );
      return;
    }

    const scheduleStatus = project.schedule.enabled
      ? `فعال (کرون: <code>${escapeHtml(project.schedule.cron)}</code> — دوره: ${escapeHtml(project.schedule.period)})`
      : "غیرفعال";

    await ctx.reply(
      wrapRtlLine(
        `🤖 <b>وضعیت اتصال پروژه</b>\n\n` +
          `🌐 <b>نام پروژه</b>: ${escapeHtml(project.name)}\n` +
          `🆔 <b>شناسه پروژه</b>: <code>${escapeHtml(project.id)}</code>\n` +
          `🕒 <b>منطقه زمانی</b>: <code>${escapeHtml(project.timezone)}</code>\n` +
          `⏰ <b>گزارش خودکار</b>: ${scheduleStatus}\n` +
          `💬 <b>شناسه چت تلگرام</b>: <code>${chatId}</code>`
      ),
      { parse_mode: "HTML" }
    );
  });

  // Command: /report [period]
  bot.command("report", async (ctx) => {
    const chatId = ctx.chat.id;
    const project = projectRegistry.findByChatId(chatId);

    // 1. Authorization check
    if (!project) {
      logger.warn(`[Telegram] Unauthorized /report attempted from chat ${chatId}`);
      await ctx.reply(
        wrapRtlLine(
          `🔒 <b>چت غیرمجاز</b>\nاین چت برای دریافت آمار ثبت نشده است.\nشناسه چت: <code>${chatId}</code>`
        ),
        { parse_mode: "HTML" }
      );
      return;
    }

    // 2. Rate limiting check
    const rateCheck = rateLimiter.check(chatId);
    if (!rateCheck.allowed) {
      await ctx.reply(
        wrapRtlLine(
          `⏳ لطفاً <b>${rateCheck.remainingSeconds} ثانیه</b> دیگر مجدداً تلاش کنید.`
        ),
        { parse_mode: "HTML" }
      );
      return;
    }

    // 3. Parse period argument
    const period = parsePeriodArgument(ctx.match ?? "");
    if (!period) {
      await ctx.reply(
        wrapRtlLine(
          `⚠️ بازه زمانی وارد شده نامعتبر است.\n` +
            `دوره‌های مجاز: <code>today</code>, <code>yesterday</code>, <code>7d</code>, <code>30d</code>\n` +
            `مثال: <code>/report 7d</code>`
        ),
        { parse_mode: "HTML" }
      );
      return;
    }

    // 4. Send typing indicator periodically while processing
    await ctx.replyWithChatAction("typing").catch(() => {});
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);

    // 5. Generate and render report
    try {
      const model = await generateReport(project, period, umamiClient);
      const reportHtml = renderPersianReport(model);

      await ctx.reply(reportHtml, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      logger.error(`[Telegram] Error generating report for ${project.id}`, err);
      await ctx.reply(
        wrapRtlLine(
          `⚠️ در حال حاضر امکان دریافت اطلاعات از سرور امامی وجود ندارد. لطفاً دقایقی دیگر مجدداً تلاش نمایید.`
        ),
        { parse_mode: "HTML" }
      );
    } finally {
      clearInterval(typingInterval);
    }
  });

  // Centralized Error Handling
  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) {
      if (e.error_code === 409) {
        logger.error("[Telegram] Fatal 409 Conflict: Another bot instance is running. Exiting...");
        process.exit(1);
      }
      logger.error(`[Telegram] GrammyError (${e.error_code}): ${e.description}`);
    } else if (e instanceof HttpError) {
      logger.error("[Telegram] Network HttpError connecting to Telegram API", e);
    } else {
      logger.error("[Telegram] Unexpected runtime error in middleware", e);
    }
  });

  return bot;
}
