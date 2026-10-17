import { describe, it, expect } from "bun:test";
import { ChatRateLimiter } from "../../src/telegram/rate-limiter";

describe("ChatRateLimiter", () => {
  it("allows the first command immediately", () => {
    const limiter = new ChatRateLimiter(10);
    const result = limiter.check(-100123);
    expect(result.allowed).toBe(true);
    expect(result.remainingSeconds).toBe(0);
  });

  it("throttles subsequent requests within cooldown window", () => {
    const limiter = new ChatRateLimiter(10);
    limiter.check(-100123);

    const secondCheck = limiter.check(-100123);
    expect(secondCheck.allowed).toBe(false);
    expect(secondCheck.remainingSeconds).toBeGreaterThan(0);
    expect(secondCheck.remainingSeconds).toBeLessThanOrEqual(10);
  });

  it("tracks different chats independently", () => {
    const limiter = new ChatRateLimiter(10);
    limiter.check(-100123);

    const otherChatCheck = limiter.check(-100456);
    expect(otherChatCheck.allowed).toBe(true);
  });

  it("resets cooldown when explicitly requested", () => {
    const limiter = new ChatRateLimiter(10);
    limiter.check(-100123);

    limiter.reset(-100123);
    const retryCheck = limiter.check(-100123);
    expect(retryCheck.allowed).toBe(true);
  });
});
