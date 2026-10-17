# Operations, Maintenance, and Deployment Guide

## 1. Local Development Quickstart

### Prerequisites
- [Bun](https://bun.sh) (v1.3.x or higher)
- Telegram Bot Token (from `@BotFather`)
- Umami Read-Only API Key or Token

### Setup
```bash
# Clone and enter directory
cd umami-stats

# Install dependencies with frozen lockfile
bun install --frozen-lockfile

# Configure secrets
cp .env.example .env
# Edit .env with your credentials

# Verify configuration and credentials safely
bun run check-config
bun run dry-run
```

### Running Locally
```bash
bun run dev
```

---

## 2. Operator Diagnostic & Dry-Run CLI

The service provides built-in tools for verification without sending messages to production groups:

1. **Configuration Validation**:
   ```bash
   bun run check-config
   ```
   Validates `.env` and `projects.json` against Zod schemas. Exits 0 on success, non-zero on failure.

2. **Full Pipeline Dry-Run**:
   ```bash
   bun run dry-run
   ```
   - Validates configuration.
   - Calls Telegram `getMe` to verify bot credentials and username.
   - Tests Umami connectivity and verifies read access to each configured website ID.
   - Computes local date windows and fetches actual analytics.
   - Formats the report and prints it to STDOUT without posting to any Telegram chat.

3. **Offline Test Suite**:
   ```bash
   bun test
   ```
   Runs unit and integration tests using offline fixtures in < 1 second.

---

## 3. Production Docker Deployment

### Single-Replica Invariant
Telegram long polling (`getUpdates`) allows strictly one active listener. Multiple replicas cause `HTTP 409 Conflict` loops.

### Docker Compose (`docker-compose.yml`)
```yaml
version: "3.8"

services:
  umami-reporter:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: umami-reporter
    restart: unless-stopped
    deploy:
      replicas: 1
      update_config:
        order: stop-first
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - UMAMI_BASE_URL=${UMAMI_BASE_URL}
      - UMAMI_API_KEY=${UMAMI_API_KEY}
      - LOG_LEVEL=info
      - NODE_ENV=production
    volumes:
      - ./projects.json:/home/bun/app/projects.json:ro
    security_opt:
      - no-new-privileges:true
```

### Healthcheck Mechanism
The service does not listen on an inbound HTTP port. Health is monitored via an internal watchdog file:
- On each successful polling cycle or scheduled check, the bot updates `/tmp/heartbeat.json` with timestamp.
- The healthcheck command verifies that `Date.now() - last_heartbeat < 60_000`.

---

## 4. Graceful Shutdown & Signal Handling

On receiving `SIGINT` or `SIGTERM`:
1. The service marks its internal state as shutting down to decline new requests.
2. Calls `bot.stop()` on grammY to cancel the active long-poll HTTP request and commit the current update offset to Telegram.
3. Stops active cron jobs.
4. Exits cleanly with code 0.
