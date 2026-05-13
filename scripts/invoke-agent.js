#!/usr/bin/env node
/**
 * Agent CLI — invoke any DevPulse agent from the command line.
 *
 * Usage:
 *   node scripts/invoke-agent.js <agent-name> "<task description>"
 *   node scripts/invoke-agent.js --list
 *   node scripts/invoke-agent.js --route "<task>"   (auto-route to best agent)
 *   node scripts/invoke-agent.js --parallel "<task1>" "<task2>" ...
 *   node scripts/invoke-agent.js --history
 *
 * Examples:
 *   node scripts/invoke-agent.js DEV-BACKEND "Add rate limiting to auth middleware"
 *   node scripts/invoke-agent.js --route "fix the bug in login page"
 *   node scripts/invoke-agent.js --parallel "add tests for auth" "update API docs"
 */

const { agentRegistry, agentExecutor } = await import("../server/services/agentOrchestrator.js");

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
DevPulse Agent CLI
──────────────────
  node scripts/invoke-agent.js <agent> "<task>"     Invoke a specific agent
  node scripts/invoke-agent.js --list               List all 29 agents
  node scripts/invoke-agent.js --route "<task>"     Auto-route to best agent
  node scripts/invoke-agent.js --parallel "<t1>" "<t2>" ...  Run tasks in parallel
  node scripts/invoke-agent.js --history            Show recent task history
  node scripts/invoke-agent.js --status             Show running tasks

Examples:
  node scripts/invoke-agent.js DEV-BACKEND "Add rate limiting to auth"
  node scripts/invoke-agent.js --route "fix the login page bug"
  node scripts/invoke-agent.js --parallel "write tests for auth" "update API docs"
`);
}

async function main() {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    return;
  }

  if (args[0] === "--list") {
    const agents = agentRegistry.list();
    console.log(`\nDevPulse Agent Registry — ${agents.length} agents\n`);
    for (const agent of agents) {
      console.log(`  ${agent.number} │ ${agent.name.padEnd(22)} │ ${agent.category.padEnd(12)} │ ${agent.role}`);
    }
    console.log(`\nTotal: ${agents.length} agents across ${new Set(agents.map(a => a.category)).size} categories\n`);
    return;
  }

  if (args[0] === "--history") {
    const history = agentExecutor.getTaskHistory(20);
    if (history.length === 0) {
      console.log("No task history yet.");
      return;
    }
    console.log(`\nRecent Tasks — ${history.length} entries\n`);
    for (const t of history) {
      const status = t.status === "completed" ? "✅" : t.status === "failed" ? "❌" : "🔄";
      const elapsed = t.elapsedMs ? `(${(t.elapsedMs / 1000).toFixed(1)}s)` : "";
      console.log(`  ${status} [${t.assignedAgent}] ${t.description.slice(0, 80)} ${elapsed}`);
    }
    return;
  }

  if (args[0] === "--status") {
    const running = agentExecutor.getRunningTasks();
    if (running.length === 0) {
      console.log("No tasks currently running.");
    } else {
      console.log(`\nRunning Tasks — ${running.length}\n`);
      for (const t of running) {
        console.log(`  🔄 [${t.assignedAgent}] ${t.description.slice(0, 80)}`);
      }
    }
    return;
  }

  if (args[0] === "--route") {
    const task = args.slice(1).join(" ");
    if (!task) {
      console.error("Error: --route requires a task description");
      process.exit(1);
    }
    const { agent, score, reasoning } = agentRegistry.routeTask(task);
    console.log(`\nRouting: "${task.slice(0, 80)}${task.length > 80 ? "..." : ""}"`);
    console.log(`→ ${agent.name} (score: ${score}) — ${reasoning}\n`);

    const result = await agentExecutor.execute(agent.name, task, { cavemanMode: true });
    console.log(`[${result.agentName}] (${(result.elapsedMs / 1000).toFixed(1)}s)`);
    console.log(result.output);
    if (result.tokensUsed) {
      console.log(`\nTokens: ${result.tokensUsed.prompt}p + ${result.tokensUsed.completion}c`);
    }
    return;
  }

  if (args[0] === "--parallel") {
    const taskDescs = args.slice(1).join(" ").split(/\s*;;\s*/).filter(Boolean);
    if (taskDescs.length < 2) {
      console.error("Error: --parallel requires 2+ tasks separated by ';;'");
      process.exit(1);
    }

    console.log(`\nParallel execution — ${taskDescs.length} tasks\n`);

    const tasks = taskDescs.map(t => {
      const route = agentRegistry.routeTask(t);
      console.log(`  → ${route.agent.name.padEnd(22)} │ "${t.slice(0, 60)}${t.length > 60 ? "..." : ""}"`);
      return { agentName: route.agent.name, task: t };
    });

    console.log("");
    const result = await agentExecutor.executeParallel(tasks);

    for (const r of result.results) {
      const status = r.output.startsWith("Error:") ? "❌" : "✅";
      console.log(`${status} [${r.agentName}] (${(r.elapsedMs / 1000).toFixed(1)}s)`);
      console.log(`   ${r.output.slice(0, 200)}${r.output.length > 200 ? "..." : ""}`);
      console.log("");
    }

    console.log(`Total: ${(result.totalElapsedMs / 1000).toFixed(1)}s | Sequential est: ${(result.sequentialEquivalentMs / 1000).toFixed(1)}s | Speedup: ${result.speedup.toFixed(1)}x`);
    return;
  }

  // Direct agent invocation
  const agentName = args[0].toUpperCase();
  const task = args.slice(1).join(" ");

  if (!task) {
    console.error("Error: task description required");
    process.exit(1);
  }

  const agent = agentRegistry.get(agentName);
  if (!agent) {
    console.error(`Unknown agent: ${agentName}`);
    console.error(`Available: ${agentRegistry.list().map(a => a.name).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nInvoking ${agent.name} (${agent.category})...\n`);
  const result = await agentExecutor.execute(agentName, task, { cavemanMode: true });

  console.log(`[${result.agentName}] (${(result.elapsedMs / 1000).toFixed(1)}s)`);
  console.log(result.output);
  if (result.tokensUsed) {
    console.log(`\nTokens: ${result.tokensUsed.prompt}p + ${result.tokensUsed.completion}c`);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
