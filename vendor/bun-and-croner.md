# Vendor Specification: Bun Runtime & Croner Scheduler

- **Runtimes & Libraries**: Bun (v1.3.14) & Croner (v9/v10)
- **Canonical Sources**:
  - `https://bun.sh/docs`
  - `https://github.com/Hexagon/croner`
- **Retrieval Date**: 2026-10-17

---

## 1. Bun Runtime Highlights

### Native Features Leveraged
1. **TypeScript Execution**: Native runtime execution of `.ts` files with zero transpiler overhead (`bun run src/index.ts`).
2. **Native HTTP Client (`fetch`)**: Fully compliant web standard `fetch` with `AbortSignal.timeout(ms)`.
3. **Environment Management**: Synchronous reading of `.env` files via `process.env` and `Bun.env`.
4. **Built-in Test Runner**: Instantaneous test execution via `bun:test` (`describe`, `it`, `expect`, `setSystemTime`).
5. **Lockfile**: Modern text-based `bun.lock` (replaces legacy binary `bun.lockb`).

---

## 2. Croner Scheduling Patterns

### Multi-Timezone Execution
Bun's experimental `Bun.cron` is strictly UTC-only. `croner` is a pure TypeScript, zero-dependency library that supports IANA timezone strings (`Asia/Tehran`):

```typescript
import { Cron } from "croner";

const job = new Cron(
  "0 9 * * *",
  {
    timezone: "Asia/Tehran",
    protect: true, // Prevents concurrent runs if a report takes longer than the interval
    catch: (err, job) => {
      console.error(`[Scheduler] Error in job ${job.name}:`, err);
    },
  },
  async () => {
    await dispatchDailyReports();
  }
);

// Graceful cleanup:
job.stop();
```
