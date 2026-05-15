const fs = require('fs');

const [, , scanBody, framework] = process.argv;
const data = JSON.parse(scanBody);
const findings = data.findings || [];
const costAnomalies = data.costAnomalies || [];
const shadowApis = data.shadowApis || [];

const critical = findings.filter(f => f.severity === 'Critical');
const high = findings.filter(f => f.severity === 'High');
const medium = findings.filter(f => f.severity === 'Medium');
const low = findings.filter(f => f.severity === 'Low');

const severityEmoji = {
  Critical: '🔴',
  High: '🟠',
  Medium: '🟡',
  Low: '🟢'
};

const severityBadge = {
  Critical: '![Critical](https://img.shields.io/badge/-Critical-red)',
  High: '![High](https://img.shields.io/badge/-High-orange)',
  Medium: '![Medium](https://img.shields.io/badge/-Medium-yellow)',
  Low: '![Low](https://img.shields.io/badge/-Low-green)'
};

let comment = `## 🛡️ DevPulse Security Scan Results

**Framework detected:** \`${framework || 'unknown'}\`  
**Scan ID:** \`${data.scanId || 'N/A'}\`

`;

// Summary table
comment += `| Severity | Count | Status |
|----------|-------|--------|
`;
if (critical.length > 0) comment += `| 🔴 Critical | **${critical.length}** | ⚠️ Action required |
`;
if (high.length > 0) comment += `| 🟠 High | **${high.length}** | ⚠️ Review recommended |
`;
if (medium.length > 0) comment += `| 🟡 Medium | ${medium.length} | ℹ️ Monitor |
`;
if (low.length > 0) comment += `| 🟢 Low | ${low.length} | ℹ️ Low priority |
`;
if (findings.length === 0) comment += `| ✅ | **0 findings** | All clear! |
`;

comment += `
`;

// Critical/High findings detail
const urgentFindings = [...critical, ...high].slice(0, 10);
if (urgentFindings.length > 0) {
  comment += `### ⚠️ Urgent Findings (Top ${urgentFindings.length})

`;
  comment += `<details open>
<summary>Click to expand</summary>

`;

  urgentFindings.forEach((f, i) => {
    comment += `**${i + 1}. ${severityBadge[f.severity]} ${f.title}**

`;
    comment += `- **Endpoint:** \`${f.endpoint || 'N/A'}\`
`;
    comment += `- **Category:** ${f.category || 'N/A'}
`;
    comment += `- **OWASP:** ${f.owaspCategory || 'N/A'}
`;
    if (f.remediation) {
      comment += `- **Fix:** ${f.remediation}
`;
    }
    if (f.costImpact) {
      comment += `- **💰 Cost Impact:** $${f.costImpact.toFixed(2)}/month
`;
    }
    comment += `
`;
  });

  comment += `</details>

`;
}

// Cost anomalies
if (costAnomalies.length > 0) {
  comment += `### 💰 LLM Cost Anomalies

`;
  comment += `<details>
<summary>${costAnomalies.length} anomaly(s) detected</summary>

`;

  costAnomalies.slice(0, 5).forEach(a => {
    comment += `- **\`${a.endpoint || 'Unknown'}\`** — ${a.description || 'Unusual spend pattern'}
`;
    comment += `  - Current: $${a.currentCost?.toFixed(2) || 'N/A'} | Projected: $${a.projectedCost?.toFixed(2) || 'N/A'} | **+${a.percentageIncrease?.toFixed(1) || 'N/A'}%**
`;
    if (a.recommendation) {
      comment += `  - 💡 **Recommendation:** ${a.recommendation}
`;
    }
    comment += `
`;
  });

  comment += `</details>

`;
}

// Shadow APIs
if (shadowApis.length > 0) {
  comment += `### 👻 Shadow API Endpoints

`;
  comment += `<details>
<summary>${shadowApis.length} endpoint(s) not in inventory</summary>

`;

  shadowApis.slice(0, 5).forEach(s => {
    comment += `- \`${s.endpoint || 'Unknown'}\` (${s.framework || 'unknown'})
`;
    comment += `  - File: \`${s.filePath || 'N/A'}\`
`;
    comment += `
`;
  });

  comment += `</details>

`;
}

// Compliance
if (data.complianceScore) {
  const pci = data.complianceScore.pci || 0;
  const owasp = data.complianceScore.owasp || 0;
  comment += `### 📋 Compliance Score

`;
  comment += `- **PCI DSS:** ${pci >= 80 ? '✅' : pci >= 50 ? '⚠️' : '❌'} ${pci}/100
`;
  comment += `- **OWASP Top 10:** ${owasp >= 80 ? '✅' : owasp >= 50 ? '⚠️' : '❌'} ${owasp}/100

`;
}

// Footer
comment += `---
`;
comment += `🔒 **DevPulse** — API Security + LLM Cost Intelligence in one workflow
`;
comment += `📊 [View full dashboard](https://devpulse.in/dashboard) | 📖 [Documentation](https://docs.devpulse.in) | 💬 [Slack Support](https://devpulse.in/slack)
`;

console.log(comment);
