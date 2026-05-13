/**
 * Continuous red-team scheduler.
 *
 * Polls the database for `redteam_schedules` rows whose `next_run_at` has
 * elapsed (or is null), spawns a real red-team run against the configured
 * target, and writes back `last_run_at` + `next_run_at`.
 *
 * Cron parsing is intentionally minimal — we only support a small subset
 * commonly used in scheduling UIs:
 *   - `@hourly`, `@daily`, `@weekly`
 *   - `0 * /N * * *` (every N hours)
 *   - `*\u002F<M> * * * *` (every M minutes)
 * Anything else falls back to a 24-hour interval.
 *
 * The scheduler is single-process; for production HA, add a Postgres advisory
 * lock or BullMQ-backed worker. That's tracked in `BullMQ migration` task.
 */
import { logger } from "../_core/logger";
import * as db from "../db";
import { runRedTeam } from "./redTeamRunner";

interface RedteamScheduleRow {
  id: number;
  userId: number;
  target: string;
  cron: string;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

const MIN_INTERVAL_MS = 60_000;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function nextRunAt(cron: string, now: Date = new Date()): Date {
  const trimmed = cron.trim();
  // Friendly aliases.
  if (trimmed === "@hourly") return new Date(now.getTime() + 60 * 60 * 1000);
  if (trimmed === "@daily") return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (trimmed === "@weekly") return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // every N hours: "0 */N * * *"
  const everyHours = /^\s*0\s+\*\/(\d{1,2})\s+\*\s+\*\s+\*\s*$/.exec(trimmed);
  if (everyHours) {
    const n = Math.max(1, Math.min(24, Number.parseInt(everyHours[1] ?? "1", 10)));
    return new Date(now.getTime() + n * 60 * 60 * 1000);
  }
  // every M minutes: "*/M * * * *"
  const everyMin = /^\s*\*\/(\d{1,2})\s+\*\s+\*\s+\*\s+\*\s*$/.exec(trimmed);
  if (everyMin) {
    const m = Math.max(1, Math.min(59, Number.parseInt(everyMin[1] ?? "1", 10)));
    return new Date(now.getTime() + m * 60 * 1000);
  }
  // fallback: daily.
  return new Date(now.getTime() + DEFAULT_INTERVAL_MS);
}

export interface SchedulerTickResult {
  scanned: number;
  ran: number;
  errors: number;
}

export async function processDueSchedules(): Promise<SchedulerTickResult> {
  const due = (await db.listDueRedteamSchedules()) as RedteamScheduleRow[];
  let ran = 0;
  let errors = 0;
  for (const row of due) {
    if (!row.isActive) continue;
    try {
      logger.info(
        { scheduleId: row.id, userId: row.userId, target: row.target },
        "[redteam-scheduler] running scheduled red-team scan"
      );
      await runRedTeam({
        userId: row.userId,
        target: row.target,
        triggeredBy: "schedule",
        maxConcurrency: 4,
      });
      ran += 1;
      const next = nextRunAt(row.cron, new Date());
      // never schedule sooner than MIN_INTERVAL_MS to avoid hot-loop bugs.
      const nextSafe = new Date(
        Math.max(next.getTime(), Date.now() + MIN_INTERVAL_MS)
      );
      await db.markRedteamScheduleRan(row.id, nextSafe);
    } catch (err) {
      errors += 1;
      logger.error(
        { err, scheduleId: row.id, userId: row.userId },
        "[redteam-scheduler] failed to run scheduled scan"
      );
      // Push next attempt out by 15 minutes on error.
      await db
        .markRedteamScheduleRan(row.id, new Date(Date.now() + 15 * 60 * 1000))
        .catch(() => undefined);
    }
  }
  return { scanned: due.length, ran, errors };
}

export interface SchedulerLoopHandle {
  stop: () => void;
}

export function startRedTeamScheduler(
  intervalMs: number = 60_000
): SchedulerLoopHandle {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const result = await processDueSchedules();
      if (result.scanned > 0) {
        logger.info(result, "[redteam-scheduler] tick complete");
      }
    } catch (err) {
      logger.error({ err }, "[redteam-scheduler] tick failed");
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  // Kick off on next tick so callers can bind handlers first.
  timer = setTimeout(tick, 0);
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
