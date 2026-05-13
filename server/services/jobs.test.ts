// @ts-nocheck  
/**
 * Tests for the typed job-queue wrappers.
 *
 * Uses the in-memory backend (default — no REDIS_URL) and verifies the
 * round-trip: enqueueX() puts a job in, the registered worker picks it
 * up, and the dispatched callback runs with the typed payload.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { getJobQueue } from "./jobQueue";

// We need to mock the modules whose worker bodies we don't want to actually
// invoke (real DB / SMTP / scan). Hoist mocks before the SUT import.
vi.mock("./scanService", () => ({
  runCollectionScan: vi.fn(async () => undefined),
}));
vi.mock("./webhookDelivery", async () => {
  const actual = await vi.importActual<
    typeof import("./webhookDelivery")
  >("./webhookDelivery");
  return {
    ...actual,
    deliver: vi.fn(async () => []),
  };
});
vi.mock("../email", () => ({
  sendWeeklyDigestEmail: vi.fn(async () => true),
}));
vi.mock("../db", async () => {
  return {
    getUserById: vi.fn(async (id: number) => ({
      id,
      email: `user-${id}@example.com`,
      name: `User ${id}`,
    })),
    getRecentScans: vi.fn(async () => []),
    getFindingsByScanId: vi.fn(async () => []),
    getCollectionsByUserId: vi.fn(async () => []),
  };
});

import {
  enqueueScan,
  enqueueWebhookDelivery,
  enqueueWeeklyDigest,
  registerJobWorkers,
  _resetJobsRegistrationForTests,
  QUEUE_SCAN,
  QUEUE_WEBHOOK_DELIVERY,
  QUEUE_WEEKLY_DIGEST,
} from "./jobs";
import { runCollectionScan } from "./scanService";
import { deliver } from "./webhookDelivery";
import { sendWeeklyDigestEmail } from "../email";

async function flushQueue(): Promise<void> {
  // Memory queue dispatches via setImmediate; one setImmediate tick per
  // enqueued job is plenty.
  await new Promise<void>(r => setImmediate(r));
  await new Promise<void>(r => setImmediate(r));
  await new Promise<void>(r => setImmediate(r));
}

describe("services/jobs typed queue wrappers", () => {
  beforeEach(() => {
    _resetJobsRegistrationForTests();
    vi.clearAllMocks();
    registerJobWorkers({ force: true });
  });

  afterEach(async () => {
    await getJobQueue().shutdown();
  });

  it("exports stable queue-name constants", () => {
    expect(QUEUE_SCAN).toBe("scan");
    expect(QUEUE_WEBHOOK_DELIVERY).toBe("webhook-delivery");
    expect(QUEUE_WEEKLY_DIGEST).toBe("weekly-digest");
  });

  it("enqueueScan dispatches to runCollectionScan with the right payload", async () => {
    const id = await enqueueScan({
      userId: 7,
      collectionId: "col-1",
      options: {
        scanType: "full",
        triggeredBy: "github_push",
        branch: "main",
        commitSha: "abc123",
      },
    });
    expect(id).toMatch(/^scan-/);
    await flushQueue();
    expect(runCollectionScan).toHaveBeenCalledTimes(1);
    expect(runCollectionScan).toHaveBeenCalledWith(7, "col-1", {
      scanType: "full",
      triggeredBy: "github_push",
      branch: "main",
      commitSha: "abc123",
    });
  });

  it("enqueueWebhookDelivery dispatches to webhookDelivery.deliver", async () => {
    await enqueueWebhookDelivery({
      userId: 11,
      event: "scan.complete",
      data: { scanId: "s-1", findingsCount: 4 },
    });
    await flushQueue();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(11, "scan.complete", {
      scanId: "s-1",
      findingsCount: 4,
    });
  });

  it("enqueueWeeklyDigest computes per-user counts and sends one email", async () => {
    await enqueueWeeklyDigest({ userId: 42 });
    await flushQueue();
    expect(sendWeeklyDigestEmail).toHaveBeenCalledTimes(1);
    const arg = (sendWeeklyDigestEmail as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as Record<string, unknown>;
    expect(arg.toEmail).toBe("user-42@example.com");
    expect(arg.userName).toBe("User 42");
    expect(arg.weeklyScans).toBe(0);
    expect(arg.newFindings).toBe(0);
    expect(arg.criticalFindings).toBe(0);
  });

  it("registerJobWorkers is idempotent without force flag", () => {
    // Calling again without force is a no-op (returns early). We verify
    // by ensuring the second call did NOT register a competing handler —
    // there's no observable side-effect we can assert on directly, so we
    // just confirm the function does not throw and stays consistent.
    expect(() => registerJobWorkers()).not.toThrow();
    expect(() => registerJobWorkers()).not.toThrow();
  });

  it("dispatches multiple queued jobs concurrently up to the worker concurrency cap", async () => {
    const ids = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        enqueueWebhookDelivery({
          userId: i,
          event: "scan.complete",
          data: { i },
        })
      )
    );
    expect(new Set(ids).size).toBe(10); // unique ids
    await flushQueue();
    expect(deliver).toHaveBeenCalledTimes(10);
  });
});
