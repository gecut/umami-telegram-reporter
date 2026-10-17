# syntax=docker/dockerfile:1

# -------------------------------------------------------------------
# Stage 1: Dependency Installation
# -------------------------------------------------------------------
FROM oven/bun:1.3.14-slim AS deps
WORKDIR /home/bun/app

# Copy dependency manifests first for layer caching
COPY package.json bun.lock ./

# Install only production dependencies with frozen lockfile
RUN bun install --frozen-lockfile --production

# -------------------------------------------------------------------
# Stage 2: Final Production Runtime
# -------------------------------------------------------------------
FROM oven/bun:1.3.14-slim AS runner
WORKDIR /home/bun/app

ENV NODE_ENV=production

# Switch to the non-root bun user provided by the official base image
USER bun

# Copy installed production node_modules from deps stage
COPY --from=deps --chown=bun:bun /home/bun/app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /home/bun/app/package.json ./package.json

# Copy application source code and configuration
COPY --chown=bun:bun ./src ./src
COPY --chown=bun:bun ./tsconfig.json ./tsconfig.json

# Default location for mounted projects configuration
ENV PROJECTS_CONFIG_PATH=/home/bun/app/projects.json

# Healthcheck verifying background heartbeat liveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e 'const fs=require("node:fs"); try { const d=JSON.parse(fs.readFileSync("/tmp/heartbeat.json", "utf8")); if(Date.now()-d.timestamp > 45000) process.exit(1); } catch { process.exit(1); }' || exit 1

# Graceful shutdown signal for grammY long polling
STOPSIGNAL SIGINT

ENTRYPOINT ["bun", "run", "src/index.ts"]
