/**
 * Circuit Breaker — Prevents cascading failures when external services degrade.
 *
 * States:
 *   CLOSED   → Normal operation, requests pass through
 *   OPEN     → Failure threshold exceeded, requests fail fast
 *   HALF_OPEN→ After timeout, test if service recovered
 *
 * Usage:
 *   const breaker = new CircuitBreaker("openai-api", { failureThreshold: 5, timeout: 30000 });
 *   const result = await breaker.execute(() => callOpenAI(prompt));
 */

import { logger } from "../_core/logger";

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  failureThreshold?: number; // Failures before OPEN (default: 5)
  successThreshold?: number; // Successes in HALF_OPEN to close (default: 2)
  timeout?: number; // MS before HALF_OPEN (default: 30000)
  name: string;
}

export class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private nextAttempt = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30_000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttempt) {
        throw new Error(
          `Circuit breaker "${this.name}" is OPEN. Retry after ${new Date(this.nextAttempt).toISOString()}`,
        );
      }
      this.state = "HALF_OPEN";
      this.successCount = 0;
      logger.info({ breaker: this.name }, "[CircuitBreaker] Entering HALF_OPEN state");
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = "CLOSED";
        this.successCount = 0;
        logger.info({ breaker: this.name }, "[CircuitBreaker] CLOSED (recovered)");
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn(
        { breaker: this.name, failures: this.failureCount },
        "[CircuitBreaker] OPEN (half-open failed)",
      );
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn(
        { breaker: this.name, failures: this.failureCount, timeout: this.timeout },
        "[CircuitBreaker] OPEN (threshold exceeded)",
      );
    }
  }

  getState(): BreakerState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
    };
  }
}
