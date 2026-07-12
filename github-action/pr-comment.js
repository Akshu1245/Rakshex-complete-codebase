#!/usr/bin/env node
/**
 * Build PR comment markdown from Rakshex scan JSON body.
 * Usage: node pr-comment.js '<json-body>' [framework]
 */
const bodyRaw = process.argv[2] || "{}";
const framework = process.argv[3] || "unknown";

let data;
try {
  data = JSON.parse(bodyRaw);
} catch {
  data = {};
}

const findings = Array.isArray(data.findings) ? data.findings : [];
const critical = findings.filter((f) => f.severity === "Critical").length;
const high = findings.filter((f) => f.severity === "High").length;
const medium = findings.filter((f) => f.severity === "Medium").length;
const low = findings.filter((f) => f.severity === "Low").length;

const lines = [
  `## Rakshex Security Scan`,
  "",
  `**Framework:** \`${framework}\` · **Risk:** ${data.riskLevel ?? "n/a"} (${data.riskScore ?? 0})`,
  "",
  `| Severity | Count |`,
  `|----------|------:|`,
  `| Critical | ${critical} |`,
  `| High | ${high} |`,
  `| Medium | ${medium} |`,
  `| Low | ${low} |`,
  "",
];

if (findings.length === 0) {
  lines.push("_No findings from deterministic scanner rules._");
} else {
  lines.push("### Top findings");
  lines.push("");
  for (const f of findings.slice(0, 15)) {
    lines.push(
      `- **[${f.severity}]** ${f.title}${f.endpoint ? ` (\`${f.method ?? ""} ${f.endpoint}\`)` : ""}`,
    );
  }
  if (findings.length > 15) {
    lines.push(`\n_…and ${findings.length - 15} more._`);
  }
}

lines.push("");
lines.push("---");
lines.push("_Scanned with Rakshex deterministic rules. See SARIF artifact for full results._");

process.stdout.write(lines.join("\n"));
