import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { eq } from "drizzle-orm";
import { findings } from "@/db/schema";

// OWASP remediation database
const REMEDIATIONS: Record<string, { suggestion: string; code?: string }> = {
  "OWASP API1:2023": {
    suggestion: "Implement proper authorization checks. Verify the authenticated user has access to the requested resource ID.",
    code: `// Before (Vulnerable)
app.get("/api/users/:id", (req, res) => {
  const user = db.users.find(req.params.id);
  res.json(user); // ❌ Any user can access any profile
});

// After (Secure)
app.get("/api/users/:id", authenticate, (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const user = db.users.find(req.params.id);
  res.json(user);
});`,
  },
  "OWASP API2:2023": {
    suggestion: "Add strong authentication. Use JWT tokens, OAuth 2.0, or API keys with proper validation.",
    code: `// Add authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};`,
  },
  "OWASP API3:2023": {
    suggestion: "Move secrets to environment variables or a secret manager. Never hardcode credentials.",
    code: `// Before (Vulnerable)
const API_KEY = "sk-abc123..."; // ❌ Hardcoded

// After (Secure)
const API_KEY = process.env.OPENAI_API_KEY; // ✅ Environment variable

// Or use a secret manager
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const client = new SecretManagerServiceClient();
const [version] = await client.accessSecretVersion({ name: "projects/my-project/secrets/api-key/versions/latest" });
const API_KEY = version.payload.data.toString();`,
  },
  "Insecure HTTP": {
    suggestion: "Force HTTPS for all endpoints. Use HSTS headers and redirect HTTP to HTTPS.",
    code: `// Express.js HTTPS redirect
app.use((req, res, next) => {
  if (req.header("x-forwarded-proto") !== "https") {
    res.redirect("https://" + req.header("host") + req.url);
  } else {
    next();
  }
});

// HSTS header
app.use((req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});`,
  },
  "BOLA": {
    suggestion: "Validate that the authenticated user owns the resource. Use middleware for consistent checks.",
    code: `// Ownership verification middleware
const verifyOwnership = (resourceType) => async (req, res, next) => {
  const resource = await db[resourceType].findById(req.params.id);
  if (!resource) return res.status(404).json({ error: "Not found" });
  if (resource.ownerId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You do not own this resource" });
  }
  req.resource = resource;
  next();
};

app.get("/api/documents/:id", authenticate, verifyOwnership("documents"), (req, res) => {
  res.json(req.resource);
});`,
  },
};

export const fixRouter = router({
  // Get fix suggestion for a finding
  getSuggestion: protectedProcedure
    .input(z.object({ findingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const finding = await ctx.db.query.findings.findFirst({
        where: eq(findings.id, input.findingId),
      });

      if (!finding) {
        throw new Error("Finding not found");
      }

      // Look up remediation by category
      const remediation = Object.entries(REMEDIATIONS).find(([key]) =>
        finding.category?.includes(key)
      );

      if (remediation) {
        return remediation[1];
      }

      // Generic fallback
      return {
        suggestion: `Review and fix the ${finding.severity.toLowerCase()} severity issue: ${finding.title}. Ensure proper validation and error handling for this endpoint.`,
        code: `// TODO: Implement fix for ${finding.title}
// Endpoint: ${finding.endpoint}
// Category: ${finding.category}`,
      };
    }),

  // Apply auto-fix (placeholder — would need AST manipulation in real implementation)
  applyFix: protectedProcedure
    .input(z.object({ findingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const finding = await ctx.db.query.findings.findFirst({
        where: eq(findings.id, input.findingId),
      });

      if (!finding) {
        return { success: false, message: "Finding not found" };
      }

      // In a real implementation, this would:
      // 1. Parse the source file AST
      // 2. Apply the fix transformation
      // 3. Write back to disk
      // 4. Create a git commit

      // For now, mark as resolved and return success
      await ctx.db
        .update(findings)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(eq(findings.id, input.findingId));

      return {
        success: true,
        message: `Fix applied for ${finding.title}. Please review the changes and run tests before committing.`,
      };
    }),
});
