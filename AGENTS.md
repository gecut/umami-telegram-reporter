# AGENTS.md — Repository Operating Manual

## 1. Repository Goal
**Umami Telegram Reporter** is an autonomous, standalone, single-replica service that reads website analytics from an Umami instance (via read-only REST API) and delivers concise, reliable Persian reports to authorized Telegram project groups both on a schedule and on-demand.

---

## 2. Source-of-Truth Documentation
Before altering architecture or metrics, consult these canonical specifications:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System components, data flows, and single-replica invariant.
- [`docs/ANALYTICS_DATA_SEMANTICS.md`](docs/ANALYTICS_DATA_SEMANTICS.md): Authoritative Umami metric definitions, count interpretations, and mandatory Persian translations.
- [`docs/CONFIGURATION_AND_SECURITY.md`](docs/CONFIGURATION_AND_SECURITY.md): Configuration schema, secrets segregation, and chat authorization.
- [`docs/OPERATIONS_AND_DEPLOYMENT.md`](docs/OPERATIONS_AND_DEPLOYMENT.md): Container runtime, diagnostic CLI, and healthchecks.
- [`docs/ADR.md`](docs/ADR.md): Architectural Decision Records (Bun, long polling, zero database, HTML parse mode, etc.).
- [`vendor/`](vendor/): LLM-ready official vendor technical references.

---

## 3. Strict Coding Conventions & Architecture Boundaries
- **Language & Runtime**: Bun 1.3+ with strict TypeScript (`noEmit: true`, `strict: true`, `noUncheckedIndexedAccess: true`).
- **Zero-`any` Policy**: Never use `any` as an escape hatch. Use explicit TypeScript interfaces or Zod schemas.
- **Dependency Minimization**:
  - Direct HTTP: Native `fetch` with `AbortSignal.timeout(10_000)`. Do not install axios or node-fetch.
  - Scheduler: `croner` with IANA timezone strings (`Asia/Tehran`). Do not install node-cron.
  - Telegram: `grammY` with long polling.
  - Test runner: Native `bun:test`. Do not install Jest or Vitest.
- **Zero Application Database**: No Postgres, SQLite, MongoDB, Redis, or ORMs. Configuration lives in `projects.json`.
- **Pure Functions for Transforms**: Metric math, percentage comparisons, and Persian HTML formatting must be pure, deterministic functions.

---

## 4. User-Facing Language & Metric Semantics
- **Telegram / Client Output**: Natural, professional **Persian**.
- **Engineering / Code Identifiers**: English.
- **BiDi / RTL Protection**:
  - Prepend `\u200F` (RLM) on lines starting with emojis.
  - Wrap signed percentage indicators in LRM (`&lrm;` / `\u200E+14%`).
  - Use Latin digits with comma separators (`1,450`) for readability and BiDi safety.
  - Wrap paths and URLs in `<code>...</code>` tags.
- **Never Mislabel Metrics**:
  - `visitors` $\rightarrow$ **کاربران یکتا**
  - `visits` $\rightarrow$ **نشست‌ها**
  - `pageviews` $\rightarrow$ **نمایش صفحات**
  - In `/metrics` queries (`path`, `referrer`, `utmSource`), `y` represents **unique visitors** (`count(distinct session_id)`), NOT raw pageviews!

---

## 5. Security & Secret Handling
- **Secrets vs Config**:
  - Secrets (`TELEGRAM_BOT_TOKEN`, `UMAMI_API_KEY`) reside exclusively in `.env` (never committed to git).
  - Project topologies (`telegramChatId`, `umamiWebsiteId`) reside in `projects.json`.
- **Chat Whitelist**: Only configured `telegramChatId`s receive project reports. Unregistered chats receive only a harmless setup helper displaying their chat ID.
- **Umami Read-Only**: The internal Umami client must expose **strictly GET methods**. No mutation operations (`POST`, `PUT`, `DELETE`).
- **Log Redaction**: All console/error logs must pass through token redaction filters before output.

---

## 6. Verification & Validation Commands
Execute these standard commands before submitting changes:
```bash
# 1. Typecheck and verify syntax
bun run check:types

# 2. Run automated test suite (offline, fixture-based)
bun test

# 3. Validate configuration schemas
bun run check-config

# 4. Safe operator dry-run (verifies credentials & prints sample report to stdout)
bun run dry-run

# 5. One-stop quality check
bun run check
```

---

## 7. Using Installed Agent Skills
- **`code-review`**: Run when completing significant changes to verify alignment with repository standards and requirements.
- **`multi-stage-dockerfile`**: Reference when adjusting container build layers and security configurations.
