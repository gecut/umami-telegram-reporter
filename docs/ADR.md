# Architectural Decision Records (ADRs)

## ADR-001: Selection of Bun 1.3 as Core Runtime
- **Context**: The project needs a lightweight, fast, modern TypeScript runtime with zero transpilation overhead.
- **Decision**: Use Bun 1.3.x (`bun.lock`, native TypeScript execution, native `fetch` with `AbortSignal.timeout`, built-in `bun:test`).
- **Consequences**: Fast startup, tiny memory footprint, zero Babel/ts-node toolchains required.

## ADR-002: Long Polling (`bot.start()`) over Webhook Delivery
- **Context**: The bot operates as a background worker inside Telegram groups and sends scheduled reports.
- **Decision**: Use Telegram Bot API long polling instead of inbound webhooks.
- **Rationale**:
  - Requires **zero open inbound ports** and no public domain name.
  - Eliminates the need for SSL/TLS certificate management or reverse proxies (Nginx/Traefik).
  - Works seamlessly behind NAT and enterprise firewalls.
- **Consequences**: The service must strictly enforce a single running replica (`replicas: 1`) to avoid `HTTP 409 Conflict` errors from Telegram.

## ADR-003: Zero-Database Architecture
- **Context**: Project topologies, website mappings, and schedules need to be managed.
- **Decision**: Store project configuration in a static declarative file (`projects.json`) validated with Zod at startup.
- **Rationale**:
  - Eliminates database dependencies (PostgreSQL, SQLite, Redis).
  - Eliminates ORMs, database migrations, connection pool starvation, and backup management.
  - A small team can update projects via git commits or Docker volume mount.
- **Consequences**: Adding projects requires updating `projects.json` and restarting or reloading the process. This satisfies all V1 requirements.

## ADR-004: Direct Umami REST Integration with Read-Only Interface
- **Context**: We need to query stats, metrics, and events from Umami instances.
- **Decision**: Implement a purpose-built, GET-only HTTP client using native `fetch` rather than third-party SDKs (`@umami/node`).
- **Rationale**:
  - Full control over bounded timeouts (10s), exponential backoff, and 429 rate-limiting.
  - Guarantees compile-time and runtime immutability (no mutation endpoints exist in code).
- **Consequences**: Maintenance of endpoint contracts is localized to `src/umami/`.

## ADR-005: Selection of `croner` for Scheduling
- **Context**: Daily reports must run in the project's specified local timezone (e.g. `Asia/Tehran` at 09:00).
- **Decision**: Use `croner` (pure TypeScript, zero dependencies, <15 KB) instead of Bun's experimental `Bun.cron` or `node-cron`.
- **Rationale**:
  - Bun's native `Bun.cron` is experimental and strictly UTC-only (ignores IANA timezone parameters).
  - `croner` provides first-class IANA timezone support, DST awareness, overrun protection (`protect: true`), and graceful job lifecycle management.
- **Consequences**: Minimal, safe dependency that completely solves multi-project timezone requirements.

## ADR-006: Telegram HTML Parse Mode over MarkdownV2
- **Context**: Reports contain user-generated data such as page titles, URLs, query parameters, and referrers.
- **Decision**: Use Telegram `parse_mode: 'HTML'` exclusively with an automated 4-character escaping helper (`&`, `<`, `>`, `"`).
- **Rationale**:
  - MarkdownV2 requires escaping 18 special characters (`_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`). A single unescaped dot or minus sign crashes message delivery with HTTP 400.
  - HTML is far more resilient and simpler to escape safely.
- **Consequences**: 100% reliable message delivery without formatting syntax errors.

## ADR-007: BiDi / Unicode Formatting Standards for Persian Analytics
- **Context**: Mixing Persian RTL text with LTR characters (Latin digits, `+14%`, URLs, emojis) causes Telegram clients to reverse signs or scramble line direction.
- **Decision**:
  - Use Unicode Right-to-Left Mark (`\u200F` - RLM) at line beginnings.
  - Wrap signed percentage indicators in Left-to-Right marks (`&lrm;` / `\u200E`).
  - Render metric figures with Latin numerals (`1,842`) and URLs in `<code>...</code>` tags.
- **Consequences**: Visually flawless, professional Persian reports on both mobile and desktop Telegram clients.
