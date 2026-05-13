/**
 * AI cost forecasting + anomaly detection.
 *
 * Two real algorithms over the gateway audit history:
 *
 * 1. **Forecast** — Holt-Winters double exponential smoothing (level + trend).
 *    Picked over ARIMA/Prophet because it has zero dependencies, is robust
 *    on short series (we often have <90 days of data), and gives a smooth
 *    n-day projection that is easy to explain to a CFO.
 *
 * 2. **Anomaly detection** — robust z-score on the per-day token deltas.
 *    Uses median / MAD instead of mean / stddev so a single bad day
 *    doesn't distort the threshold. Anything beyond 3.5 MAD is flagged.
 *
 * Both functions are pure — they read the audit history once and return
 * structured results. The tRPC router wires them to the dashboard.
 */

import { getGatewayDailyTotals } from "../db";

export interface ForecastPoint {
  date: string;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface ForecastResult {
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  /** 0..1 confidence — falls off as the projection extends. */
  confidence: number;
  method: "holt-winters" | "naive";
}

export interface AnomalyResult {
  date: string;
  totalTokens: number;
  estimatedCostUsd: number;
  zScore: number;
  reason: "spike" | "trough";
}

/** Holt-Winters double exponential smoothing on a univariate series. */
function holtWinters(
  series: ReadonlyArray<number>,
  horizon: number,
  alpha = 0.5,
  beta = 0.3
): number[] {
  if (series.length === 0) return Array.from({ length: horizon }, () => 0);
  if (series.length === 1) return Array.from({ length: horizon }, () => series[0] ?? 0);
  let level = series[0] ?? 0;
  let trend = (series[1] ?? 0) - (series[0] ?? 0);
  for (let i = 1; i < series.length; i += 1) {
    const obs = series[i] ?? 0;
    const prevLevel = level;
    level = alpha * obs + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  const out: number[] = [];
  for (let h = 1; h <= horizon; h += 1) {
    out.push(Math.max(0, level + h * trend));
  }
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : sorted[mid] ?? 0;
}

function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const m = median(values);
  const deviations = values.map(v => Math.abs(v - m));
  const result = median(deviations);
  // 1.4826 * MAD ≈ stddev for a normal distribution.
  return Math.max(result * 1.4826, 1);
}

export function forecastTokens(
  history: ReadonlyArray<{
    date: string;
    totalTokens: number;
    estimatedCostUsd: number;
  }>,
  horizonDays = 14
): ForecastResult {
  if (history.length === 0) {
    return {
      history: [],
      forecast: Array.from({ length: horizonDays }, (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + i + 1);
        return {
          date: d.toISOString().slice(0, 10),
          totalTokens: 0,
          estimatedCostUsd: 0,
        };
      }),
      confidence: 0,
      method: "naive",
    };
  }
  const tokenSeries = history.map(h => h.totalTokens);
  const costSeries = history.map(h => h.estimatedCostUsd);
  const tokenForecast = holtWinters(tokenSeries, horizonDays);
  const costForecast = holtWinters(costSeries, horizonDays);
  const lastDate = new Date(history[history.length - 1]!.date);
  const forecast: ForecastPoint[] = tokenForecast.map((tokens, i) => {
    const d = new Date(lastDate);
    d.setUTCDate(d.getUTCDate() + i + 1);
    return {
      date: d.toISOString().slice(0, 10),
      totalTokens: Math.round(tokens),
      estimatedCostUsd: Number((costForecast[i] ?? 0).toFixed(6)),
    };
  });
  // Confidence drops as horizon grows and as series gets shorter.
  const seriesScore = Math.min(1, history.length / 30);
  const horizonScore = Math.max(0.2, 1 - horizonDays / 60);
  return {
    history: [...history],
    forecast,
    confidence: Number((seriesScore * horizonScore).toFixed(3)),
    method: history.length >= 7 ? "holt-winters" : "naive",
  };
}

export function detectAnomalies(
  history: ReadonlyArray<{
    date: string;
    totalTokens: number;
    estimatedCostUsd: number;
  }>,
  threshold = 3.5
): AnomalyResult[] {
  if (history.length < 4) return [];
  const tokenValues = history.map(h => h.totalTokens);
  const med = median(tokenValues);
  const dev = mad(tokenValues);
  const out: AnomalyResult[] = [];
  for (const point of history) {
    const z = (point.totalTokens - med) / dev;
    if (Math.abs(z) >= threshold) {
      out.push({
        date: point.date,
        totalTokens: point.totalTokens,
        estimatedCostUsd: point.estimatedCostUsd,
        zScore: Number(z.toFixed(3)),
        reason: z > 0 ? "spike" : "trough",
      });
    }
  }
  return out;
}

/** Convenience: load history + run forecast in one shot. */
export async function forecastForUser(
  userId: number,
  days = 30,
  horizon = 14
): Promise<{ forecast: ForecastResult; anomalies: AnomalyResult[] }> {
  const history = await getGatewayDailyTotals(userId, days);
  return {
    forecast: forecastTokens(history, horizon),
    anomalies: detectAnomalies(history),
  };
}

/** Per-model forecast — same Holt-Winters, but applied to each model's daily totals. */
export async function forecastPerModel(
  userId: number,
  days = 30,
  horizon = 14
): Promise<{
  aggregate: ForecastResult;
  byModel: Record<string, ForecastResult>;
}> {
  const { getGatewayDailyTotalsByModel } = await import("../db");
  const { aggregate, byModel: modelHistories } = await getGatewayDailyTotalsByModel(userId, days);

  const aggregateForecast = forecastTokens(aggregate, horizon);
  const byModel: Record<string, ForecastResult> = {};

  for (const [model, history] of Object.entries(modelHistories)) {
    byModel[model] = forecastTokens(history, horizon);
  }

  return { aggregate: aggregateForecast, byModel };
}
