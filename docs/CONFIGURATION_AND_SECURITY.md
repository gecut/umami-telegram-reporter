# Configuration and Security Architecture

## 1. Secrets Separation Model

The service strictly separates runtime secrets from multi-project topology:

| Category | Storage Medium | Examples | Committed to Git? |
| :--- | :--- | :--- | :--- |
| **Secrets & Endpoints** | Environment Variables (`.env`) | `TELEGRAM_BOT_TOKEN`, `UMAMI_API_KEY`, `UMAMI_BASE_URL` | **NEVER** (enforced by `.gitignore`) |
| **Project Topologies** | Declarative Config (`projects.json`) | `telegramChatId`, `umamiWebsiteId`, `timezone`, `trackedEvents` | Yes (or mounted volume) |

### Environment Variables Schema
Validated on startup via Zod:
```typescript
{
  TELEGRAM_BOT_TOKEN: string, // Regex /^\d{8,10}:[A-Za-z0-9_-]{35}$/
  UMAMI_BASE_URL: string,     // URL, e.g. https://api.umami.is/v1 or https://analytics.company.com/api
  UMAMI_API_KEY: string,      // Umami Cloud API key or self-hosted bearer token
  LOG_LEVEL: "debug" | "info" | "warn" | "error" (default: "info")
}
```

---

## 2. Project Configuration (`projects.json`)

```json
[
  {
    "id": "choobino",
    "name": "چوبینو",
    "telegramChatId": -1001234567890,
    "umamiWebsiteId": "b3e34b45-21dc-4a37-b769-cf4d97f5b801",
    "timezone": "Asia/Tehran",
    "schedule": {
      "enabled": true,
      "cron": "0 9 * * *",
      "period": "yesterday"
    },
    "trackedEvents": [
      { "name": "add_to_cart", "label": "افزودن به سبد" },
      { "name": "purchase_complete", "label": "خرید نهایی" }
    ],
    "utmBreakdowns": [
      { "source": "Instagram", "dimensions": ["utmContent"] }
    ]
  }
]
```

### Whitelist & Zero-Leak Access Control
1. **Direct Chat Mapping**:
   Incoming Telegram updates carry `ctx.chat.id`. The dispatcher checks if `ctx.chat.id` exists in `projects.json`.
2. **Behavior on Unconfigured Chats**:
   If an unregistered Telegram chat issues `/report` or `/start`:
   - It receives **NO analytics, NO website IDs, and NO project names**.
   - It receives only a diagnostic helper displaying the current Chat ID so an administrator can configure it:
     ```html
     🔒 <b>چت غیرمجاز</b><br/>
     این چت در سامانه گزارش‌دهی امامی ثبت نشده است.<br/>
     شناسه چت: <code>-1002345678901</code>
     ```
   - Standard conversational text in unconfigured chats is silently ignored.

---

## 3. Log Redaction & Safe Error Handling

### 3.1 Token Redactor
All logger outputs pass through an automated redactor that strips:
- Telegram Bot Tokens (`\b\d{8,10}:[A-Za-z0-9_-]{35}\b`)
- `Authorization: Bearer <token>`
- `x-umami-api-key: <key>`
- URL query parameters containing keys, tokens, or credentials.

### 3.2 Safe User-Facing Error Messages
If an internal failure occurs (e.g., Umami DNS failure, 502 Bad Gateway):
- **User receives**:
  `⚠️ در حال حاضر امکان دریافت گزارش وجود ندارد. لطفاً دقایقی دیگر تلاش کنید.`
- **Internal logs record**:
  Structured JSON error with error code, status, timestamp, and sanitized URL (never credentials).

---

## 4. HTTP Policies

1. **Timeout**: Bounded to 10 seconds (`AbortSignal.timeout(10_000)`).
2. **Retries**:
   - HTTP 429: Respects `Retry-After` header (up to 15s max backoff), up to 3 retries.
   - HTTP 500/502/503/504: Exponential backoff with random jitter, up to 3 retries.
   - HTTP 400, 401, 403, 404: **Zero retries**. Fails immediately.
