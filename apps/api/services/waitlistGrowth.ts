import crypto from "crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

const VERIFY_TTL_HOURS = 48;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX = 6;

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
]);

export type WaitlistQualification = {
  evaluationType?: string;
  role?: string;
  company?: string;
  agentStage?: string;
  providers?: string[];
  frameworks?: string[];
  monthlySpend?: string;
  pain?: string;
  pilotInterest?: string;
  designPartner?: boolean;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  referrer?: string;
  referredByCode?: string;
};

export type WaitlistAdminEntry = {
  id: number;
  email: string;
  evaluationType: string;
  source: string;
  role: string | null;
  company: string | null;
  agentStage: string | null;
  providers: string[];
  frameworks: string[];
  monthlySpend: string | null;
  pain: string | null;
  pilotInterest: string | null;
  designPartner: boolean;
  referralCode: string;
  referralCount: number;
  verified: boolean;
  verifiedAt: Date | null;
  qualificationScore: number;
  fraudScore: number;
  flagged: boolean;
  status: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  referrer: string | null;
  createdAt: Date;
};

let schemaPromise: Promise<void> | null = null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function newReferralCode(): string {
  return crypto.randomBytes(6).toString("base64url");
}

function newVerifyToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as T[]) : [];
  }
  return [];
}

function arrayFromJson(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function qualificationScore(input: WaitlistQualification): number {
  let score = 0;
  if (input.role) score += 8;
  if (input.company) score += 5;
  if ((input.providers?.length ?? 0) > 0) score += 8;
  if ((input.frameworks?.length ?? 0) > 0) score += 8;
  if (input.pain) score += 12;
  if (input.agentStage === "production") score += 24;
  else if (input.agentStage === "internal") score += 14;
  else if (input.agentStage === "exploring") score += 6;

  if (input.pilotInterest === "yes") score += 25;
  else if (input.pilotInterest === "maybe") score += 12;

  if (input.designPartner) score += 10;
  if (input.monthlySpend && !["unknown", "under-100"].includes(input.monthlySpend)) score += 8;
  return Math.min(100, score);
}

function fraudScore(email: string, formStartedAt?: number, userAgent?: string): number {
  let score = 0;
  const [local, domain = ""] = email.split("@");
  if (DISPOSABLE_DOMAINS.has(domain)) score += 80;
  if (local?.includes("+")) score += 5;
  if (!userAgent) score += 10;
  if (formStartedAt && Date.now() - formStartedAt < 800) score += 55;
  return Math.min(100, score);
}

async function ensureSchema(): Promise<void> {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS waitlist_growth (
        id SERIAL PRIMARY KEY,
        email VARCHAR(320) NOT NULL UNIQUE,
        evaluation_type VARCHAR(64) NOT NULL DEFAULT 'Team pilot',
        source VARCHAR(128) NOT NULL DEFAULT 'waitlist',
        role VARCHAR(96),
        company VARCHAR(192),
        agent_stage VARCHAR(32),
        providers JSONB NOT NULL DEFAULT '[]'::jsonb,
        frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
        monthly_spend VARCHAR(32),
        pain VARCHAR(128),
        pilot_interest VARCHAR(32),
        design_partner BOOLEAN NOT NULL DEFAULT FALSE,
        referral_code VARCHAR(24) NOT NULL UNIQUE,
        referred_by_code VARCHAR(24),
        referral_count INTEGER NOT NULL DEFAULT 0,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        verify_token_hash VARCHAR(64),
        verify_expires_at TIMESTAMP,
        verified_at TIMESTAMP,
        qualification_score INTEGER NOT NULL DEFAULT 0,
        fraud_score INTEGER NOT NULL DEFAULT 0,
        flagged BOOLEAN NOT NULL DEFAULT FALSE,
        signup_ip_hash VARCHAR(64),
        user_agent_hash VARCHAR(64),
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        utm_source VARCHAR(128),
        utm_medium VARCHAR(128),
        utm_campaign VARCHAR(192),
        utm_content VARCHAR(192),
        referrer VARCHAR(1024),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS waitlist_growth_created_idx ON waitlist_growth(created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS waitlist_growth_verified_idx ON waitlist_growth(verified)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS waitlist_growth_source_idx ON waitlist_growth(source)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS waitlist_growth_ip_idx ON waitlist_growth(signup_ip_hash, created_at DESC)`);
  })();
  return schemaPromise;
}

type SignupArgs = WaitlistQualification & {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  formStartedAt?: number;
  honeypot?: string;
};

export async function registerWaitlistSignup(input: SignupArgs): Promise<{
  accepted: true;
  verificationToken?: string;
  normalizedEmail: string;
  suppressedAsBot?: boolean;
}> {
  await ensureSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const email = normalizeEmail(input.email);
  const ipHash = input.ip ? sha256(`rakshex-waitlist:${input.ip}`) : null;
  const userAgentHash = input.userAgent ? sha256(input.userAgent) : null;
  const risk = fraudScore(email, input.formStartedAt, input.userAgent ?? undefined);
  const flagged = risk >= 70;

  // Honeypots get a generic success without persistence so bots cannot tune around the trap.
  if (input.honeypot?.trim()) {
    return { accepted: true, normalizedEmail: email, suppressedAsBot: true };
  }

  if (ipHash) {
    const recent = rowsOf<{ count: number }>(await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM waitlist_growth
      WHERE signup_ip_hash = ${ipHash}
        AND created_at > NOW() - (${RATE_LIMIT_WINDOW_MINUTES} * INTERVAL '1 minute')
    `));
    if (Number(recent[0]?.count ?? 0) >= RATE_LIMIT_MAX) {
      const err = new Error("RATE_LIMITED");
      err.name = "RateLimitError";
      throw err;
    }
  }

  const existing = rowsOf<{ id: number; verified: boolean }>(await db.execute(sql`
    SELECT id, verified
    FROM waitlist_growth
    WHERE email = ${email}
    LIMIT 1
  `));

  const verifyToken = newVerifyToken();
  const verifyTokenHash = sha256(verifyToken);
  const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);
  const score = qualificationScore(input);

  if (existing[0]) {
    // Never downgrade a previously verified user. Pending users receive a fresh verification token.
    if (!existing[0].verified) {
      await db.execute(sql`
        UPDATE waitlist_growth SET
          evaluation_type = COALESCE(${input.evaluationType ?? null}, evaluation_type),
          role = COALESCE(${input.role ?? null}, role),
          company = COALESCE(${input.company ?? null}, company),
          agent_stage = COALESCE(${input.agentStage ?? null}, agent_stage),
          providers = ${JSON.stringify(input.providers ?? [])}::jsonb,
          frameworks = ${JSON.stringify(input.frameworks ?? [])}::jsonb,
          monthly_spend = COALESCE(${input.monthlySpend ?? null}, monthly_spend),
          pain = COALESCE(${input.pain ?? null}, pain),
          pilot_interest = COALESCE(${input.pilotInterest ?? null}, pilot_interest),
          design_partner = ${Boolean(input.designPartner)},
          source = COALESCE(${input.source ?? null}, source),
          utm_source = COALESCE(${input.utmSource ?? null}, utm_source),
          utm_medium = COALESCE(${input.utmMedium ?? null}, utm_medium),
          utm_campaign = COALESCE(${input.utmCampaign ?? null}, utm_campaign),
          utm_content = COALESCE(${input.utmContent ?? null}, utm_content),
          referrer = COALESCE(${input.referrer ?? null}, referrer),
          referred_by_code = COALESCE(referred_by_code, ${input.referredByCode ?? null}),
          qualification_score = GREATEST(qualification_score, ${score}),
          fraud_score = GREATEST(fraud_score, ${risk}),
          flagged = flagged OR ${flagged},
          verify_token_hash = ${verifyTokenHash},
          verify_expires_at = ${expiresAt},
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `);
      return { accepted: true, normalizedEmail: email, verificationToken: verifyToken };
    }
    return { accepted: true, normalizedEmail: email };
  }

  let referralCode = newReferralCode();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const collision = rowsOf<Record<string, unknown>>(await db.execute(sql`
      SELECT 1 FROM waitlist_growth WHERE referral_code = ${referralCode} LIMIT 1
    `));
    if (collision.length === 0) break;
    referralCode = newReferralCode();
  }

  await db.execute(sql`
    INSERT INTO waitlist_growth (
      email, evaluation_type, source, role, company, agent_stage, providers, frameworks,
      monthly_spend, pain, pilot_interest, design_partner, referral_code, referred_by_code,
      verify_token_hash, verify_expires_at, qualification_score, fraud_score, flagged,
      signup_ip_hash, user_agent_hash, utm_source, utm_medium, utm_campaign, utm_content, referrer
    ) VALUES (
      ${email}, ${input.evaluationType ?? "Team pilot"}, ${input.source ?? "waitlist"},
      ${input.role ?? null}, ${input.company ?? null}, ${input.agentStage ?? null},
      ${JSON.stringify(input.providers ?? [])}::jsonb, ${JSON.stringify(input.frameworks ?? [])}::jsonb,
      ${input.monthlySpend ?? null}, ${input.pain ?? null}, ${input.pilotInterest ?? null},
      ${Boolean(input.designPartner)}, ${referralCode}, ${input.referredByCode ?? null},
      ${verifyTokenHash}, ${expiresAt}, ${score}, ${risk}, ${flagged}, ${ipHash}, ${userAgentHash},
      ${input.utmSource ?? null}, ${input.utmMedium ?? null}, ${input.utmCampaign ?? null},
      ${input.utmContent ?? null}, ${input.referrer ?? null}
    )
  `);

  // Keep the original waitlist table populated for backwards compatibility with existing exports/ops.
  await db.execute(sql`
    INSERT INTO waitlist (email, plan, source)
    VALUES (${email}, ${input.evaluationType ?? "Team pilot"}, ${(input.source ?? "waitlist").slice(0, 64)})
    ON CONFLICT (email) DO UPDATE SET
      plan = EXCLUDED.plan,
      source = EXCLUDED.source
  `);

  return { accepted: true, normalizedEmail: email, verificationToken: verifyToken };
}

export async function verifyWaitlistEmail(token: string): Promise<{
  verified: true;
  alreadyVerified: boolean;
  referralCode: string;
  referralCount: number;
  position: number;
  email: string;
}> {
  await ensureSchema();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const tokenHash = sha256(token);

  return db.transaction(async (tx) => {
    const rows = rowsOf<{
      id: number;
      email: string;
      verified: boolean;
      referral_code: string;
      referred_by_code: string | null;
      referral_count: number;
      verify_expires_at: Date | null;
    }>(await tx.execute(sql`
      SELECT id, email, verified, referral_code, referred_by_code, referral_count, verify_expires_at
      FROM waitlist_growth
      WHERE verify_token_hash = ${tokenHash}
      LIMIT 1
    `));

    const row = rows[0];
    if (!row) throw new Error("INVALID_TOKEN");
    if (!row.verified && (!row.verify_expires_at || new Date(row.verify_expires_at).getTime() < Date.now())) {
      throw new Error("EXPIRED_TOKEN");
    }

    let alreadyVerified = row.verified;
    if (!row.verified) {
      const updated = rowsOf<{ id: number }>(await tx.execute(sql`
        UPDATE waitlist_growth
        SET verified = TRUE, verified_at = NOW(), verify_expires_at = NULL, status = 'verified', updated_at = NOW()
        WHERE id = ${row.id} AND verified = FALSE
        RETURNING id
      `));

      if (updated.length > 0 && row.referred_by_code) {
        await tx.execute(sql`
          UPDATE waitlist_growth
          SET referral_count = referral_count + 1, updated_at = NOW()
          WHERE referral_code = ${row.referred_by_code}
        `);
      } else if (updated.length === 0) {
        alreadyVerified = true;
      }
    }

    const refreshed = rowsOf<{ referral_code: string; referral_count: number; created_at: Date }>(await tx.execute(sql`
      SELECT referral_code, referral_count, created_at
      FROM waitlist_growth
      WHERE id = ${row.id}
      LIMIT 1
    `));
    const current = refreshed[0];
    if (!current) throw new Error("INVALID_TOKEN");

    const positionRows = rowsOf<{ position: number }>(await tx.execute(sql`
      SELECT COUNT(*)::int AS position
      FROM waitlist_growth
      WHERE verified = TRUE AND created_at <= ${current.created_at}
    `));

    return {
      verified: true as const,
      alreadyVerified,
      referralCode: current.referral_code,
      referralCount: Number(current.referral_count ?? 0),
      position: Math.max(1, Number(positionRows[0]?.position ?? 1)),
      email: row.email,
    };
  });
}

export async function listWaitlistGrowthEntries(): Promise<WaitlistAdminEntry[]> {
  await ensureSchema();
  const db = await getDb();
  if (!db) return [];
  const rows = rowsOf<Record<string, unknown>>(await db.execute(sql`
    SELECT
      id, email, evaluation_type, source, role, company, agent_stage, providers, frameworks,
      monthly_spend, pain, pilot_interest, design_partner, referral_code, referral_count,
      verified, verified_at, qualification_score, fraud_score, flagged, status,
      utm_source, utm_medium, utm_campaign, utm_content, referrer, created_at
    FROM waitlist_growth
    ORDER BY created_at DESC, id DESC
  `));

  return rows.map((row) => ({
    id: Number(row.id),
    email: String(row.email ?? ""),
    evaluationType: String(row.evaluation_type ?? "Team pilot"),
    source: String(row.source ?? "waitlist"),
    role: row.role ? String(row.role) : null,
    company: row.company ? String(row.company) : null,
    agentStage: row.agent_stage ? String(row.agent_stage) : null,
    providers: arrayFromJson(row.providers),
    frameworks: arrayFromJson(row.frameworks),
    monthlySpend: row.monthly_spend ? String(row.monthly_spend) : null,
    pain: row.pain ? String(row.pain) : null,
    pilotInterest: row.pilot_interest ? String(row.pilot_interest) : null,
    designPartner: Boolean(row.design_partner),
    referralCode: String(row.referral_code ?? ""),
    referralCount: Number(row.referral_count ?? 0),
    verified: Boolean(row.verified),
    verifiedAt: row.verified_at ? new Date(String(row.verified_at)) : null,
    qualificationScore: Number(row.qualification_score ?? 0),
    fraudScore: Number(row.fraud_score ?? 0),
    flagged: Boolean(row.flagged),
    status: String(row.status ?? "pending"),
    utmSource: row.utm_source ? String(row.utm_source) : null,
    utmMedium: row.utm_medium ? String(row.utm_medium) : null,
    utmCampaign: row.utm_campaign ? String(row.utm_campaign) : null,
    utmContent: row.utm_content ? String(row.utm_content) : null,
    referrer: row.referrer ? String(row.referrer) : null,
    createdAt: new Date(String(row.created_at)),
  }));
}

export async function getWaitlistGrowthCount(): Promise<number> {
  await ensureSchema();
  const db = await getDb();
  if (!db) return 0;
  const rows = rowsOf<{ count: number }>(await db.execute(sql`SELECT COUNT(*)::int AS count FROM waitlist_growth`));
  return Number(rows[0]?.count ?? 0);
}
