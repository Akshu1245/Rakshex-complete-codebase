/**
 * Feature Flags Router — runtime toggles + percentage rollout.
 *
 * Public `list` exposes enabled flags to the app; admin procedures manage them.
 * `isFeatureEnabled` is the server-side helper for gating code paths.
 */
import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { featureFlags, type FeatureFlag } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

/** Deterministic 0-99 bucket for a key+subject so rollout is stable per user. */
function bucket(key: string, subject: string): number {
  let hash = 0;
  const str = `${key}:${subject}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100;
}

/** Server-side gate: returns whether a flag is on for an optional subject. */
export async function isFeatureEnabled(key: string, subject?: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key));
    if (!flag || !flag.enabled) return false;
    if (flag.rolloutPercentage >= 100) return true;
    if (flag.rolloutPercentage <= 0) return false;
    if (!subject) return true;
    return bucket(key, subject) < flag.rolloutPercentage;
  } catch (err) {
    logger.warn({ err, key }, "[FeatureFlags] lookup failed");
    return false;
  }
}

export const featureFlagsRouter = router({
  /** All flags (admin view, includes disabled). */
  listAll: adminProcedure.query(async (): Promise<FeatureFlag[]> => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(featureFlags).orderBy(featureFlags.key);
  }),

  /** Enabled flag keys for the current client (safe to expose). */
  enabled: publicProcedure.query(async (): Promise<string[]> => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(featureFlags).where(eq(featureFlags.enabled, true));
    return rows.map((r) => r.key);
  }),

  /** Create or update a flag. */
  upsert: adminProcedure
    .input(
      z.object({
        key: z
          .string()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9_.-]+$/, "lowercase letters, numbers, _ . - only"),
        description: z.string().max(300).default(""),
        enabled: z.boolean().default(false),
        rolloutPercentage: z.number().int().min(0).max(100).default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .insert(featureFlags)
        .values({
          key: input.key,
          description: input.description,
          enabled: input.enabled,
          rolloutPercentage: input.rolloutPercentage,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: {
            description: input.description,
            enabled: input.enabled,
            rolloutPercentage: input.rolloutPercentage,
            updatedAt: new Date(),
          },
        });
      return { success: true };
    }),

  /** Quick enable/disable toggle. */
  toggle: adminProcedure
    .input(z.object({ key: z.string().min(1).max(80), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(featureFlags)
        .set({ enabled: input.enabled, updatedAt: new Date() })
        .where(eq(featureFlags.key, input.key));
      return { success: true };
    }),
});
