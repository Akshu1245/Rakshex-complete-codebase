#!/usr/bin/env bash
set -euo pipefail

# RaksHex Database Seeder
# Populates core tables with demo data for local development.
# Requires: DATABASE_URL env var, pnpm, Node.js 20+

cd "$(dirname "$0")/.."

echo "=== RaksHex Seeder ==="
echo "Seeding database at: ${DATABASE_URL:-<not set>}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Export it before running this script."
  echo "Example: export DATABASE_URL=postgres://user:pass@localhost:5432/rakshex"
  exit 1
fi

# Check drizzle migration has been applied
pnpm exec tsx -e "
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './drizzle/schema';
import { hashPassword } from './server/utils/password';
import { eq } from 'drizzle-orm';

async function seed() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  // Seed admin user if not exists
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, 'admin@rakshex.in'));
  if (existing.length === 0) {
    const passwordHash = await hashPassword('admin12345');
    await db.insert(schema.users).values({
      openId: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
      name: 'RaksHex Admin',
      email: 'admin@rakshex.in',
      loginMethod: 'email',
      role: 'admin',
      plan: 'enterprise',
      passwordHash,
      scansRemaining: 1000,
      onboardingCompleted: true,
    });
    console.log('  admin@rakshex.in / admin12345');
  }

  // Seed demo user
  const demoUser = await db.select().from(schema.users).where(eq(schema.users.email, 'demo@rakshex.in'));
  if (demoUser.length === 0) {
    const passwordHash = await hashPassword('demo12345');
    await db.insert(schema.users).values({
      openId: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
      name: 'Demo User',
      email: 'demo@rakshex.in',
      loginMethod: 'email',
      role: 'user',
      plan: 'pro',
      passwordHash,
      scansRemaining: 50,
      onboardingCompleted: true,
    });
    console.log('  demo@rakshex.in / demo12345');
  }

  // Seed feature flags
  const flags = [
    { key: 'public_demo', enabled: true, description: 'Enable public demo scanner', rolloutPercentage: 100 },
    { key: 'realtime_notifications', enabled: true, description: 'Enable real-time notifications', rolloutPercentage: 100 },
    { key: 'vscode_extension', enabled: true, description: 'Enable VS Code extension features', rolloutPercentage: 100 },
    { key: 'waitlist_open', enabled: true, description: 'Accept new waitlist signups', rolloutPercentage: 100 },
  ];
  for (const f of flags) {
    const existingFlag = await db.select().from(schema.featureFlags).where(eq(schema.featureFlags.key, f.key));
    if (existingFlag.length === 0) {
      await db.insert(schema.featureFlags).values(f);
    }
  }
  console.log('  feature flags seeded');

  // Seed notifications for demo user
  const notifs = [
    { userId: 1, type: 'welcome', title: 'Welcome to RaksHex', body: 'Your AI governance journey starts here.', read: false },
    { userId: 1, type: 'scan', title: 'First Scan Complete', body: 'Run your first security scan from the dashboard.', read: false },
  ];
  for (const n of notifs) {
    await db.insert(schema.notifications).values(n);
  }
  console.log('  notifications seeded');

  await client.end();
  console.log('\\nSeeding complete.');
}

seed().catch((err) => { console.error(err); process.exit(1); });
"

echo "Done."
