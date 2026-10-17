# Vendor Specification: Telegram Bot API

- **Vendor / Platform**: Telegram Messenger Inc.
- **Canonical Source**: `https://core.telegram.org/bots/api`
- **Retrieval Date**: 2026-10-17

---

## 1. Group Interaction & Privacy Mode

### Privacy Mode Invariants
- Enabled by default for all bots created via `@BotFather`.
- In group chats with Privacy Mode **enabled**, the bot receives only:
  1. Messages starting with a slash `/` (commands).
  2. Messages that @mention the bot by its username (`@BotUsername`).
  3. Direct replies to messages previously sent by the bot.
  4. Service messages (e.g. chat title changes, new members).
- Group members' normal conversational text is completely invisible to the bot.
- **Requirement**: Maintain Privacy Mode enabled; request zero group admin privileges.

### Group Command Syntax
- When users type `/report` in a group, Telegram clients autocomplete as `/report@BotUsername <args>` to prevent ambiguity between multiple bots.
- The command dispatcher must support both `/report <args>` and `/report@BotUsername <args>`.

---

## 2. Message Formatting & Entity Sanitization

### HTML Parse Mode
- Telegram supports HTML formatting using a strict subset of HTML tags:
  - `<b>bold</b>`, `<strong>bold</strong>`
  - `<i>italic</i>`, `<em>italic</em>`
  - `<code>inline fixed-width code</code>`
  - `<pre>pre-formatted fixed-width code block</pre>`
  - `<a href="https://...">inline link</a>`
  - `<blockquote>expandable or blockquote</blockquote>`
- **Escaping Rule**: All user-originating or dynamic strings interpolated into HTML must have these 4 characters replaced with HTML entities:
  - `&` $\rightarrow$ `&amp;`
  - `<` $\rightarrow$ `&lt;`
  - `>` $\rightarrow$ `&gt;`
  - `"` $\rightarrow$ `&quot;`
- **MarkdownV2 Warning**: MarkdownV2 requires escaping 18 special characters. A single unescaped dot, hyphen, or underscore causes an unrecoverable `400 Bad Request: can't parse entities` error. HTML is strictly mandatory for dynamic web analytics reporting.

### Message Size Limits
- Maximum length: **4,096 UTF-8 characters** per message.
- Reports exceeding 4,000 characters must be defensively truncated to avoid HTTP 400 delivery rejection.

---

## 3. Rate Limits & Flood Control
- **Global Bot Limit**: 30 messages per second across all chats.
- **Individual Group Limit**: 1 message per second; max 20 messages per minute in a single group.
- **Flood Control (429)**:
  When exceeded, Telegram returns HTTP 429 with `parameters.retry_after` (number of seconds). The client must wait `retry_after` seconds before resending.
- **Scheduled Broadcast Staggering**: Sequential iteration with a minimum 500ms delay between sending scheduled reports to different chats.

---

## 4. Long Polling & HTTP 409 Conflict
- Method: `getUpdates` with `timeout` parameter (long polling).
- **Strict Single-Listener Invariant**:
  Telegram permits only one concurrent `getUpdates` session per bot token. If two processes or container instances attempt to poll simultaneously:
  - The older connection is immediately terminated with:
    `HTTP 409 Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`
  - Both containers enter an infinite conflict loop.
- **Deployment Requirement**: Strictly run a single replica (`replicas: 1`).
