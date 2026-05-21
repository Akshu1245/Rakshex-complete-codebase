/**
 * Demo data seed script for investor presentations.
 *
 * Populates a fresh database with realistic-looking demo data:
 *   - A demo user account
 *   - Sample API collections (Postman + OpenAPI)
 *   - Completed scans with findings across all severities
 *   - Token usage history with cost data
 *   - Kill-switch events
 *   - Red-team run history
 *   - Compliance scores
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *
 * Requires DATABASE_URL in environment.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { hashPassword } from "../server/utils/password";

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set. Aborting.");
    process.exit(1);
  }

  const connection = await mysql.createConnection(dbUrl);
  const db = drizzle(connection, { schema, mode: "default" });

  console.log("🌱 Seeding demo data...");

  // 1. Create demo user
  const demoUser = {
    openId: "demo-user-openid",
    email: "demo@rakshex.in",
    name: "Demo User",
    passwordHash: hashPassword("demo123456"),
    role: "admin" as const,
    plan: "pro" as const,
  };

  await db
    .insert(schema.users)
    .values(demoUser as any)
    .onDuplicateKeyUpdate({
      set: { name: "Demo User", plan: "pro" as const },
    });

  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where({ email: "demo@rakshex.in" } as any);
  const userId = user.id;

  console.log(`   ✅ User created (id: ${userId})`);

  // 2. Create sample collections
  const collections = [
    {
      userId,
      name: "E-Commerce API (Production)",
      description: "Live e-commerce endpoints — payment, cart, user profiles",
      format: "postman" as const,
      data: JSON.stringify({
        info: { name: "E-Commerce API", _postman_id: "demo-ecom-1" },
        item: [
          {
            name: "Checkout",
            request: { method: "POST", url: "http://api.example.com/checkout", header: [] },
          },
          {
            name: "Get Cart",
            request: {
              method: "GET",
              url: "https://api.example.com/cart",
              header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            },
          },
          {
            name: "User Profile",
            request: {
              method: "GET",
              url: "https://api.example.com/users/{{userId}}",
              header: [{ key: "X-API-Key", value: "sk-abc123..." }],
            },
          },
        ],
      }),
      endpointCount: 3,
    },
    {
      userId,
      name: "Mobile Backend (OpenAPI)",
      description: "REST API for mobile app — auth, notifications, payments",
      format: "openapi" as const,
      data: JSON.stringify({
        openapi: "3.0.0",
        info: { title: "Mobile Backend API" },
        paths: {
          "/auth/login": { post: { summary: "User login" } },
          "/auth/refresh": { post: { summary: "Refresh token" } },
          "/notifications/send": { post: { summary: "Send push notification" } },
          "/payments/create": { post: { summary: "Create payment intent" } },
        },
      }),
      endpointCount: 4,
    },
    {
      userId,
      name: "LLM Gateway Routes",
      description: "AI proxy endpoints — OpenAI, Anthropic, Bedrock adapters",
      format: "openapi" as const,
      data: JSON.stringify({
        openapi: "3.0.0",
        info: { title: "LLM Gateway" },
        paths: {
          "/v1/chat/completions": { post: { summary: "OpenAI chat" } },
          "/v1/messages": { post: { summary: "Anthropic messages" } },
          "/v1/embeddings": { post: { summary: "Embeddings" } },
        },
      }),
      endpointCount: 3,
    },
  ];

  const createdCollections: any[] = [];
  for (const col of collections) {
    await db
      .insert(schema.collections)
      .values(col as any)
      .onDuplicateKeyUpdate({
        set: { data: col.data },
      });
    const [c] = await db
      .select({ id: schema.collections.id })
      .from(schema.collections)
      .where({ userId, name: col.name } as any);
    createdCollections.push(c);
  }

  console.log(`   ✅ ${collections.length} collections created`);

  // 3. Create scans with findings
  const scans = createdCollections.map((col, i) => ({
    userId,
    collectionId: col.id,
    scanType: i === 0 ? "full" : i === 1 ? "prompt_injection" : "shadow_api",
    status: "completed" as const,
    triggeredBy: i === 0 ? "manual" : "github_push",
    branch: "main",
    totalEndpoints: i === 0 ? 12 : i === 1 ? 8 : 5,
    scannedEndpoints: i === 0 ? 12 : i === 1 ? 8 : 5,
    findingsCount: i === 0 ? 4 : i === 1 ? 2 : 1,
    scanDurationMs: i === 0 ? 3400 : i === 1 ? 2100 : 1500,
    createdAt: new Date(Date.now() - (2 - i) * 3600000),
  }));

  const createdScans: any[] = [];
  for (const scan of scans) {
    const [s] = await db
      .insert(schema.scans)
      .values(scan as any)
      .$returningId();
    createdScans.push(s);
  }

  console.log(`   ✅ ${scans.length} scans created`);

  // 4. Create findings across all severities
  const findings = [
    {
      scanId: createdScans[0].id,
      userId,
      title: "EXPOSED: OpenAI API Key found in collection",
      severity: "Critical" as const,
      category: "Secret Leak",
      endpoint: "GET /users/{{userId}}",
      remediation: "Move API key to environment variables. Rotate immediately.",
      status: "open" as const,
      riskScore: 95,
    },
    {
      scanId: createdScans[0].id,
      userId,
      title: "Insecure HTTP endpoint — data transmitted in plaintext",
      severity: "High" as const,
      category: "OWASP API2:2023",
      endpoint: "POST http://api.example.com/checkout",
      remediation: "Change to HTTPS. Use TLS everywhere.",
      status: "open" as const,
      riskScore: 72,
    },
    {
      scanId: createdScans[0].id,
      userId,
      title: "BOLA vulnerability — user ID in URL without authorization check",
      severity: "Critical" as const,
      category: "OWASP API1:2023",
      endpoint: "GET /users/{{userId}}",
      remediation: "Add authorization check: verify authenticated user owns this resource.",
      status: "in-progress" as const,
      riskScore: 90,
    },
    {
      scanId: createdScans[0].id,
      userId,
      title: "Missing authentication header",
      severity: "Medium" as const,
      category: "OWASP API2:2023",
      endpoint: "POST /checkout",
      remediation: "Add Authorization: Bearer <token> header.",
      status: "open" as const,
      riskScore: 45,
    },
    {
      scanId: createdScans[1].id,
      userId,
      title: "Prompt injection vector detected in /chat endpoint",
      severity: "High" as const,
      category: "OWASP LLM01:2025",
      endpoint: "POST /v1/chat/completions",
      remediation: "Add input sanitization. Deploy prompt-injection classifier.",
      status: "open" as const,
      riskScore: 78,
    },
    {
      scanId: createdScans[1].id,
      userId,
      title: "No rate limiting on LLM endpoint",
      severity: "Medium" as const,
      category: "OWASP API4:2023",
      endpoint: "POST /v1/messages",
      remediation: "Add rate limiting: 60 requests/minute per user.",
      status: "resolved" as const,
      riskScore: 35,
    },
    {
      scanId: createdScans[2].id,
      userId,
      title: "Shadow API: undocumented /admin/debug endpoint detected",
      severity: "High" as const,
      category: "Shadow API",
      endpoint: "GET /admin/debug",
      remediation: "Document or remove. Add authentication requirement.",
      status: "open" as const,
      riskScore: 68,
    },
  ];

  for (const f of findings) {
    await db.insert(schema.findings).values(f as any);
  }

  console.log(`   ✅ ${findings.length} findings created`);

  // 5. Create token usage history (30 days)
  const models = ["gpt-4o", "gpt-4o-mini", "claude-3-opus", "gpt-3.5-turbo"];
  for (let day = 0; day < 30; day++) {
    for (const model of models) {
      const tokens = Math.floor(Math.random() * 50000) + 5000;
      const costPer1k = model.includes("claude") ? 0.015 : model.includes("4o") ? 0.01 : 0.002;
      const cost = (tokens / 1000) * costPer1k;
      await db.insert(schema.tokenUsage).values({
        userId,
        model,
        totalTokens: tokens,
        promptTokens: Math.floor(tokens * 0.6),
        completionTokens: Math.floor(tokens * 0.4),
        costUsd: Number(cost.toFixed(6)),
        endpoint: "/v1/chat/completions",
        timestamp: new Date(Date.now() - day * 86400000),
      } as any);
    }
  }

  console.log(`   ✅ 30 days of token usage created (${30 * 4} entries)`);

  // 6. Create kill-switch events
  await db.insert(schema.killSwitchEvents).values([
    {
      userId,
      event: "budget_exceeded",
      description: "Daily budget of $50 exceeded",
      severity: "critical",
      triggeredAt: new Date(Date.now() - 86400000),
    },
    {
      userId,
      event: "anomaly_detected",
      description: "Spike: 847 reasoning calls in 6 hours",
      severity: "high",
      triggeredAt: new Date(Date.now() - 172800000),
    },
  ] as any);

  console.log("   ✅ Kill-switch events created");

  // 7. Create red-team run history
  await db.insert(schema.redteamRuns).values({
    userId,
    status: "completed",
    totalPayloads: 87,
    blockedPayloads: 83,
    securityScore: 95.4,
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 3580000),
  } as any);

  console.log("   ✅ Red-team run history created");

  // 8. Create autofix suggestions
  await db.insert(schema.autofixSuggestions).values([
    {
      userId,
      findingId: 1,
      title: "Move API key to .env",
      description: "Replace hardcoded API keys with environment variable references",
      code: `// Before (Vulnerable)\nconst API_KEY = "sk-abc123...";\n\n// After (Secure)\nconst API_KEY = process.env.OPENAI_API_KEY;`,
      language: "typescript",
      status: "open",
    },
  ]);

  console.log("   ✅ Autofix suggestions created");

  await connection.end();
  console.log("\n🎉 Demo data seeded successfully!");
  console.log("   Login: demo@rakshex.in / demo123456");
  console.log(`   Dashboard: http://localhost:3000/dashboard`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
