export class ChatRateLimiter {
  private readonly cooldownMs: number;
  private readonly lastExecutionMap = new Map<number, number>();

  constructor(cooldownSeconds: number = 15) {
    this.cooldownMs = cooldownSeconds * 1000;
  }

  /**
   * Checks whether the chat can perform an action.
   * If allowed, updates the timestamp and returns true.
   * If rate-limited, returns false and remaining seconds.
   */
  public check(chatId: number): { allowed: boolean; remainingSeconds: number } {
    const now = Date.now();
    const lastTime = this.lastExecutionMap.get(chatId) ?? 0;
    const elapsed = now - lastTime;

    if (elapsed < this.cooldownMs) {
      const remainingSeconds = Math.ceil((this.cooldownMs - elapsed) / 1000);
      return { allowed: false, remainingSeconds };
    }

    this.lastExecutionMap.set(chatId, now);
    return { allowed: true, remainingSeconds: 0 };
  }

  public reset(chatId?: number): void {
    if (chatId !== undefined) {
      this.lastExecutionMap.delete(chatId);
    } else {
      this.lastExecutionMap.clear();
    }
  }
}
