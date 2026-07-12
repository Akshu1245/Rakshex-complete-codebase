import { logger } from "../_core/logger";
/**
 * Diminishing-returns budget tracker for iterative scanners.
 *
 * Inspired by Claude Code's `query/tokenBudget.ts` — not a port, but the
 * same idea: if the last N iterations have produced no new useful work,
 * the remaining ones probably won't either, so stop instead of burning
 * time/quota. This keeps Rakshex scans fast on giant API collections
 * (thousand-endpoint OpenAPI specs) without sacrificing correctness for
 * small ones.
 *
 * Usage:
 *
 *   const budget = new ScanBudget({ maxIterations: 500, stallWindow: 25 });
 *   for (const endpoint of endpoints) {
 *     if (!budget.shouldContinue()) break;
 *     const newFindings = scanOne(endpoint);
 *     budget.recordIteration(newFindings);
 *   }
 *   if (budget.stopped) logger.warn(budget.stopReason);
 */

export type StopReason = "max_iterations_reached" | "diminishing_returns" | "hard_timeout" | null;

export interface ScanBudgetOptions {
  /** Absolute cap on iterations, regardless of stall detection. */
  maxIterations: number;
  /**
   * Number of consecutive zero-yield iterations we tolerate before
   * declaring diminishing returns. Smaller = stop earlier, more false
   * positives. Larger = more patient, more wasted work.
   */
  stallWindow: number;
  /**
   * Optional wall-clock timeout in ms. When the budget exceeds this, it
   * marks itself stopped with reason "hard_timeout". Useful to cap total
   * scan duration.
   */
  hardTimeoutMs?: number;
}

export class ScanBudget {
  private opts: ScanBudgetOptions;
  private startedAt: number;
  private consecutiveEmpty = 0;
  public iterationsRun = 0;
  public totalNewItems = 0;
  public stopped = false;
  public stopReason: StopReason = null;

  constructor(opts: ScanBudgetOptions) {
    this.opts = opts;
    this.startedAt = Date.now();
  }

  shouldContinue(): boolean {
    if (this.stopped) return false;

    if (this.iterationsRun >= this.opts.maxIterations) {
      this.stopped = true;
      this.stopReason = "max_iterations_reached";
      return false;
    }

    if (this.consecutiveEmpty >= this.opts.stallWindow) {
      this.stopped = true;
      this.stopReason = "diminishing_returns";
      return false;
    }

    if (
      this.opts.hardTimeoutMs !== undefined &&
      Date.now() - this.startedAt >= this.opts.hardTimeoutMs
    ) {
      this.stopped = true;
      this.stopReason = "hard_timeout";
      return false;
    }

    return true;
  }

  /**
   * Report the outcome of one iteration. `newItemCount` is the number of
   * genuinely new useful items (e.g. findings) produced in this iteration.
   * A zero count increments the stall counter; a non-zero count resets it.
   */
  recordIteration(newItemCount: number): void {
    this.iterationsRun++;
    this.totalNewItems += newItemCount;
    if (newItemCount > 0) {
      this.consecutiveEmpty = 0;
    } else {
      this.consecutiveEmpty++;
    }
  }

  /**
   * For metrics / telemetry. Safe to call even after stop.
   */
  summary(): {
    iterationsRun: number;
    totalNewItems: number;
    elapsedMs: number;
    stopped: boolean;
    stopReason: StopReason;
  } {
    return {
      iterationsRun: this.iterationsRun,
      totalNewItems: this.totalNewItems,
      elapsedMs: Date.now() - this.startedAt,
      stopped: this.stopped,
      stopReason: this.stopReason,
    };
  }
}
