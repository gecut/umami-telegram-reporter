import { logger } from "../lib/logger";
import type {
  UmamiStatsResponse,
  UmamiMetricItem,
  UmamiWebsiteInfo,
} from "./types";

export interface UmamiClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchFn?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

export class UmamiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

  constructor(options: UmamiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Internal GET request with bounded timeout, status discrimination, and retry logic.
   */
  private async get<T>(path: string, queryParams: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "x-umami-api-key": this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
    };

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        const response = await this.fetchFn(url.toString(), {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.ok) {
          return (await response.json()) as T;
        }

        // Fatal client errors: do not retry
        if ([400, 401, 403, 404].includes(response.status)) {
          const errorText = await response.text().catch(() => "");
          throw new Error(`Umami API fatal error (${response.status}): ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
        }

        // Rate limiting: 429 Too Many Requests
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 2;
          const waitMs = Math.min(Math.max(isNaN(retryAfterSec) ? 2 : retryAfterSec, 1), 15) * 1000;

          logger.warn(`[UmamiClient] Rate limited (429). Retrying after ${waitMs}ms`, { path });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          attempt++;
          continue;
        }

        // Transient server errors: 500, 502, 503, 504
        if (response.status >= 500 && attempt < this.maxRetries) {
          const baseDelay = 500 * Math.pow(2, attempt);
          const jitter = Math.random() * 300;
          const waitMs = baseDelay + jitter;

          logger.warn(`[UmamiClient] Server error (${response.status}). Retrying attempt ${attempt + 1}/${this.maxRetries}`, { path });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          attempt++;
          continue;
        }

        throw new Error(`Umami API request failed with status ${response.status}: ${response.statusText}`);
      } catch (err: unknown) {
        // Fatal client errors (400, 401, 403, 404) should propagate immediately
        const isFatalError = err instanceof Error && err.message.startsWith("Umami API fatal error");
        if (isFatalError) {
          throw err;
        }

        const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        const isNetworkFailure = err instanceof Error && (err.name === "TypeError" || err.message.toLowerCase().includes("fetch failed"));

        if ((isTimeout || isNetworkFailure) && attempt < this.maxRetries) {
          attempt++;
          const baseDelay = 1000 * attempt;
          const jitter = Math.random() * 300;
          const waitMs = baseDelay + jitter;
          logger.warn(`[UmamiClient] Transient network or timeout error (${(err as Error).message}). Retrying attempt ${attempt}/${this.maxRetries} after ${Math.round(waitMs)}ms`, { path });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        // Non-retryable or retries exhausted
        if (attempt >= this.maxRetries) {
          logger.error(`[UmamiClient] Exceeded max retries for ${path}`, err);
        }
        throw err;
      }
    }

    throw new Error(`[UmamiClient] Failed to complete request to ${path}`);
  }

  /**
   * Fetches website metadata to verify connectivity and access permissions.
   */
  public async getWebsite(websiteId: string): Promise<UmamiWebsiteInfo> {
    return this.get<UmamiWebsiteInfo>(`/api/websites/${websiteId}`);
  }

  /**
   * Fetches summary statistics for a given date window.
   */
  public async getStats(
    websiteId: string,
    startAt: number,
    endAt: number,
    compare: "prev" | "yoy" = "prev"
  ): Promise<UmamiStatsResponse> {
    return this.get<UmamiStatsResponse>(`/api/websites/${websiteId}/stats`, {
      startAt,
      endAt,
      compare,
    });
  }

  /**
   * Fetches ranked metrics (paths, referrers, UTMs, events).
   */
  public async getMetrics(
    websiteId: string,
    startAt: number,
    endAt: number,
    type: "path" | "url" | "referrer" | "utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "event",
    limit: number = 5,
    extraFilters: Record<string, string | number | undefined> = {}
  ): Promise<UmamiMetricItem[]> {
    return this.get<UmamiMetricItem[]>(`/api/websites/${websiteId}/metrics`, {
      type,
      startAt,
      endAt,
      limit,
      ...extraFilters,
    });
  }
}
