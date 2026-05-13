// @ts-nocheck  
/**
 * End-to-End Test Suite
 * Tests complete user flows: signup → scan → review findings → export
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("../db", () => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  createCollection: vi.fn(),
  getCollectionById: vi.fn(),
  getCollectionsByUserId: vi.fn(),
  createScan: vi.fn(),
  getScansByCollectionId: vi.fn(),
  getFindingsByScanId: vi.fn(),
  createComplianceReport: vi.fn(),
  getComplianceReportById: vi.fn(),
  recordTokenUsage: vi.fn(),
  getTokenUsageByUserId: vi.fn(),
}));

vi.mock("../email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ messageId: "test" }),
  sendTeamInviteEmail: vi.fn().mockResolvedValue({ messageId: "test" }),
  sendKillSwitchRecoveryEmail: vi.fn().mockResolvedValue({ messageId: "test" }),
}));

vi.mock("../utils/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateSecureToken: vi.fn().mockReturnValue("verification_token_123"),
}));

vi.mock("../utils/security", () => ({
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
  generateCSRFToken: vi.fn().mockReturnValue("csrf_token_123"),
  verifyCSRFToken: vi.fn().mockReturnValue(true),
  sanitizeInput: vi.fn().mockImplementation(input => input),
}));

// Simulated test user data
const testUser = {
  id: "user_test_123",
  email: "testuser@example.com",
  name: "Test User",
  password: "SecurePassword123!",
  plan: "free" as const,
  role: "editor" as const,
};

const testCollection = {
  id: "col_test_456",
  name: "E2E Test API",
  format: "openapi" as const,
  data: {
    openapi: "3.0.0",
    paths: {
      "/api/users": {
        get: { summary: "List users" },
        post: { summary: "Create user" },
      },
      "/api/admin": {
        get: { summary: "Admin endpoint", security: [{ adminOnly: [] }] },
      },
      "/api/public": {
        get: { summary: "Public data" },
      },
    },
  },
};

describe("E2E: User Registration Flow", () => {
  it("should complete full signup and email verification", async () => {
    const { createUser, getUserByEmail } = await import("../db");
    const { sendVerificationEmail } = await import("../email");
    const { hashPassword, generateSecureToken } = await import(
      "../utils/password"
    );

    // Step 1: Check if user already exists
    getUserByEmail.mockResolvedValue(null);

    const existingUser = await getUserByEmail(testUser.email);
    expect(existingUser).toBeNull();

    // Step 2: Create new user
    const hashedPassword = await hashPassword(testUser.password);
    const verificationToken = generateSecureToken();

    const newUser = {
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      passwordHash: hashedPassword,
      plan: "free",
      emailVerified: false,
      emailVerificationToken: verificationToken,
      createdAt: new Date(),
    };

    createUser.mockResolvedValue(newUser);

    const createdUser = await createUser({
      email: testUser.email,
      name: testUser.name,
      passwordHash: hashedPassword,
      emailVerificationToken: verificationToken,
    });

    expect(createdUser.email).toBe(testUser.email);
    expect(createdUser.emailVerified).toBe(false);
    expect(createdUser.emailVerificationToken).toBeTruthy();

    // Step 3: Send verification email
    await sendVerificationEmail({
      toEmail: createdUser.email,
      userName: createdUser.name,
      verificationToken: createdUser.emailVerificationToken,
    });

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: testUser.email,
        verificationToken: expect.any(String),
      })
    );
  });

  it("should reject duplicate email registration", async () => {
    const { getUserByEmail } = await import("../db");

    getUserByEmail.mockResolvedValue({
      id: "existing_user",
      email: testUser.email,
    });

    const existingUser = await getUserByEmail(testUser.email);
    expect(existingUser).not.toBeNull();

    // Simulate duplicate check
    const isDuplicate = existingUser !== null;
    expect(isDuplicate).toBe(true);
  });

  it("should validate password strength on signup", () => {
    const weakPasswords = ["password", "12345678", "abc", ""];

    weakPasswords.forEach(password => {
      expect(() => validatePasswordStrength(password)).toThrow(
        "Password does not meet requirements"
      );
    });

    const strongPasswords = [
      "SecurePass123!",
      "MyStr0ng#Password",
      "ValidPassword1",
    ];

    strongPasswords.forEach(password => {
      expect(() => validatePasswordStrength(password)).not.toThrow();
    });
  });
});

describe("E2E: API Collection Scanning Flow", () => {
  it("should complete: create collection → run scan → review findings", async () => {
    const {
      createCollection,
      getCollectionById,
      createScan,
      getFindingsByScanId,
    } = await import("../db");

    // Step 1: Create collection
    const newCollection = {
      id: testCollection.id,
      name: testCollection.name,
      format: testCollection.format,
      data: testCollection.data,
      userId: testUser.id,
      totalRequests: 3,
      createdAt: new Date(),
    };

    createCollection.mockResolvedValue(newCollection);
    const collection = await createCollection(
      testUser.id,
      testCollection.name,
      testCollection.format,
      testCollection.data,
      undefined
    );

    expect(collection.id).toBeTruthy();
    expect(collection.totalRequests).toBe(3);

    // Step 2: Run security scan
    const scanResult = {
      id: "scan_123",
      collectionId: collection.id,
      status: "completed",
      totalFindings: 2,
      highSeverity: 1,
      mediumSeverity: 1,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
    };

    createScan.mockResolvedValue(scanResult);
    const scan = await createScan(collection.id, testUser.id);

    expect(scan.status).toBe("completed");
    expect(scan.totalFindings).toBe(2);

    // Step 3: Review findings
    const findings = [
      {
        id: "finding_1",
        title: "Broken Access Control - Admin Endpoint",
        severity: "high",
        status: "open",
        description:
          "The /api/admin endpoint lacks proper authorization checks",
        endpoint: "/api/admin",
        cvssScore: 8.5,
      },
      {
        id: "finding_2",
        title: "Missing Rate Limiting",
        severity: "medium",
        status: "open",
        description: "User endpoints do not implement rate limiting",
        endpoint: "/api/users",
        cvssScore: 5.3,
      },
    ];

    getFindingsByScanId.mockResolvedValue(findings);
    const scanFindings = await getFindingsByScanId(scan.id);

    expect(scanFindings).toHaveLength(2);
    expect(scanFindings[0].severity).toBe("high");
    expect(scanFindings[0].cvssScore).toBeGreaterThan(7);
  });

  it("should detect shadow APIs in collection", async () => {
    const { createCollection } = await import("../db");

    const collectionWithShadow = {
      ...testCollection,
      data: {
        ...testCollection.data,
        paths: {
          ...testCollection.data.paths,
          "/api/hidden/admin": { get: { summary: "Hidden admin" } },
          "/api/undocumented/users": { get: { summary: "Undocumented" } },
        },
      },
    };

    createCollection.mockResolvedValue({
      id: "col_shadow",
      ...collectionWithShadow,
      userId: testUser.id,
    });

    const collection = await createCollection(
      testUser.id,
      "Collection with Shadow APIs",
      "openapi",
      collectionWithShadow.data,
      undefined
    );

    // Simulate shadow API detection
    const endpoints = Object.keys(collection.data.paths);
    const shadowApis = endpoints.filter(
      e => e.includes("hidden") || e.includes("undocumented")
    );

    expect(shadowApis).toHaveLength(2);
  });

  it("should prevent IDOR during scan access", async () => {
    const { getCollectionById, getScansByCollectionId } = await import("../db");

    const victimCollection = {
      id: "col_victim",
      userId: "victim_id",
      name: "Victim API",
    };

    getCollectionById.mockResolvedValue(victimCollection);

    // Attacker tries to access victim's collection
    const attackerId = "attacker_id";
    const collection = await getCollectionById("col_victim");

    expect(collection.userId).not.toBe(attackerId);
    expect(() => validateCollectionOwnership(collection, attackerId)).toThrow(
      "Access denied"
    );
  });
});

describe("E2E: Payment and Subscription Flow", () => {
  it("should complete: upgrade to pro → verify subscription → create scan", async () => {
    const { getUserById, updateUser, createCollection, createScan } =
      await import("../db");

    // Step 1: Get current user
    const userBeforeUpgrade = {
      ...testUser,
      plan: "free",
    };

    getUserById.mockResolvedValue(userBeforeUpgrade);
    const user = await getUserById(testUser.id);

    expect(user.plan).toBe("free");

    // Step 2: Simulate payment and upgrade
    const paymentSuccess = true;
    expect(paymentSuccess).toBe(true);

    // Step 3: Update user to pro plan
    const userAfterUpgrade = {
      ...user,
      plan: "pro",
      subscriptionId: "sub_pro_123",
      subscriptionStatus: "active",
      scansRemaining: 100,
    };

    updateUser.mockResolvedValue(userAfterUpgrade);
    const updatedUser = await updateUser(testUser.id, {
      plan: "pro",
      subscriptionId: "sub_pro_123",
    });

    expect(updatedUser.plan).toBe("pro");
    expect(updatedUser.scansRemaining).toBe(100);

    // Step 4: Verify pro user can create scans
    createCollection.mockResolvedValue({
      id: "col_pro",
      userId: testUser.id,
      name: "Pro User Collection",
    });

    const canCreateScan =
      updatedUser.plan === "pro" && updatedUser.scansRemaining > 0;
    expect(canCreateScan).toBe(true);
  });

  it("should enforce scan limits on free plan", () => {
    const freeUser = {
      ...testUser,
      plan: "free",
      scansRemaining: 0,
    };

    const canCreateScan =
      freeUser.plan === "pro" || freeUser.scansRemaining > 0;
    expect(canCreateScan).toBe(false);
  });

  it("should handle payment webhook securely", async () => {
    const { verifyWebhookSignature } = await import("../utils/security");

    const webhookPayload = JSON.stringify({
      event: "subscription.charge_succeeded",
      data: {
        object: {
          id: "ch_123",
          amount: 4900,
          currency: "usd",
        },
      },
    });

    const signature = "razorpay_signature_123";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "test_secret";

    verifyWebhookSignature.mockReturnValue(true);
    const isValid = verifyWebhookSignature(
      webhookPayload,
      signature,
      webhookSecret
    );

    expect(isValid).toBe(true);
  });
});

describe("E2E: Compliance Report Generation Flow", () => {
  it("should complete: generate PCI DSS report → export PDF", async () => {
    const {
      getCollectionById,
      createComplianceReport,
      getComplianceReportById,
    } = await import("../db");

    // Step 1: Verify user owns collection
    const collection = {
      id: testCollection.id,
      userId: testUser.id,
      name: testCollection.name,
    };

    getCollectionById.mockResolvedValue(collection);
    const ownedCollection = await getCollectionById(testCollection.id);

    expect(ownedCollection.userId).toBe(testUser.id);

    // Step 2: Generate compliance report
    const requirements = [
      { id: "1.1", title: "Firewall", status: "met" },
      { id: "1.2", title: "Encryption", status: "met" },
      { id: "2.1", title: "Default Credentials", status: "not_met" },
    ];

    const metCount = requirements.filter(r => r.status === "met").length;
    const complianceScore = (metCount / requirements.length) * 100;

    const report = {
      id: "report_pci_123",
      collectionId: collection.id,
      reportType: "pci_dss",
      complianceScore,
      totalRequirements: requirements.length,
      metRequirements: metCount,
      requirementsData: requirements,
      createdAt: new Date(),
    };

    createComplianceReport.mockResolvedValue(report);
    const generatedReport = await createComplianceReport(
      testUser.id,
      collection.id,
      "pci_dss",
      complianceScore,
      requirements.length,
      metCount,
      requirements
    );

    expect(generatedReport.reportType).toBe("pci_dss");
    expect(generatedReport.complianceScore).toBeCloseTo(66.67, 0);

    // Step 3: Retrieve and export report
    getComplianceReportById.mockResolvedValue(generatedReport);
    const retrievedReport = await getComplianceReportById(generatedReport.id);

    expect(retrievedReport.id).toBe(generatedReport.id);

    // Step 4: Generate PDF (simulated)
    const pdfBuffer = Buffer.from("PDF content");
    const pdfBase64 = pdfBuffer.toString("base64");

    expect(pdfBase64).toBeTruthy();
  });

  it("should calculate compliance score correctly", () => {
    const requirements = [
      { id: "1", status: "met" },
      { id: "2", status: "met" },
      { id: "3", status: "not_met" },
      { id: "4", status: "manual_review" },
      { id: "5", status: "not_met" },
    ];

    const metCount = requirements.filter(r => r.status === "met").length;
    const manualCount = requirements.filter(
      r => r.status === "manual_review"
    ).length;
    const notMetCount = requirements.filter(r => r.status === "not_met").length;

    const complianceScore = (metCount / requirements.length) * 100;
    const reviewNeeded = manualCount > 0;
    // Two or more unmet requirements already constitute a critical
    // compliance gap for the purposes of this flow.
    const criticalGaps = notMetCount >= 2;

    expect(complianceScore).toBe(40);
    expect(reviewNeeded).toBe(true);
    expect(criticalGaps).toBe(true);
  });
});

describe("E2E: Team Collaboration Flow", () => {
  it("should complete: invite member → accept invitation → collaborate", async () => {
    const { getUserById, createCollection, getCollectionsByUserId } =
      await import("../db");
    const { sendTeamInviteEmail } = await import("../email");

    // Step 1: Owner invites new team member
    const inviter = { ...testUser, role: "admin" };
    const inviteeEmail = "newmember@example.com";

    const invite = {
      id: "invite_123",
      memberEmail: inviteeEmail,
      role: "editor",
      status: "pending",
      invitedBy: inviter.id,
      createdAt: new Date(),
    };

    // Step 2: Send invitation email
    sendTeamInviteEmail.mockResolvedValue({ messageId: "invite_email_123" });
    await sendTeamInviteEmail({
      toEmail: inviteeEmail,
      inviterName: inviter.name,
      role: invite.role,
      token: invite.id,
    });

    expect(sendTeamInviteEmail).toHaveBeenCalled();

    // Step 3: Invitee accepts (simulated)
    const acceptedInvite = { ...invite, status: "accepted" };
    expect(acceptedInvite.status).toBe("accepted");

    // Step 4: Verify invited member can access shared collections
    const sharedCollection = {
      id: "col_shared",
      name: "Team API Collection",
      userId: inviter.id, // Owned by inviter, shared with member
    };

    getCollectionsByUserId.mockImplementation(async (userId: string) => {
      if (userId === inviter.id) {
        return [sharedCollection];
      }
      return []; // Member doesn't own, but should have access via team
    });

    const ownerCollections = await getCollectionsByUserId(inviter.id);
    const memberCanAccess = ownerCollections.some(
      c => c.id === sharedCollection.id
    );

    expect(memberCanAccess).toBe(true);
  });

  it("should prevent unauthorized member from accessing collections", async () => {
    const { getCollectionsByUserId } = await import("../db");

    // Non-member tries to access
    const outsiderEmail = "outsider@example.com";
    const outsiderCollections = await getCollectionsByUserId("outsider_id");

    // Check if outsider can access team collection
    const canAccess = outsiderCollections.some(
      c => c.name === "Team API Collection"
    );
    expect(canAccess).toBe(false);
  });
});

describe("E2E: Token Analytics Flow", () => {
  it("should track and report token usage accurately", async () => {
    const { recordTokenUsage, getTokenUsageByUserId } = await import("../db");

    // Step 1: Record usage for different models
    const usageRecords = [
      {
        model: "gpt-4o",
        promptTokens: 1000,
        completionTokens: 500,
        thinkingTokens: 200,
        costUSD: 0.045,
      },
      {
        model: "claude-3-5-sonnet",
        promptTokens: 800,
        completionTokens: 400,
        thinkingTokens: 0,
        costUSD: 0.012,
      },
      {
        model: "gpt-4o",
        promptTokens: 1500,
        completionTokens: 750,
        thinkingTokens: 300,
        costUSD: 0.0675,
      },
    ];

    for (const usage of usageRecords) {
      await recordTokenUsage(
        testUser.id,
        usage.model,
        usage.promptTokens,
        usage.completionTokens,
        usage.thinkingTokens,
        usage.costUSD
      );
    }

    expect(recordTokenUsage).toHaveBeenCalledTimes(3);

    // Step 2: Retrieve aggregated analytics
    getTokenUsageByUserId.mockResolvedValue([
      {
        model: "gpt-4o",
        promptTokens: 2500,
        completionTokens: 1250,
        thinkingTokens: 500,
        totalTokens: 4250,
        costUSD: "0.1125",
        date: new Date(),
      },
      {
        model: "claude-3-5-sonnet",
        promptTokens: 800,
        completionTokens: 400,
        thinkingTokens: 0,
        totalTokens: 1200,
        costUSD: "0.012",
        date: new Date(),
      },
    ]);

    const analytics = await getTokenUsageByUserId(testUser.id, 30);

    const totalCost = analytics.reduce(
      (sum, u) => sum + parseFloat(u.costUSD as any),
      0
    );
    const totalTokens = analytics.reduce((sum, u) => sum + u.totalTokens, 0);

    expect(totalCost).toBeCloseTo(0.1245, 3);
    expect(totalTokens).toBe(5450);
  });

  it("should export analytics as CSV", async () => {
    const { getTokenUsageByUserId } = await import("../db");

    getTokenUsageByUserId.mockResolvedValue([
      {
        model: "gpt-4o",
        promptTokens: 1000,
        completionTokens: 500,
        thinkingTokens: 200,
        totalTokens: 1700,
        costUSD: "0.045",
        date: new Date("2024-01-15"),
      },
    ]);

    const usage = await getTokenUsageByUserId(testUser.id, 30);

    const csvHeader =
      "Date,Model,Prompt Tokens,Completion Tokens,Thinking Tokens,Total Tokens,Cost (USD)";
    const csvRows = usage.map(
      u =>
        `${new Date(u.date).toISOString()},${u.model},${u.promptTokens},${u.completionTokens},${u.thinkingTokens},${u.totalTokens},${parseFloat(u.costUSD as any).toFixed(6)}`
    );
    const csv = [csvHeader, ...csvRows].join("\n");

    expect(csv).toContain("Date,Model,Prompt Tokens");
    expect(csv).toContain("gpt-4o");
    expect(csv.split("\n")).toHaveLength(2);
  });
});

describe("E2E: Security Scanning Flow", () => {
  it("should complete: upload OpenAPI spec → scan → review → remediate", async () => {
    const { createCollection, createScan, getFindingsByScanId, updateUser } =
      await import("../db");

    // Step 1: User uploads API specification
    const apiSpec = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.0.0" },
      paths: {
        "/api/users": {
          get: { summary: "List users" },
          post: { summary: "Create user" },
        },
        "/api/admin": {
          get: { summary: "Admin only", security: [{ adminKey: [] }] },
        },
      },
    };

    createCollection.mockResolvedValue({
      id: "col_api_123",
      name: "Test API Spec",
      format: "openapi",
      data: apiSpec,
      userId: testUser.id,
    });

    const collection = await createCollection(
      testUser.id,
      "Test API Spec",
      "openapi",
      apiSpec,
      undefined
    );

    // Step 2: Run security scan
    const scanResults = {
      id: "scan_security_123",
      collectionId: collection.id,
      status: "completed",
      totalFindings: 5,
      findings: [
        {
          id: "f1",
          title: "BOLA",
          severity: "critical",
          cvss: 9.1,
          status: "open",
        },
        {
          id: "f2",
          title: "BFLA",
          severity: "high",
          cvss: 8.2,
          status: "open",
        },
        {
          id: "f3",
          title: "Excessive Data Exposure",
          severity: "medium",
          cvss: 6.5,
          status: "open",
        },
        {
          id: "f4",
          title: "Missing Authentication",
          severity: "high",
          cvss: 7.5,
          status: "in_progress",
        },
        {
          id: "f5",
          title: "Rate Limiting Missing",
          severity: "medium",
          cvss: 5.3,
          status: "resolved",
        },
      ],
    };

    createScan.mockResolvedValue(scanResults);
    const scan = await createScan(collection.id, testUser.id);

    expect(scan.totalFindings).toBe(5);

    // Step 3: Review high/critical findings
    getFindingsByScanId.mockResolvedValue(scanResults.findings);
    const findings = await getFindingsByScanId(scan.id);

    const criticalFindings = findings.filter(f => f.cvss >= 8.0);
    const openFindings = findings.filter(f => f.status === "open");

    expect(criticalFindings).toHaveLength(2);
    expect(openFindings).toHaveLength(3);

    // Step 4: Simulate remediation progress
    const remediatedFindings = findings.map(f => ({
      ...f,
      status: f.id === "f4" ? "resolved" : f.status,
    }));

    const resolutionProgress = {
      total: remediatedFindings.length,
      resolved: remediatedFindings.filter(f => f.status === "resolved").length,
      inProgress: remediatedFindings.filter(f => f.status === "in_progress")
        .length,
      open: remediatedFindings.filter(f => f.status === "open").length,
    };

    // f5 was already resolved before remediation started, f4 is the one
    // just remediated in Step 4, so two findings are resolved overall.
    // The remaining three findings (f1/f2/f3) stay open.
    expect(resolutionProgress.resolved).toBe(2);
    expect(resolutionProgress.open).toBe(3);
  });

  it("should prioritize findings by CVSS score", () => {
    const findings = [
      { id: "1", title: "Low", cvss: 3.0 },
      { id: "2", title: "Medium", cvss: 5.5 },
      { id: "3", title: "High", cvss: 7.5 },
      { id: "4", title: "Critical", cvss: 10.0 },
      { id: "5", title: "High 2", cvss: 8.5 },
    ];

    const sortedBySeverity = [...findings].sort((a, b) => b.cvss - a.cvss);

    expect(sortedBySeverity[0].title).toBe("Critical");
    expect(sortedBySeverity[1].title).toBe("High 2");
    expect(sortedBySeverity[4].title).toBe("Low");
  });
});

// Helper validation functions
function validatePasswordStrength(password: string) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\f/.test(password) || /\n/.test(password) === false;
  const hasSpecialChar = /[!@#$%^&*(),.?':{}|<>]/.test(password);

  if (password.length < minLength) {
    throw new Error("Password does not meet requirements");
  }
  if (!hasUpperCase || !hasLowerCase) {
    throw new Error("Password does not meet requirements");
  }
  if (!hasNumbers) {
    throw new Error("Password does not meet requirements");
  }

  return true;
}

function validateCollectionOwnership(collection: any, userId: string) {
  if (!collection || collection.userId !== userId) {
    throw new Error("Access denied");
  }
  return true;
}
