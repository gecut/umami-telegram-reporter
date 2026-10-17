# Vendor Specification: grammY Telegram Framework

- **Vendor / Framework**: grammY
- **Canonical Source**: `https://grammy.dev`
- **Retrieval Date**: 2026-10-17

---

## 1. Bot Initialization & Group Command Handling

```typescript
import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Auto-retry Telegram 429 flood errors automatically
bot.api.config.use(
  autoRetry({
    maxRetryAttempts: 3,
    maxDelaySeconds: 60,
  })
);
```

### Group Command Parsing
When `bot.command("report", handler)` is registered:
- grammY automatically matches both `/report` and `/report@BotUsername`.
- The remainder of the text following the command is populated into `ctx.match` (trimmed string).
- For example:
  - User sends: `/report@UmamiBot 7d`
  - `ctx.match` = `"7d"`

---

## 2. Error Handling & 409 Conflict Detection

```typescript
import { GrammyError, HttpError } from "grammy";

bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) {
    if (e.error_code === 409) {
      console.error("[Telegram] Fatal 409 Conflict: Another bot instance is polling. Terminating...");
      process.exit(1);
    }
    console.error(`[Telegram] GrammyError (${e.error_code}): ${e.description}`);
  } else if (e instanceof HttpError) {
    console.error("[Telegram] Network HttpError:", e);
  } else {
    console.error("[Telegram] Unexpected Error:", e);
  }
});
```

---

## 3. Long Polling Lifecycle

```typescript
// Start long polling with drop_pending_updates to ignore stale backlog on startup
await bot.start({
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query"],
  onStart: (botInfo) => {
    console.log(`[Telegram] Bot started as @${botInfo.username}`);
  },
});

// Graceful shutdown on signal:
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
```
