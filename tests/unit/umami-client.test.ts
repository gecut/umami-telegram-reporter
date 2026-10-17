import { describe, it, expect } from "bun:test";
import { UmamiClient } from "../../src/umami/client";

describe("UmamiClient REST Implementation", () => {
  it("sends both x-umami-api-key and Authorization headers", async () => {
    let capturedHeaders: unknown;

    const client = new UmamiClient({
      baseUrl: "https://test.umami.internal",
      apiKey: "secret-token-123",
      fetchFn: async (_input, init) => {
        capturedHeaders = init?.headers;
        return new Response(JSON.stringify({ pageviews: 10, visitors: 5 }), { status: 200 });
      },
    });

    await client.getStats("web-1", 1000, 2000);

    const headersRecord = capturedHeaders as Record<string, string>;
    expect(headersRecord["x-umami-api-key"]).toBe("secret-token-123");
    expect(headersRecord["Authorization"]).toBe("Bearer secret-token-123");
  });

  it("throws immediately on 401 Unauthorized without retrying", async () => {
    let callCount = 0;

    const client = new UmamiClient({
      baseUrl: "https://test.umami.internal",
      apiKey: "bad-token",
      maxRetries: 3,
      fetchFn: async () => {
        callCount++;
        return new Response("Unauthorized", { status: 401, statusText: "Unauthorized" });
      },
    });

    expect(client.getStats("web-1", 1000, 2000)).rejects.toThrow("Umami API fatal error (401)");
    expect(callCount).toBe(1); // Exactly 1 call, zero retries
  });

  it("retries on transient 500 Internal Server Error", async () => {
    let callCount = 0;

    const client = new UmamiClient({
      baseUrl: "https://test.umami.internal",
      apiKey: "valid-key",
      maxRetries: 2,
      fetchFn: async () => {
        callCount++;
        if (callCount <= 2) {
          return new Response("Server error", { status: 502, statusText: "Bad Gateway" });
        }
        return new Response(JSON.stringify({ pageviews: 50, visitors: 20 }), { status: 200 });
      },
    });

    const res = await client.getStats("web-1", 1000, 2000);
    expect(callCount).toBe(3); // 2 failures + 1 success
    expect(res.pageviews).toBe(50);
  });
});
