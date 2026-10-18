# Umami Telegram Reporter

[![CI/CD Pipeline & GHCR Publishing](https://github.com/gecut/umami-telegram-reporter/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/gecut/umami-telegram-reporter/actions/workflows/ci-cd.yml)
[![Container Image](https://img.shields.io/badge/ghcr.io-gecut%2Fumami--telegram--reporter-blue?logo=docker)](https://github.com/gecut/umami-telegram-reporter/pkgs/container/umami-telegram-reporter)
[![Runtime](https://img.shields.io/badge/Bun-1.3%2B-fbf0df?logo=bun)](https://bun.sh)
[![Language](https://img.shields.io/badge/TypeScript-Strict-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Umami Telegram Reporter** is an autonomous, standalone, single-replica service that reads website analytics from an Umami instance (via read-only REST API) and delivers concise, reliable Persian reports to authorized Telegram project groups both on a schedule and on-demand.

Designed specifically for project owners, founders, and business clients (**کارفرما**), it eliminates confusing developer jargon (such as Bounce Rate) and translates technical URLs and referrers into natural Persian phrases.

---

## ✨ Key Features

- **📊 Executive Storytelling Reports (گزارش داستان‌محور تجاری)**:
  Clean, executive layout focused on real business indicators: actual visitors, total page views, average time on site, sales conversions, and top traffic acquisition channels.
- **🧠 Humanizer Mini-Engine**:
  Automatically translates technical route paths (`/shop`, `/auth/login-otp`), marketing UTM tags (`instagram/bio`, `instagram/story`), and referral sources (`api.torob.com`, `googlequicksearchbox`) into natural Persian brand names.
- **🏦 Automated Payment Gateway Filtering**:
  Filters out return loops from Iranian payment gateways (`*.shaparak.ir`, `zarinpal.com`, etc.) so customer returns from banks are not misattributed as marketing acquisition sources.
- **🟢 Traffic Pulse Badge (نشانگر نبض ترافیک)**:
  Calculates and displays a real-time status badge (`🟢 افزایشی و فعال` / `⚪️ پایدار و عادی` / `🟡 کاهشی`) by comparing current traffic against the equivalent preceding period.
- **⏰ Scheduled & On-Demand Dispatch**:
  Sends automated daily summaries at configured times (e.g., every evening at 8:00 PM Tehran time) and supports instant on-demand queries in authorized groups (`/report`, `/report 24h`, `/report yesterday`, `/report 7d`, `/report 30d`).
- **🛡️ Strict Isolation & Zero-Database Architecture**:
  No SQL/NoSQL databases or ORMs required. Configuration lives cleanly in `projects.json`. Unconfigured chats receive 0% analytics exposure.
- **🚀 Multi-Arch Container on GHCR**:
  Pre-built multi-platform Docker images (`linux/amd64` and `linux/arm64`) automatically published to GitHub Container Registry (`ghcr.io/gecut/umami-telegram-reporter`).

---

## 📱 Sample Output

```html
‏📊 نبض چوبینو — دیروز (۱۴۰۵ مهر ۲۵, شنبه)
‏🟢 وضعیت ترافیک: ورود مخاطبان جدید به سایت

‏👥 مشتریان و بازدیدها:
‏• افراد بازدیدکننده: 14 نفر  🟢 ‎+14 (جدید)
‏• کل صفحات دیده‌شده: 78 بار  🟢 ‎+78 (جدید)
‏• میانگین حضور در سایت: 4 دقیقه و 6 ثانیه

‏🎯 بازدهی فروش و اهداف سایت:
‏🛒 افزودن به سبد خرید: 2 بار
‏💳 شروع فرایند پرداخت: 1 بار

‏📢 مشتریان از کجا آمدند؟
‏• موتور ترب: 4 نفر
‏• اینستاگرام: 4 نفر
‏    └ لینک بیو: 4 نفر
‏    └ استوری‌ها: 1 نفر

‏🌐 منابع ارجاع و جستجو:
‏• موتور جستجوی ترب: 4 نفر
‏• فیس‌بوک: 2 نفر
‏• جستجوی گوگل: 2 نفر

‏🔝 بیشترین بخش‌های دیده‌شده:
‏1. صفحه اصلی (خانه) (9 بازدید)
‏2. ویترین فروشگاه (3 بازدید)
‏3. تکمیل مشخصات کاربری (2 بازدید)
‏4. ورود با پیامک (OTP) (2 بازدید)
‏5. بخش ورود و حساب کاربری (2 بازدید)
```

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

1. Create a `.env` file from the example template:
   ```bash
   cp .env.example .env
   ```
2. Configure your credentials in `.env`:
   ```ini
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   UMAMI_BASE_URL=https://umami.example.com
   UMAMI_API_KEY=umami_your_read_only_api_key
   ```
3. Create your `projects.json` from `projects.example.json`:
   ```bash
   cp projects.example.json projects.json
   ```
4. Start the service with Docker Compose (pulls pre-built image from GHCR):
   ```bash
   docker compose pull
   docker compose up -d
   ```

### Option 2: Native Bun (Local Development)

1. Ensure **Bun 1.3+** is installed:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. Install dependencies:
   ```bash
   bun install --frozen-lockfile
   ```
3. Validate configuration:
   ```bash
   bun run check-config
   ```
4. Run a safe local dry-run (prints formatted report to stdout without sending messages):
   ```bash
   bun run dry-run
   ```
5. Launch the service:
   ```bash
   bun run start
   ```

---

## ⚙️ Configuration

### 1. Environment Secrets (`.env`)

Secrets reside exclusively in `.env` and are strictly gitignored:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Bot token provided by Telegram [@BotFather](https://t.me/BotFather) | `8953800334:AAGlC...` |
| `UMAMI_BASE_URL` | Base URL of your Umami instance | `https://analytics.example.com` |
| `UMAMI_API_KEY` | Read-only API key generated in Umami profile settings | `umami_HAPz6a...` |
| `PROJECTS_CONFIG_PATH` | Path to projects configuration file | `./projects.json` |
| `UMAMI_TIMEOUT_MS` | Request timeout for Umami API queries (default: `45000`) | `45000` |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info` |

### 2. Project Topology (`projects.json`)

Map Telegram groups to Umami websites:

```json
[
  {
    "id": "my-store",
    "name": "فروشگاه چوبینو",
    "telegramChatId": -1001234567890,
    "umamiWebsiteId": "0483b257-4ecd-4ca6-94d5-c56789110bbc",
    "timezone": "Asia/Tehran",
    "schedule": {
      "enabled": true,
      "cron": "0 20 * * *",
      "period": "24h"
    },
    "filterPaymentGateways": true,
    "pathLabels": {
      "/": "صفحه اصلی (خانه)",
      "/shop": "ویترین فروشگاه",
      "/cart": "سبد خرید",
      "/checkout": "تسویه حساب"
    },
    "referrerLabels": {
      "partner.example.com": "سایت همکار"
    },
    "trackedEvents": [
      { "name": "add-to-cart", "label": "افزودن به سبد خرید" },
      { "name": "payment-start", "label": "شروع فرایند پرداخت" }
    ],
    "utmBreakdowns": [
      {
        "source": "instagram",
        "dimensions": ["utmContent"]
      }
    ]
  }
]
```

---

## 💬 Telegram Commands

Within an authorized Telegram group:

| Command | Description |
| :--- | :--- |
| `/report` | Sends the yesterday report (default) |
| `/report 24h` | Sends analytics for the last 24 hours up to the current moment |
| `/report yesterday` | Sends analytics for yesterday (00:00 to 23:59:59 local time) |
| `/report today` | Sends analytics for today so far |
| `/report 7d` | Sends analytics for the last 7 calendar days |
| `/report 30d` | Sends analytics for the last 30 calendar days |

> **Note**: Unregistered chats receive a harmless setup helper displaying their chat ID, preventing unauthorized access.

---

## 🧪 Verification & Development

```bash
# Typecheck with zero 'any'
bun run check:types

# Run offline unit test suite (64 tests)
bun test

# Validate configuration syntax
bun run check-config

# Execute offline fixture dry-run
bun run dry-run --fixture

# Run all checks in one command
bun run check
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
