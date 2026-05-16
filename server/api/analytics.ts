/**
 * Analytics Router — AI Telemetry dashboards
 *
 * Provides aggregated analytics over stored ai_events: spend breakdown,
 * model mix, agent leaderboard, anomaly detection.
 */
import { router, protectedProcedure } from "../_core/trpc";
import { logger } from "../_core/logger";
import { z } from "zod";
import * as db from "../db";
import { redis } from "../_core/cache";
import { toNumber } from "../utils/decimal";

export const analyticsRouter = router({
  /**
   * Aggregated summary for a date range. Group by day, hour, model, or provider.
   */
  summary: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        groupBy: z.enum(["day", "hour", "model", "provider"]).default("day"),
      }),
    )
    .query(async ({ input, ctx }) => {
      const events = await db.listAiEvents(ctx.user.id, {
        limit: 5000,
        offset: 0,
      });

      const filtered = events.events.filter((e) => {
        const ts = new Date(e.requestTimestamp);
        return ts >= new Date(input.startDate) && ts <= new Date(input.endDate);
      });

      const groups: Record<string, {
        totalTokens: number;
        totalCost: number;
        latencies: number[];
        errorCount: number;
        requestCount: number;
      }> = {};

      for (const e of filtered) {
        let key = "";
        const ts = new Date(e.requestTimestamp);
        switch (input.groupBy) {
          case "day":
            key = ts.toISOString().slice(0, 10);
            break;
          case "hour":
            key = ts.toISOString().slice(0, 13);
            break;
          case "model":
            key = e.model;
            break;
          case "provider":
            key = e.provider;
            break;
        }

        if (!groups[key]) {
          groups[key] = {
            totalTokens: 0,
            totalCost: 0,
            latencies: [],
            errorCount: 0,
            requestCount: 0,
          };
        }

        groups[key].totalTokens += e.inputTokens + e.outputTokens;
        groups[key].totalCost += toNumber(e.costUsd);
        groups[key].latencies.push(e.latencyMs);
        groups[key].requestCount++;
        if (e.status === "error") groups[key].errorCount++;
      }

      return Object.entries(groups).map(([key, g]) => {
        const sorted = g.latencies.sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
        return {
          key,
          totalTokens: g.totalTokens,
          totalCost: Math.round(g.totalCost * 100) / 100,
          avgLatencyP50: p50,
          avgLatencyP95: p95,
          errorRate: g.requestCount > 0
            ? Math.round((g.errorCount / g.requestCount) * 10000) / 100
            : 0,
          requestCount: g.requestCount,
        };
      });
    }),

  /**
   * Model mix — breakdown of requests + cost by provider + model.
   */
  modelMix: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const events = await db.listAiEvents(ctx.user.id, {
        limit: 5000,
      });

      const mix: Record<string, {
        provider: string;
        model: string;
        requests: number;
        totalTokens: number;
        totalCost: number;
      }> = {};

      for (const e of events.events) {
        if (input.startDate && new Date(e.requestTimestamp) < new Date(input.startDate)) continue;
        if (input.endDate && new Date(e.requestTimestamp) > new Date(input.endDate)) continue;

        const key = `${e.provider}:${e.model}`;
        if (!mix[key]) {
          mix[key] = {
            provider: e.provider,
            model: e.model,
            requests: 0,
            totalTokens: 0,
            totalCost: 0,
          };
        }
        mix[key].requests++;
        mix[key].totalTokens += e.inputTokens + e.outputTokens;
        mix[key].totalCost += toNumber(e.costUsd);
      }

      return Object.values(mix)
        .map((m) => ({
          ...m,
          totalCost: Math.round(m.totalCost * 100) / 100,
        }))
        .sort((a, b) => b.totalCost - a.totalCost);
    }),

  /**
   * Top 10 agents ranked by cost or requests.
   */
  agentLeaderboard: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        sortBy: z.enum(["cost", "requests"]).default("cost"),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const events = await db.listAiEvents(ctx.user.id, {
        limit: 5000,
      });

      const agents: Record<string, {
        agentId: string;
        requests: number;
        inputTokens: number;
        outputTokens: number;
        totalCost: number;
        errors: number;
        latencies: number[];
      }> = {};

      for (const e of events.events) {
        if (input.startDate && new Date(e.requestTimestamp) < new Date(input.startDate)) continue;
        if (input.endDate && new Date(e.requestTimestamp) > new Date(input.endDate)) continue;

        const key = e.agentId;
        if (!agents[key]) {
          agents[key] = {
            agentId: key,
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
            errors: 0,
            latencies: [],
          };
        }
        agents[key].requests++;
        agents[key].inputTokens += e.inputTokens;
        agents[key].outputTokens += e.outputTokens;
        agents[key].totalCost += toNumber(e.costUsd);
        agents[key].latencies.push(e.latencyMs);
        if (e.status === "error") agents[key].errors++;
      }

      const sorted = Object.values(agents).sort((a, b) =>
        input.sortBy === "cost"
          ? b.totalCost - a.totalCost
          : b.requests - a.requests,
      );

      return sorted.slice(0, input.limit).map((a) => ({
        ...a,
        totalCost: Math.round(a.totalCost * 100) / 100,
        avgLatency: a.latencies.length > 0
          ? Math.round(a.latencies.reduce((s, l) => s + l, 0) / a.latencies.length)
          : 0,
        errorRate: a.requests > 0
          ? Math.round((a.errors / a.requests) * 10000) / 100
          : 0,
      }));
    }),

  /**
   * Simple anomaly detection: flag hours where cost exceeds 2x the
   * rolling 7-day average for the same hour.
   */
  anomalies: protectedProcedure
    .input(
      z.object({
        threshold: z.number().min(1).max(10).default(2),
      }),
    )
    .query(async ({ input, ctx }) => {
      const events = await db.listAiEvents(ctx.user.id, {
        limit: 5000,
      });

      // Build hourly cost buckets for last 14 days
      const hourlyCost: Record<string, number> = {};
      for (const e of events.events) {
        const ts = new Date(e.requestTimestamp);
        const key = ts.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        hourlyCost[key] = (hourlyCost[key] || 0) + toNumber(e.costUsd);
      }

      // Calculate 7-day rolling average per hour
      const hours = Object.keys(hourlyCost).sort();
      const anomalies: Array<{
        hour: string;
        cost: number;
        rollingAvg: number;
        magnitude: number;
      }> = [];

      for (let i = 7 * 24; i < hours.length; i++) {
        const current = hourlyCost[hours[i]];
        let sum = 0;
        let count = 0;

        // Look back ~7 days in the same hour slots
        for (let j = Math.max(0, i - 7 * 24); j < i; j++) {
          const sameDayHour = hours.filter(
            (h) => h.slice(11) === hours[i].slice(11),
          );
          for (const h of sameDayHour) {
            sum += hourlyCost[h] || 0;
            count++;
          }
          break; // Just one loop over same-day-hour matches
        }

        const avg = count > 0 ? sum / count : current;
        if (avg > 0 && current > avg * input.threshold) {
          anomalies.push({
            hour: hours[i],
            cost: Math.round(current * 100) / 100,
            rollingAvg: Math.round(avg * 100) / 100,
            magnitude: Math.round((current / avg) * 100) / 100,
          });
        }
      }

      return anomalies.slice(0, 50);
    }),
});
