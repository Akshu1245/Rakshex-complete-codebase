export interface DocPage {
  title: string;
  breadcrumb: string;
  lead: string;
  contentHtml: string;
}

export const docsData: Record<string, DocPage> = {
  "quickstart/cli": {
    title: "Connect via CLI",
    breadcrumb: "Getting Started / Quickstart",
    lead: "Audit your API collections and scan for security vulnerabilities directly from your terminal or CI/CD pipeline.",
    contentHtml: `
      <p>The RaksHex CLI is the easiest way to perform ad-hoc scans on your Postman collections, OpenAPI/Swagger specifications, or raw HAR files. It runs completely locally in memory and uploads only anonymized metadata and findings to your RaksHex portal.</p>
      
      <h2>Installation</h2>
      <p>The CLI requires Node.js v16+ to be installed on your system. You can execute it directly using <code>npx</code> or install it globally:</p>
      <pre><code>npm install -g @rakshex/cli</code></pre>
      
      <h2>Run Your First Scan</h2>
      <p>To scan an export of your Postman collection or OpenAPI JSON, use the <code>scan</code> command. You will need your project API Key which is found in <code>.insforge/project.json</code> or under your project Settings page:</p>
      <pre><code>npx RaksHex scan ./collection.json --key ik_26f99572954998ec678ac9ecbf27031f</code></pre>
      
      <h2>CLI Parameters</h2>
      <table>
        <thead>
          <tr>
            <th>Argument</th>
            <th>Description</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>--key</code></td>
            <td>Your project API Key (or set via <code>RAKSHEX_API_KEY</code> env var).</td>
            <td>-</td>
          </tr>
          <tr>
            <td><code>--format</code></td>
            <td>Specify output format (<code>json</code>, <code>csv</code>, <code>table</code>).</td>
            <td><code>table</code></td>
          </tr>
          <tr>
            <td><code>--fail-on</code></td>
            <td>Fail the build (exit code 1) on findings of severity (<code>Low</code>, <code>Medium</code>, <code>High</code>, <code>Critical</code>).</td>
            <td><code>High</code></td>
          </tr>
        </tbody>
      </table>

      <div class="docs-tip" style="background: rgba(20, 184, 166, 0.05); border: 1px solid rgba(20, 184, 166, 0.15); padding: 16px; border-radius: 8px; margin: 24px 0;">
        <strong>💡 GitHub Action Integration:</strong> Add <code>npx RaksHex scan</code> into your CI pipeline to block pull requests automatically when new security issues or undocumented shadow endpoints are introduced.
      </div>
    `,
  },
  "quickstart/vscode": {
    title: "Connect via VS Code Extension",
    breadcrumb: "Getting Started / Quickstart",
    lead: "Get real-time security warnings and runtime cost alerts directly inside your code editor as you write code.",
    contentHtml: `
      <p>The RaksHex VS Code extension brings the power of runtime security scanning and LLM cost intelligence directly to your development workflow. It highlights vulnerabilities inline, identifies shadow endpoints, and displays budget stats in your status bar.</p>
      
      <h2>Installation</h2>
      <ol>
        <li>Open VS Code.</li>
        <li>Open the Extensions view (<code>Ctrl+Shift+X</code> or <code>Cmd+Shift+X</code>).</li>
        <li>Search for <strong>RaksHex</strong> and click <strong>Install</strong>.</li>
      </ol>
      
      <h2>Configuration</h2>
      <p>Once installed, click the RaksHex icon in the sidebar. You will be prompted to connect your project. Retrieve your API Key from the RaksHex portal or <code>.insforge/project.json</code> and paste it in the extension settings:</p>
      <pre><code>"RaksHex.apiKey": "ik_26f99572954998ec678ac9ecbf27031f"</code></pre>
      
      <h2>Key Features</h2>
      <ul>
        <li><strong>Inline Diagnostics:</strong> Highlights dangerous API configurations, missing auth headers, or unsecured LLM calls directly in your code.</li>
        <li><strong>Interactive Webview Sidebar:</strong> View the live security score, audit logs, and cost analytics without leaving your editor.</li>
        <li><strong>Command Palette:</strong> Open command palette (<code>Ctrl+Shift+P</code>) and search for <code>RaksHex: Scan Current File</code> to trigger a manual scan.</li>
      </ul>
    `,
  },
  "quickstart/mcp": {
    title: "Connect via Model Context Protocol (MCP)",
    breadcrumb: "Getting Started / Quickstart",
    lead: "Expose secure database schema context and API endpoints directly to agentic coding tools with strict safety controls.",
    contentHtml: `
      <p>RaksHex acts as a Model Context Protocol (MCP) host, allowing AI coding assistants to retrieve database schema metadata and query logs while enforcing granular security policies, allowlists, and execution bounds.</p>
      
      <h2>Setup MCP Server</h2>
      <p>To run the RaksHex MCP server locally, reference it in your Claude Desktop or Cursor configuration file (usually located at <code>%APPDATA%\\Claude\\claude_desktop_config.json</code> on Windows):</p>
      <pre><code>{
  "mcpServers": {
    "RaksHex-mcp": {
      "command": "npx",
      "args": ["-y", "@rakshex/mcp-server", "--key", "ik_26f99572954998ec678ac9ecbf27031f"]
    }
  }
}</code></pre>
      
      <h2>Exposed Tools</h2>
      <ul>
        <li><code>get_allowed_tables</code>: Retrieve tables that are allowlisted for AI agent context querying.</li>
        <li><code>get_query_log</code>: Review recent SQL queries executed by AI agents.</li>
        <li><code>evaluate_safety</code>: Run the LLM input through the RaksHex prompt injection classifier.</li>
      </ul>
    `,
  },
  "security-scanner": {
    title: "Security Scanner",
    breadcrumb: "Products / Security",
    lead: "Run automated security checks mapped to the OWASP API Top 10 and LLM security standards.",
    contentHtml: `
      <p>RaksHex includes an active runtime security scanner designed to detect vulnerabilities in your API routes and LLM prompts. By auditing inputs and responses in real-time, the scanner detects anomalies before they trigger critical data leaks or model compromises.</p>
      
      <h2>OWASP API Top 10 Coverage</h2>
      <p>Our scanner actively flags routes for:</p>
      <ul>
        <li><strong>API1:2023 Broken Object Level Authorization (BOLA):</strong> Accessing records with unauthorized ID manipulation.</li>
        <li><strong>API2:2023 Broken Authentication:</strong> Missing tokens, invalid validation, or signature bypass.</li>
        <li><strong>API5:2023 Broken Function Level Authorization (BFLA):</strong> Standard users accessing administrative endpoints.</li>
        <li><strong>API8:2023 Security Misconfiguration:</strong> CORS headers set to wildcard (<code>*</code>), unencrypted payloads, or verbose stack traces in responses.</li>
      </ul>

      <h2>Prompt Injection Classifiers</h2>
      <p>The scanner uses a library of 87 distinct payloads representing indirect prompt injections, jailbreaks, and system prompt leakage attacks. We update this model weekly to capture new attack vectors targeting OpenAI, Anthropic, and Gemini models.</p>
    `,
  },
  "kill-switch": {
    title: "AgentGuard Kill Switch",
    breadcrumb: "Products / Cost & Governance",
    lead: "Set autonomous circuit breakers that instantly block LLM gateways when budget caps or security anomalies are detected.",
    contentHtml: `
      <p>The AgentGuard Kill Switch is a sub-second response middleware that intercepts all outbound model calls. It acts as an autonomous circuit breaker to protect your company from runaway cost spikes and prompt injection attacks.</p>
      
      <h2>How It Works</h2>
      <p>When an API gateway call is initiated, the RaksHex middleware evaluates the request context against your active workspace rules:</p>
      <pre><code>import { Rakshex } from '@rakshex/sdk';

const RaksHex = new RaksHex({ apiKey: process.env.RAKSHEX_API_KEY });

// The middleware automatically throws a 402 Payment Required or 403 Forbidden 
// if a budget or security policy rule is violated
app.post('/api/chat', RaksHex.middleware(), async (req, res) => {
  // Chat logic here...
});</code></pre>

      <h2>Trigger Conditions</h2>
      <ul>
        <li><strong>Daily / Monthly Budget Caps:</strong> Shuts down the gateway once a team or workspace budget is exceeded.</li>
        <li><strong>Security Anomalies:</strong> Blocks prompts with injection confidence scores above 0.90.</li>
        <li><strong>Spike Protection:</strong> Shuts down the route when token consumption spikes exceed 3 standard deviations in an hour.</li>
      </ul>
    `,
  },
  "cost-monitor": {
    title: "Cost Monitor & Intelligence",
    breadcrumb: "Products / Cost",
    lead: "Track token consumption in real-time, isolate reasoning step overheads, and forecast next-month spend.",
    contentHtml: `
      <p>The RaksHex Cost Monitor tracks every single request sent to model providers. It attributes tokens, costs, and response latencies to individual user IDs, collections, or routes.</p>
      
      <h2>Real-time Attribution</h2>
      <p>Unlike general-purpose cloud monitoring tools, RaksHex decodes API responses to read exact model token returns, supporting:</p>
      <ul>
        <li>OpenAI GPT-4o, GPT-4, and o1/o3-series models.</li>
        <li>Anthropic Claude 3.5 Sonnet / Opus.</li>
        <li>Google Gemini 1.5 Pro / Flash.</li>
        <li>DeepSeek R1 / V3.</li>
      </ul>

      <h2>Holt-Winters Forecasting</h2>
      <p>We use a triple-exponential smoothing algorithm (Holt-Winters forecasting) to analyze hourly, weekly, and monthly trend seasonality. It displays a 95% confidence boundary indicating when your LLM consumption is expected to breach budget limits.</p>
    `,
  },
  "thinking-tokens": {
    title: "Thinking Token Cost Isolation",
    breadcrumb: "Products / Cost",
    lead: "First-in-world tracking and isolation of reasoning/thinking tokens to attribute exact processing costs.",
    contentHtml: `
      <p>Reasoning models like OpenAI <code>o1</code>, <code>o3-mini</code>, and DeepSeek <code>R1</code> generate internal "thinking" or reasoning steps. These steps consume output tokens that are charged at output rates, yet they are excluded from the final visible response.</p>
      
      <h2>The Challenge</h2>
      <p>Since thinking tokens are not returned in the message content payload, standard APM logs miss them, leading to a 30-50% cost misattribution. RaksHex solves this by parsing the usage metadata object in the API response payload.</p>
      
      <h2>Attribution Analytics</h2>
      <p>The Cost Dashboard highlights the exact percentage of your model spend going towards reasoning steps vs standard output, helping developers evaluate if a model's logical depth is worth the extra cost for a given task.</p>
    `,
  },
  "shadow-api": {
    title: "Shadow API Discovery",
    breadcrumb: "Products / Security",
    lead: "Scan and map your entire server route schema statically without routing production traffic.",
    contentHtml: `
      <p>Undocumented, forgotten, or "shadow" API routes are one of the most common vectors for database exploits. RaksHex scans your source code directories to build a complete endpoint registry.</p>
      
      <h2>Supported Frameworks</h2>
      <p>The static analysis engine extracts routing trees from:</p>
      <ul>
        <li><strong>FastAPI / Starlette:</strong> Python</li>
        <li><strong>Express.js / Koa:</strong> Node.js</li>
        <li><strong>Spring Boot:</strong> Java</li>
        <li><strong>Django / Flask:</strong> Python</li>
      </ul>
      
      <h2>How to Run Route Extraction</h2>
      <p>Use the CLI to perform a static scan on your backend repository:</p>
      <pre><code>npx RaksHex discover ./backend-src --framework fastapi</code></pre>
      <p>The output will list all discovered endpoints, auth status, and compare them against your allowlisted documentation endpoints.</p>
    `,
  },
  credentials: {
    title: "Credential Scanner & PII Redaction",
    breadcrumb: "Products / Security",
    lead: "Automatically redact passwords, tokens, API keys, and PII from prompts before sending them to public LLM APIs.",
    contentHtml: `
      <p>The Credential Scanner inspects model inputs for sensitive developer secrets and customer PII (Personally Identifiable Information). It ensures compliance with PCI DSS and local data protection laws (like India's DPDP Act and EU's GDPR).</p>
      
      <h2>Secret Detection Patterns</h2>
      <p>We scan prompts for over 120 key signatures, including:</p>
      <ul>
        <li>AWS access keys and secret keys.</li>
        <li>GitHub personal access tokens.</li>
        <li>OpenAI, Anthropic, and Cohere API keys.</li>
        <li>Stripe, Slack, and Twilio secrets.</li>
      </ul>
      
      <h2>Indian ID & Compliance Redaction</h2>
      <p>Includes optimized regex and checksum models for:</p>
      <ul>
        <li>Aadhaar numbers (UIDAI compliance check).</li>
        <td>PAN numbers.</td>
        <td>Indian passport and voter IDs.</td>
      </ul>
    `,
  },
  compliance: {
    title: "Compliance Evidence Builder",
    breadcrumb: "Products / Compliance",
    lead: "Auto-generate audit logs and export evidence for SOC 2 Type II, PCI DSS v4.0, and ISO 27001.",
    contentHtml: `
      <p>Securing enterprise contracts requires demonstrating rigorous compliance controls. RaksHex collects scan telemetry and security events to construct auditor-ready evidence logs.</p>
      
      <h2>Supported Compliances</h2>
      <ul>
        <li><strong>PCI DSS v4.0.1:</strong> Automatically maps API vulnerability findings to Requirements 6.4, 6.5, and 11.3 (vulnerability management and secure coding).</li>
        <li><strong>SOC 2 Type II:</strong> Evidence building for Common Criteria (Security, Confidentiality, and Availability).</li>
        <li><strong>OWASP LLM Top 10:</strong> Verification logs proving that inputs are scanned for prompt injections (LLM01) and sensitive data disclosures (LLM06).</li>
      </ul>
      
      <h2>Audit Exports</h2>
      <p>You can export logs as hashed, cryptographically signed PDFs or CSV spreadsheets directly from the Compliance tab in the dashboard, ready to import into compliance portals like Vanta, Drata, or Secureframe.</p>
    `,
  },
  mcp: {
    title: "Model Context Protocol (MCP) Governance",
    breadcrumb: "Products / Compliance",
    lead: "Implement policies, logs, and guardrails to govern AI agents executing database operations.",
    contentHtml: `
      <p>While Model Context Protocol enables powerful AI workflows, giving agents raw access to database tools can lead to accidental deletions, data corruption, or information leaks. RaksHex adds a proxy governor between your agent and your tools.</p>
      
      <h2>Governance Policies</h2>
      <ul>
        <li><strong>Allowlisted Operations:</strong> Restrict agent queries to safe <code>SELECT</code> requests, blocking <code>UPDATE</code>, <code>DELETE</code>, and <code>DROP</code> statements.</li>
        <li><strong>Rate Limiting:</strong> Cap the number of database records or token sizes that an agent can request in a single turn.</li>
        <li><strong>Human-in-the-loop (HITL):</strong> Require manual user approval in the extension dashboard for high-risk operations.</li>
      </ul>
    `,
  },
  community: {
    title: "Community & Support",
    breadcrumb: "Resources",
    lead: "Connect with the RaksHex developer community, access open-source repositories, and get support.",
    contentHtml: `
      <p>We are developer-first. Reach out via community channels to share ideas, request features, or report bugs.</p>
      
      <h2>Developer Channels</h2>
      <ul>
        <li><strong>Slack Community:</strong> Join over 1,200 developers building secure AI systems. <a href="mailto:support@rakshex.in">Email us for an invite link</a>.</li>
        <li><strong>GitHub:</strong> Star our SDK and CLI repositories, read code, or submit pull requests. <a href="https://github.com/rakshex-hq" target="_blank">View GitHub Organisation</a>.</li>
        <li><strong>Support Email:</strong> For direct assistance or plan inquiries, contact <code>support@rakshex.in</code>.</li>
      </ul>
    `,
  },
  sdk: {
    title: "SDK & Examples",
    breadcrumb: "Documentation",
    lead: "Integrate RaksHex with a single line of code in Node.js, Python, or Go.",
    contentHtml: `
      <p>We provide official client libraries to intercept LLM calls, calculate costs, scan prompts, and trigger kill-switches. Our SDKs run locally with asynchronous caching to ensure sub-millisecond overhead on your application's hot path.</p>
      
      <h2>Node.js SDK</h2>
      <p>Install via npm:</p>
      <pre><code>npm install @rakshex/sdk</code></pre>
      <p>Usage example with OpenAI:</p>
      <pre><code>import { Rakshex } from '@rakshex/sdk';
import OpenAI from 'openai';

const RaksHex = new RaksHex({ apiKey: process.env.RAKSHEX_API_KEY });
const openai = RaksHex.wrap(new OpenAI());

// The wrapped client automatically reports costs, attributes usage, 
// and scans for prompt injections in the background.
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is the cost of capital?' }],
  user: 'user_12938' // Essential for per-user cost tracking
});</code></pre>

      <h2>Python SDK</h2>
      <p>Install via pip:</p>
      <pre><code>pip install RaksHex-sdk</code></pre>
      <p>Usage example with Anthropic:</p>
      <pre><code>from rakshex import Rakshex
from anthropic import Anthropic

RaksHex = RaksHex(api_key="your_api_key")
client = Anthropic()

# Wrap the client
wrapped_client = RaksHex.wrap(client)

response = wrapped_client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Analyze code security."}],
    metadata={"user_id": "usr_9921"}
)</code></pre>
    `,
  },
  api: {
    title: "API Reference",
    breadcrumb: "Documentation",
    lead: "Reference guide for the RaksHex REST API to ingest telemetry and query findings.",
    contentHtml: `
      <p>If you are not using our SDKs, you can interact with the RaksHex portal directly via our REST API. All requests must be authenticated using the <code>Authorization: Bearer &lt;API_KEY&gt;</code> header.</p>
      
      <h2>1. Ingest Telemetry</h2>
      <p>Record a completed model request and token metrics.</p>
      <p><strong>Endpoint:</strong> <code>POST /v1/telemetry</code></p>
      <p><strong>Payload Example:</strong></p>
      <pre><code>{
  "model": "gpt-4o",
  "prompt_tokens": 128,
  "completion_tokens": 256,
  "reasoning_tokens": 64,
  "latency_ms": 420,
  "user_id": "usr_93812",
  "status": "success",
  "endpoint": "/api/chat"
}</code></pre>

      <h2>2. Retrieve Security Findings</h2>
      <p>Fetch the list of unresolved vulnerabilities or shadow API alerts.</p>
      <p><strong>Endpoint:</strong> <code>GET /v1/findings</code></p>
      <p><strong>Query Parameters:</strong></p>
      <ul>
        <li><code>severity</code>: Filter by <code>Critical</code>, <code>High</code>, <code>Medium</code>, or <code>Low</code>.</li>
        <li><code>resolved</code>: Filter by <code>true</code> or <code>false</code>.</li>
      </ul>
    `,
  },
  // Add direct fallback maps for shortened urls
  quickstart: {
    title: "Quickstart Guides",
    breadcrumb: "Getting Started",
    lead: "Get connected and start securing your environment.",
    contentHtml: `
      <p>Welcome to RaksHex. To get started, select the implementation path that fits your development workflow:</p>
      <ul>
        <li><strong><a href="/docs/quickstart/cli">CLI Integration</a>:</strong> Set up ad-hoc scanning in your local console or continuous integration pipelines.</li>
        <li><strong><a href="/docs/quickstart/vscode">VS Code Extension</a>:</strong> Add inline security warnings and status bar budget metrics directly to your editor.</li>
        <li><strong><a href="/docs/quickstart/mcp">Model Context Protocol (MCP)</a>:</strong> Expose allowlisted schema tools safely to AI agents.</li>
      </ul>
    `,
  },
  frameworks: {
    title: "Framework Integrations",
    breadcrumb: "Getting Started",
    lead: "Set up route telemetry interception for FastAPI, Express, Django, Flask, or NestJS.",
    contentHtml: `
      <p>RaksHex includes drop-in middleware hooks for major programming languages and web frameworks. Refer to the specific quickstart for your setup:</p>
      <ul>
        <li><strong><a href="/docs/frameworks/fastapi">FastAPI Middleware</a>:</strong> Async python route tracking.</li>
        <li><strong><a href="/docs/frameworks/express">Express.js Middleware</a>:</strong> Node.js request intercepts.</li>
      </ul>
    `,
  },
  "frameworks/fastapi": {
    title: "FastAPI Middleware Setup",
    breadcrumb: "Getting Started / Frameworks",
    lead: "Integrate RaksHex with FastAPI for async route discovery and request telemetry.",
    contentHtml: `
      <p>Add route security checks and telemetry auditing to your FastAPI backend using our official python client package.</p>
      <h2>Integration</h2>
      <pre><code>from fastapi import FastAPI
from rakshex.integrations.fastapi import RakshexMiddleware

app = FastAPI()

# Add the middleware as the first layer
app.add_middleware(
    RaksHexMiddleware,
    api_key="ik_26f99572954998ec678ac9ecbf27031f",
    exclude_paths=["/healthz", "/metrics"]
)

@app.post("/generate")
async def generate_response(prompt: str):
    return {"message": "Success"}</code></pre>
    `,
  },
  "frameworks/express": {
    title: "Express.js Middleware Setup",
    breadcrumb: "Getting Started / Frameworks",
    lead: "Set up automatic route scanning and cost logging in Node.js Express apps.",
    contentHtml: `
      <p>Add route security auditing, shadow API discovery, and token budgets to Node.js express apps.</p>
      <h2>Integration</h2>
      <pre><code>const express = require('express');
const { Rakshex } = require('@rakshex/sdk');

const app = express();
const RaksHex = new RaksHex({ apiKey: process.env.RAKSHEX_API_KEY });

// Inject middleware before any routers
app.use(RaksHex.middleware());

app.post('/chat', (req, res) => {
  res.json({ message: "Done" });
});</code></pre>
    `,
  },
  "frameworks/django": {
    title: "Django Middleware Setup",
    breadcrumb: "Getting Started / Frameworks",
    lead: "Integrate RaksHex middleware with Django project settings.",
    contentHtml: `
      <p>Expose Django view endpoints to shadow API scans and audit requests.</p>
      <h2>Integration</h2>
      <p>Add the middleware in your Django <code>settings.py</code>:</p>
      <pre><code>MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'RaksHex.integrations.django.RaksHexMiddleware',
    # Other middlewares...
]

RaksHex = {
    'API_KEY': 'ik_26f99572954998ec678ac9ecbf27031f',
}</code></pre>
    `,
  },
  "frameworks/flask": {
    title: "Flask Middleware Setup",
    breadcrumb: "Getting Started / Frameworks",
    lead: "Set up request telemetry audit logs in python Flask apps.",
    contentHtml: `
      <p>Monitor flask router calls and validate LLM prompt payloads at runtime.</p>
      <h2>Integration</h2>
      <pre><code>from flask import Flask
from rakshex.integrations.flask import Rakshex

app = Flask(__name__)
RaksHex = RaksHex(app, api_key="ik_26f99572954998ec678ac9ecbf27031f")

@app.route("/chat", methods=["POST"])
def chat():
    return "OK"</code></pre>
    `,
  },
  "frameworks/nestjs": {
    title: "NestJS Interceptor Setup",
    breadcrumb: "Getting Started / Frameworks",
    lead: "Use NestJS interceptors to report request telemetry and evaluate security policies.",
    contentHtml: `
      <p>Add structured lifecycle interceptors to log reasoning tokens and control route budgets in NestJS.</p>
      <h2>Integration</h2>
      <p>Inject the interceptor in your NestJS module:</p>
      <pre><code>import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RakshexInterceptor } from '@rakshex/nestjs';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RaksHexInterceptor,
    },
  ],
})
export class AppModule {}</code></pre>
    `,
  },
};
