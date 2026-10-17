# Umami Telegram Reporter: System Architecture

## 1. Product Purpose & Scope

The **Umami Telegram Reporter** is an autonomous, standalone background service designed to fetch analytics from an Umami instance and publish concise, accurate, and actionable reports into designated Telegram project groups.

### Core Value Proposition
- Project owners, marketing leads, and clients receive daily or on-demand website analytics directly in Telegram without logging into the Umami web dashboard.
- Zero website modification required; the service interacts exclusively with the Umami REST API using read-only credentials.

### Interaction Modes (V1)
1. **Scheduled Reports**: Automatic delivery at a configured daily local time (e.g., 09:00 AM in project's IANA timezone) summarizing the previous local calendar day.
2. **On-Demand Commands**: Group members trigger reports for defined windows via:
   - `/report` (defaults to `yesterday`)
   - `/report today` (or `/report امروز`)
   - `/report yesterday` (or `/report دیروز`)
   - `/report 7d` (or `/report هفته`)
   - `/report 30d` (or `/report ماه`)
   - `/status` (service connectivity and project information)
   - `/help` (command usage guide)

### Explicit Non-Goals (Out of Scope for V1)
- Application database (Postgres, SQLite, Mongo, Redis).
- Web dashboards or admin UIs.
- Arbitrary natural-language queries or AI-generated commentary.
- In-chat project management / CRUD.
- Webhook endpoints or inbound HTTP listeners (no public TLS or reverse proxy required).
- Interactive charts / image generation (keeps binary dependencies minimal).
- Arbitrary custom date ranges (e.g., `/report 2026-01-01 to 2026-01-15`).

---

## 2. System Architecture & Topology

```
┌────────────────────────────────────────────────────────┐
│ Telegram Cloud Infrastructure                          │
└──────────────────────────┬─────────────────────────────┘
                           ▲
          Long Polling     │ HTTPS Delivery
          (getUpdates)     │ (sendMessage, HTML)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Umami Telegram Reporter Service (Single Container)     │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │ Telegram Bot Engine (grammY)                   │   │
│   │ - Privacy Mode enabled                         │   │
│   │ - Command Parser & Group Routing               │   │
│   │ - Chat Whitelist & Authorization               │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │ Scheduler Engine (croner)                      │   │
│   │ - Per-project IANA timezone execution          │   │
│   │ - Sequential queue dispatching (flood control) │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │ Report Coordinator & Engine                    │   │
│   │ - Local calendar window math (Intl API)        │   │
│   │ - Concurrent read-only Umami REST queries      │   │
│   │ - Partial failure tolerance & normalization    │   │
│   │ - Persian BiDi & HTML Entity Renderer          │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │ Umami REST Client (native fetch)               │   │
│   │ - Read-only GET methods only                   │   │
│   │ - Bounded timeout (10s)                        │   │
│   │ - Status-discriminating retry & backoff        │   │
│   └──────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │
                           ▼ HTTPS REST (GET)
┌────────────────────────────────────────────────────────┐
│ Umami Analytics Instance (Cloud or Self-Hosted)         │
└────────────────────────────────────────────────────────┘
```

---

## 3. Core Component Boundaries

### 3.1 Telegram Engine (`src/telegram/`)
- Wraps `grammY` using built-in long polling (`bot.start()`).
- Operates under Telegram Privacy Mode: ignores conversational chat text, responding only to commands starting with `/`, mentions, or direct replies.
- Validates every incoming update against the authorized chat list in `projects.json`.
- Enforces per-chat rate limiting (1 report per 30 seconds).

### 3.2 Report Coordinator (`src/report/`)
- Manages the lifecycle of a report request:
  1. Computes local start and end timestamps in the project's IANA timezone.
  2. Computes the corresponding previous comparison period.
  3. Issues parallel queries to Umami for stats, top pages, referrers, UTM channels, and custom events.
  4. Merges and normalizes raw Umami responses into an immutable `ReportModel`.
  5. Translates `ReportModel` into Telegram HTML using `PersianRenderer`.

### 3.3 Umami Client (`src/umami/`)
- Implements strictly GET operations:
  - `getStats(websiteId, startAt, endAt)`
  - `getMetrics(websiteId, startAt, endAt, type, limit, filters)`
  - `getEventStats(websiteId, startAt, endAt, eventName)`
- Zero mutation methods (`POST`, `PUT`, `DELETE` are omitted by design).
- Bounded network calls: 10-second timeout via `AbortSignal.timeout(10_000)`.
- Status-discriminating retries: retries 429 (with `Retry-After`) and 5xx transient server errors; never retries 400, 401, 403, or 404.

### 3.4 Scheduler Engine (`src/scheduler/`)
- Uses `croner` with per-project IANA timezone strings (`Asia/Tehran`, etc.).
- Protects against job overrun (`protect: true`).
- Staggers outbound Telegram dispatches with a 500ms delay between chats to comply with Telegram group flood limits.

---

## 4. Single-Replica Architectural Invariant

Telegram Bot API long polling (`getUpdates`) allows strictly **one concurrent connection** per bot token. Running multiple container replicas causes continuous HTTP 409 Conflict errors and duplicate scheduled reports.

**Design Rules:**
- The deployment configuration must enforce `replicas: 1`.
- Container restart/update strategies must specify `stop-first` or `recreate` rather than rolling updates.
- In-memory state (rate limiting, project lookup maps) is fully sufficient; zero external distributed lock or cache is needed.
