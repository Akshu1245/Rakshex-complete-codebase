#!/usr/bin/env node
/**
 * session-memory.js — Cross-session persistent memory CLI
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const MEM_DIR = join(PROJECT_ROOT, ".commandcode", "memory");
const STATE_FILE = join(MEM_DIR, "session_state.md");
const SESSIONS_DIR = join(MEM_DIR, "sessions");

const cmd = process.argv[2];

function ensureDirs() {
  if (!existsSync(MEM_DIR)) mkdirSync(MEM_DIR, { recursive: true });
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

function getGitBranch() {
  try {
    return execSync("git branch --show-current", { cwd: PROJECT_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function getGitStatus() {
  try {
    execSync("git diff-index --quiet HEAD --", { cwd: PROJECT_ROOT });
    return "Clean working tree";
  } catch {
    return "Uncommitted changes";
  }
}

function getActiveFiles() {
  try {
    const changed = execSync("git diff --name-only HEAD", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();
    return changed ? changed.split("\n").slice(0, 10) : ["none"];
  } catch {
    return ["unknown"];
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// === SAVE ===
if (cmd === "save") {
  ensureDirs();
  const branch = getGitBranch();
  const gitStatus = getGitStatus();
  const activeFiles = getActiveFiles();

  let existingTask = "";
  let existingOpen = "";
  try {
    const existing = readFileSync(STATE_FILE, "utf8");
    const taskMatch = existing.match(/## Current Task\n([\s\S]*?)(?=\n## )/);
    const openMatch = existing.match(/## Open Items\n([\s\S]*?)$/);
    if (taskMatch) existingTask = taskMatch[1].trim();
    if (openMatch) existingOpen = openMatch[1].trim();
  } catch {}

  const state = `# DevPulse Session State
> Auto-loaded at session start. Updated at session end.

## Current Task
${existingTask || "No active task recorded"}

## Project Context
- **Project**: DevPulse - developer productivity platform
- **Stack**: Node.js/Express + Vite + Drizzle ORM + MySQL + Redis + BullMQ
- **Structure**: Monorepo (devpulse-frontend, devpulse-vscode, server, shared, packages)
- **Branch**: ${branch}

## Recent Decisions
- [${today()}] Session memory saved — branch: ${branch}

## Active Files
${activeFiles.map((f) => `- ${f}`).join("\n")}

## Git State
- Branch: ${branch}
- ${gitStatus}

## Open Items
${existingOpen || "- None recorded"}
`;

  writeFileSync(STATE_FILE, state, "utf8");
  console.log(`[MEMORY] State saved → ${STATE_FILE}`);
  console.log(`         Branch: ${branch} | Status: ${gitStatus}`);
}

// === LOAD ===
else if (cmd === "load") {
  ensureDirs();
  if (existsSync(STATE_FILE)) {
    console.log(readFileSync(STATE_FILE, "utf8"));
  } else {
    console.log("# No session state found.\nRun `node scripts/session-memory.js save` first.");
  }
}

// === LOG ===
else if (cmd === "log") {
  const msg = process.argv[3];
  if (!msg) {
    console.log('Usage: node scripts/session-memory.js log "your message"');
    process.exit(1);
  }
  ensureDirs();
  const sessionFile = join(SESSIONS_DIR, `${today()}.md`);

  if (existsSync(sessionFile)) {
    const existing = readFileSync(sessionFile, "utf8");
    writeFileSync(sessionFile, existing + `- ${msg}\n`, "utf8");
  } else {
    const branch = getGitBranch();
    writeFileSync(
      sessionFile,
      `# Session: ${today()}\n\n## Summary\n${msg}\n\n## Changes Made\n- ${msg}\n\n## Branch\n${branch}\n`,
      "utf8",
    );
  }
  console.log(`[MEMORY] Logged → ${sessionFile}`);
}

// === HISTORY ===
else if (cmd === "history") {
  ensureDirs();
  if (!existsSync(SESSIONS_DIR)) {
    console.log("No sessions yet.");
    process.exit(0);
  }

  const sessions = readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse()
    .slice(0, 5);

  console.log("=== Last 5 Sessions ===\n");
  for (const s of sessions) {
    const content = readFileSync(join(SESSIONS_DIR, s), "utf8");
    const summaryMatch = content.match(/## Summary\n([^\n]+)/);
    console.log(`[${s.replace(".md", "")}] ${summaryMatch ? summaryMatch[1] : "(no summary)"}`);
  }
}

// === HELP ===
else {
  console.log(`
DevPulse Session Memory CLI

Commands:
  node scripts/session-memory.js save      Snapshot current state
  node scripts/session-memory.js load      Print current state
  node scripts/session-memory.js log "msg" Append to session log
  node scripts/session-memory.js history   Show last 5 sessions
`);
}
