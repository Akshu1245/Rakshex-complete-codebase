/**
 * Agent Orchestrator — loads all 29 DevPulse agent definitions, routes
 * tasks to the right specialized agent, coordinates parallel execution,
 * and integrates with the LLM gateway for actual inference.
 *
 * Architecture:
 *   AgentRegistry  → loads/parses agent markdown files
 *   TaskRouter     → matches tasks to agents using keyword scoring
 *   AgentExecutor  → invokes LLM with agent-specific system prompt
 *   ParallelRunner → runs independent tasks simultaneously
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { routeLLM } from "../_core/providers";
import { logger } from "../_core/logger";
import { InternalError } from "../_core/errors";
import type { Message } from "../_core/llm";

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface AgentDefinition {
  number: string;
  name: string;
  role: string;
  category: AgentCategory;
  reportsTo: string;
  domainScope: string[];
  systemPrompt: string;
  cavemanRules: string | null;
  identity: string;
  domainKnowledge: string;
  patterns: string;
  invocation: string;
}

export type AgentCategory =
  | "leadership"
  | "management"
  | "development"
  | "specialized"
  | "operations"
  | "autonomy"
  | "guardians"
  | "orchestrator";

export interface AgentTask {
  id: string;
  description: string;
  assignedAgent: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  elapsedMs?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentTaskResult {
  taskId: string;
  agentName: string;
  output: string;
  toolCalls?: Array<{ name: string; args: unknown }>;
  tokensUsed?: { prompt: number; completion: number };
  elapsedMs: number;
}

export interface ParallelExecutionResult {
  results: AgentTaskResult[];
  totalElapsedMs: number;
  sequentialEquivalentMs: number;
  speedup: number;
}

/* ─── Agent Registry ───────────────────────────────────────────────────── */

const AGENTS_DIR = resolve(join(__dirname, "..", "..", "agents"));

const CATEGORY_MAP: Record<string, AgentCategory> = {
  "00": "orchestrator",
  "01": "leadership", "02": "leadership", "03": "leadership", "04": "leadership",
  "05": "management", "06": "management",
  "07": "development", "08": "development", "09": "development", "10": "development",
  "11": "development", "12": "development", "13": "development", "14": "development",
  "15": "specialized", "16": "specialized", "17": "specialized", "18": "specialized",
  "19": "operations", "20": "operations",
  "22": "autonomy", "23": "autonomy", "24": "autonomy",
  "25": "guardians", "26": "guardians", "27": "guardians", "28": "guardians",
};

const KEYWORD_MAP: Record<string, string[]> = {};

function parseAgentFile(filepath: string): AgentDefinition | null {
  try {
    const raw = readFileSync(filepath, "utf-8");
    const filename = filepath.split(/[\\/]/).pop() ?? "";
    const match = filename.match(/^(\d{2})-(.+)\.md$/);
    if (!match) return null;

    const number = match[1];
    const slugName = match[2];
    const name = slugName.replace(/-/g, " ").toUpperCase();

    // Extract sections
    const roleMatch = raw.match(/\*\*Role\*\*:\s*(.+)/);
    const reportsMatch = raw.match(/\*\*Reports to\*\*:\s*(.+)/);
    const domainMatch = raw.match(/### Directory Map\n([\s\S]*?)(?=\n###|\n##|\n---|\Z)/);
    const patternsMatch = raw.match(/## (Testing Patterns|Code Patterns|Debugging|Workflows|Review Patterns|Discovery Patterns)[\s\S]*?(?=\n## |\n---|\Z)/);

    // Extract identity block
    const identityMatch = raw.match(/## Identity\n([\s\S]*?)(?=\n## |\n---|\Z)/);

    // Extract caveman rules
    const cavemanMatch = raw.match(/## CAVEMAN ULTRA MODE[\s\S]*?(?=\n\*\*Role|\n## Identity|\Z)/);

    // Build system prompt from all available context
    const sections: string[] = [];
    if (identityMatch) sections.push(identityMatch[1].trim());
    if (domainMatch) sections.push("Domain Knowledge:\n" + domainMatch[1].trim());
    if (patternsMatch) sections.push(patternsMatch[0].trim());

    const category = CATEGORY_MAP[number] ?? "development";

    // Extract domain scope from directory map
    const scope: string[] = [];
    if (domainMatch) {
      const dirLines = domainMatch[1].match(/├──\s+(\S+)/g);
      if (dirLines) {
        scope.push(...dirLines.map(l => l.replace(/├──\s+/, "")));
      }
    }

    // Build keyword map for task routing
    const keywords = extractRoutingKeywords(raw, name, category);
    KEYWORD_MAP[name] = keywords;

    return {
      number,
      name,
      role: roleMatch?.[1]?.trim() ?? slugName,
      category,
      reportsTo: reportsMatch?.[1]?.trim() ?? "PULSE-COMMAND",
      domainScope: scope,
      systemPrompt: sections.join("\n\n"),
      cavemanRules: cavemanMatch?.[0]?.trim() ?? null,
      identity: identityMatch?.[1]?.trim() ?? "",
      domainKnowledge: domainMatch?.[1]?.trim() ?? "",
      patterns: patternsMatch?.[0]?.trim() ?? "",
      invocation: `Invoke via CLI: \`devpulse agent ${name}\` or API: POST /api/agents/execute`,
    };
  } catch (err) {
    logger.warn({ err, filepath }, "[AgentRegistry] Failed to parse agent file");
    return null;
  }
}

function extractRoutingKeywords(raw: string, name: string, category: AgentCategory): string[] {
  const keywords = new Set<string>();

  // Category-based keywords
  const categoryKeywords: Record<AgentCategory, string[]> = {
    orchestrator: ["orchestrate", "coordinate", "plan", "strategy", "sprint", "overall"],
    leadership: ["vision", "roadmap", "architecture", "feature design", "sprint planning", "ceo", "cto", "cpo", "vp"],
    management: ["task coordination", "quality strategy", "delivery", "qa lead", "sprint"],
    development: ["code", "implement", "build", "server", "frontend", "backend", "vscode", "database", "api", "security", "devops", "fullstack", "migration", "schema", "query", "route", "endpoint"],
    specialized: ["test", "docs", "review", "bug", "fix", "documentation", "qa", "quality"],
    operations: ["release", "deploy", "monitor", "health", "incident", "infra"],
    autonomy: ["discover", "research", "spawn", "error", "recovery", "retry", "autonomous"],
    guardians: ["dependency", "supply chain", "api contract", "breaking change", "competitor", "performance", "latency", "perf"],
  };

  for (const kw of categoryKeywords[category] ?? []) {
    keywords.add(kw);
  }

  // Name-based keywords
  const nameLower = name.toLowerCase();
  if (nameLower.includes("backend")) keywords.add("server/").add("express").add("trpc").add("services");
  if (nameLower.includes("frontend")) keywords.add("react").add("next.js").add("tailwind").add("frontend");
  if (nameLower.includes("vscode")) keywords.add("extension").add("vscode").add("webview");
  if (nameLower.includes("database")) keywords.add("schema").add("migration").add("drizzle").add("mysql").add("query");
  if (nameLower.includes("api")) keywords.add("endpoint").add("router").add("openapi").add("rest");
  if (nameLower.includes("security")) keywords.add("vulnerability").add("injection").add("red team").add("audit");
  if (nameLower.includes("devops")) keywords.add("docker").add("ci/cd").add("deploy").add("infrastructure");
  if (nameLower.includes("tester") || nameLower.includes("qa")) keywords.add("test").add("vitest").add("playwright").add("e2e");
  if (nameLower.includes("docs")) keywords.add("documentation").add("readme").add("wiki");
  if (nameLower.includes("reviewer")) keywords.add("review").add("pr").add("merge").add("code quality");
  if (nameLower.includes("bug")) keywords.add("fix").add("debug").add("error").add("crash");
  if (nameLower.includes("release")) keywords.add("version").add("changelog").add("publish");
  if (nameLower.includes("monitor")) keywords.add("health").add("sentry").add("prometheus").add("alert");
  if (nameLower.includes("factory")) keywords.add("spawn").add("create agent");
  if (nameLower.includes("research")) keywords.add("discover").add("analyze").add("gap");
  if (nameLower.includes("error")) keywords.add("recovery").add("retry").add("incident");
  if (nameLower.includes("dependency")) keywords.add("npm").add("package").add("version").add("supply chain");
  if (nameLower.includes("steward")) keywords.add("contract").add("breaking").add("compatibility");
  if (nameLower.includes("competitive")) keywords.add("competitor").add("market").add("helicone").add("lakera");
  if (nameLower.includes("performance")) keywords.add("latency").add("perf").add("benchmark").add("n+1");

  return [...keywords];
}

export class AgentRegistry {
  private agents = new Map<string, AgentDefinition>();
  private loaded = false;

  load(): void {
    if (this.loaded) return;

    if (!existsSync(AGENTS_DIR)) {
      logger.warn("[AgentRegistry] Agents directory not found, skipping");
      return;
    }

    const files = readdirSync(AGENTS_DIR).filter(f => f.endsWith(".md") && /^\d{2}-/.test(f));

    for (const file of files) {
      const agent = parseAgentFile(join(AGENTS_DIR, file));
      if (agent) {
        this.agents.set(agent.name, agent);
        logger.debug({ agent: agent.name, category: agent.category }, "[AgentRegistry] loaded");
      }
    }

    this.loaded = true;
    logger.info({ count: this.agents.size }, "[AgentRegistry] All agents loaded");
  }

  get(name: string): AgentDefinition | undefined {
    this.load();
    return this.agents.get(name);
  }

  list(): AgentDefinition[] {
    this.load();
    return [...this.agents.values()].sort((a, b) => a.number.localeCompare(b.number));
  }

  listByCategory(category: AgentCategory): AgentDefinition[] {
    return this.list().filter(a => a.category === category);
  }

  /** Score-based routing: find the best agent for a task. */
  routeTask(taskDescription: string): { agent: AgentDefinition; score: number; reasoning: string } {
    this.load();

    const taskLower = taskDescription.toLowerCase();
    const taskWords = taskLower.split(/\s+/);

    let bestAgent: AgentDefinition | undefined;
    let bestScore = 0;

    for (const agent of this.agents.values()) {
      const keywords = KEYWORD_MAP[agent.name] ?? [];
      let score = 0;

      for (const word of taskWords) {
        if (keywords.some(kw => kw === word || kw.includes(word) || word.includes(kw))) {
          score += 1;
        }
      }

      // Check full phrase matches
      for (const kw of keywords) {
        if (taskLower.includes(kw)) score += 2;
      }

      // Check domain scope
      for (const scope of agent.domainScope) {
        if (taskLower.includes(scope.toLowerCase())) score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    // Fallback to orchestrator
    const agent = bestAgent ?? this.agents.get("PULSE-COMMAND")!;
    return {
      agent,
      score: bestScore,
      reasoning: bestScore > 0
        ? `Matched ${bestScore} routing keywords for ${agent.name}`
        : "No strong match — defaulting to PULSE-COMMAND orchestrator",
    };
  }
}

export const agentRegistry = new AgentRegistry();

/* ─── Agent Executor ───────────────────────────────────────────────────── */

export class AgentExecutor {
  private running = new Map<string, AgentTask>();
  private history: AgentTask[] = [];

  async execute(
    agentName: string,
    task: string,
    options: {
      userId?: number;
      cavemanMode?: boolean;
      maxTokens?: number;
      model?: string;
    } = {}
  ): Promise<AgentTaskResult> {
    const agent = agentRegistry.get(agentName);
    if (!agent) {
      throw new InternalError(`Unknown agent: ${agentName}`, {
        safeMessage: `Agent "${agentName}" not found. Available agents: ${agentRegistry.list().map(a => a.name).join(", ")}`,
      });
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const taskRecord: AgentTask = {
      id: taskId,
      description: task,
      assignedAgent: agentName,
      priority: "medium",
      status: "running",
      createdAt: new Date(),
      startedAt: new Date(),
    };

    this.running.set(taskId, taskRecord);
    const startTime = Date.now();

    try {
      // Build the system prompt
      let systemPrompt: string;

      if (options.cavemanMode && agent.cavemanRules) {
        systemPrompt = agent.cavemanRules;
      } else {
        systemPrompt = [
          `You are ${agent.name}, a ${agent.category} agent in the DevPulse AI Governance Platform.`,
          `Role: ${agent.role}`,
          `Reports to: ${agent.reportsTo}`,
          "",
          agent.identity,
          agent.domainKnowledge ? `\nDomain Knowledge:\n${agent.domainKnowledge}` : "",
        ].filter(Boolean).join("\n");
      }

      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Task: ${task}\n\nExecute this task as ${agent.name}. Work autonomously. No greetings or explanations — just deliver the result.` },
      ];

      const result = await routeLLM({
        messages,
        maxTokens: options.maxTokens ?? 4096,
        userId: options.userId,
        model: options.model,
      });

      const output = typeof result.choices[0]?.message?.content === "string"
        ? result.choices[0].message.content
        : JSON.stringify(result.choices[0]?.message?.content ?? "No output");

      const elapsedMs = Date.now() - startTime;

      taskRecord.status = "completed";
      taskRecord.result = output;
      taskRecord.elapsedMs = elapsedMs;
      taskRecord.completedAt = new Date();

      this.running.delete(taskId);
      this.history.push(taskRecord);

      return {
        taskId,
        agentName,
        output,
        tokensUsed: result.usage
          ? { prompt: result.usage.prompt_tokens, completion: result.usage.completion_tokens }
          : undefined,
        elapsedMs,
      };
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      const errorMsg = (err as Error).message;

      taskRecord.status = "failed";
      taskRecord.error = errorMsg;
      taskRecord.elapsedMs = elapsedMs;
      taskRecord.completedAt = new Date();

      this.running.delete(taskId);
      this.history.push(taskRecord);

      return {
        taskId,
        agentName,
        output: `Error: ${errorMsg}`,
        elapsedMs,
      };
    }
  }

  async executeParallel(
    tasks: Array<{ agentName: string; task: string; userId?: number }>
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();

    // Estimate sequential time
    const sequentialEstimate = tasks.length * 30_000; // rough 30s per task

    const promises = tasks.map(t => this.execute(t.agentName, t.task, { userId: t.userId }));
    const results = await Promise.all(promises);

    const totalElapsedMs = Date.now() - startTime;

    return {
      results,
      totalElapsedMs,
      sequentialEquivalentMs: sequentialEstimate,
      speedup: sequentialEstimate / Math.max(totalElapsedMs, 1),
    };
  }

  getTaskHistory(limit = 50): AgentTask[] {
    return this.history.slice(-limit).reverse();
  }

  getRunningTasks(): AgentTask[] {
    return [...this.running.values()];
  }
}

export const agentExecutor = new AgentExecutor();
