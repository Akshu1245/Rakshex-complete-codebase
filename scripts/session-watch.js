#!/usr/bin/env node
/**
 * session-watch.js — Background daemon that auto-saves session state every 30s.
 * Survives agent crashes — runs independently.
 *
 * Usage:
 *   node scripts/session-watch.js           Start daemon (background)
 *   node scripts/session-watch.js stop      Stop running daemon
 *   node scripts/session-watch.js status    Check if daemon is running
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const MEM_DIR = join(PROJECT_ROOT, '.commandcode', 'memory');
const STATE_FILE = join(MEM_DIR, 'session_state.md');
const SESSIONS_DIR = join(MEM_DIR, 'sessions');
const PID_FILE = join(MEM_DIR, '.watch_pid');
const HEARTBEAT_FILE = join(MEM_DIR, '.watch_heartbeat');
const HOT_FILES_FILE = join(MEM_DIR, '.hot_files.json');

const INTERVAL_MS = 30_000; // 30 seconds
const IGNORE_DIRS = ['node_modules', '.git', 'dist', '.commandcode'];

const cmd = process.argv[2];

function ensureDirs() {
  if (!existsSync(MEM_DIR)) mkdirSync(MEM_DIR, { recursive: true });
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function getGitBranch() {
  try { return execSync('git branch --show-current', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

function getGitStatus() {
  try {
    execSync('git diff-index --quiet HEAD --', { cwd: PROJECT_ROOT });
    return 'Clean';
  } catch { return 'Dirty'; }
}

function scanHotFiles() {
  const hotFiles = [];
  const cutoff = Date.now() - 60_000; // modified in last 60 seconds

  try {
    const walk = (dir) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (IGNORE_DIRS.includes(e.name)) continue;
          const full = join(dir, e.name);
          if (e.isDirectory()) { walk(full); continue; }
          try {
            const st = statSync(full);
            if (st.mtimeMs > cutoff) {
              hotFiles.push({
                path: full.replace(PROJECT_ROOT, '').replace(/^[\\/]/, ''),
                mtime: new Date(st.mtimeMs).toISOString()
              });
            }
          } catch {}
        }
      } catch {}
    };

    // Only scan top-level dirs (not full recursive — too slow)
    const topDirs = readdirSync(PROJECT_ROOT, { withFileTypes: true })
      .filter(e => e.isDirectory() && !IGNORE_DIRS.includes(e.name));

    for (const d of topDirs) {
      walk(join(PROJECT_ROOT, d.name));
    }

    // Sort by most recent
    hotFiles.sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {}

  return hotFiles.slice(0, 15);
}

function snapshot() {
  ensureDirs();

  const branch = getGitBranch();
  const gitStatus = getGitStatus();
  const hotFiles = scanHotFiles();
  const ts = now();

  // Read existing state to preserve Current Task
  let existingTask = '';
  let existingDecisions = '';
  let existingOpen = '';
  try {
    const existing = readFileSync(STATE_FILE, 'utf8');
    const tm = existing.match(/## Current Task\n([\s\S]*?)(?=\n## )/);
    const dm = existing.match(/## Recent Decisions\n([\s\S]*?)(?=\n## Active)/);
    const om = existing.match(/## Open Items\n([\s\S]*?)$/);
    if (tm) existingTask = tm[1].trim();
    if (dm) existingDecisions = dm[1].trim();
    if (om) existingOpen = om[1].trim();
  } catch {}

  // Add auto-save decision
  const decision = `- [${ts}] Auto-saved — ${hotFiles.length} hot files, branch: ${branch}, ${gitStatus}`;
  const decisions = existingDecisions
    ? `${existingDecisions}\n${decision}`
    : `- [${ts}] Initial auto-save — branch: ${branch}`;

  // Build state
  const state = `# DevPulse Session State
> Last auto-save: ${ts}
> Daemon PID: ${existsSync(PID_FILE) ? readFileSync(PID_FILE, 'utf8').trim() : 'unknown'}

## Current Task
${existingTask || 'No active task recorded'}

## Project Context
- **Project**: DevPulse - developer productivity platform
- **Stack**: Node.js/Express + Vite + Drizzle ORM + MySQL + Redis + BullMQ
- **Structure**: Monorepo (devpulse-frontend, devpulse-vscode, server, shared, packages)
- **Branch**: ${branch}

## Recent Decisions
${decisions}

## Hot Files (modified in last 60s)
${hotFiles.length === 0 ? '- none' : hotFiles.map(f => `- \`${f.path}\` (${f.mtime})`).join('\n')}

## Git State
- Branch: ${branch}
- ${gitStatus}

## Open Items
${existingOpen || '- None recorded'}
`;

  writeFileSync(STATE_FILE, state, 'utf8');

  // Save hot files JSON for quick lookup
  writeFileSync(HOT_FILES_FILE, JSON.stringify({ ts, hotFiles }, null, 2), 'utf8');

  // Write heartbeat
  writeFileSync(HEARTBEAT_FILE, ts, 'utf8');

  return { hotFiles: hotFiles.length, branch, gitStatus };
}

function startDaemon() {
  ensureDirs();

  // Check if already running
  if (existsSync(PID_FILE)) {
    const pid = readFileSync(PID_FILE, 'utf8').trim();
    try { process.kill(Number(pid), 0); console.log(`Daemon already running (PID: ${pid})`); process.exit(1); }
    catch { /* stale PID file — continue */ }
  }

  // Fork into background
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '_run'], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  writeFileSync(PID_FILE, String(child.pid), 'utf8');
  child.unref();

  console.log(`Daemon started (PID: ${child.pid}) — auto-saving every ${INTERVAL_MS / 1000}s`);
  console.log(`Stop with: node scripts/session-watch.js stop`);
}

function runLoop() {
  ensureDirs();
  writeFileSync(PID_FILE, String(process.pid), 'utf8');

  console.log(`[${now()}] Watch daemon started — PID: ${process.pid}`);

  // Initial snapshot
  const r = snapshot();
  console.log(`[${now()}] Initial snapshot — ${r.hotFiles} hot files, branch: ${r.branch}`);

  // Periodic snapshot
  const timer = setInterval(() => {
    const r2 = snapshot();
    console.log(`[${now()}] Auto-saved — ${r2.hotFiles} hot files`);
  }, INTERVAL_MS);

  // Graceful shutdown
  const cleanup = () => {
    clearInterval(timer);
    try {
      snapshot();
      writeFileSync(HEARTBEAT_FILE, `${now()} SHUTDOWN`, 'utf8');
    } catch {}
    try { if (existsSync(PID_FILE)) { const p = readFileSync(PID_FILE, 'utf8'); /* just checking */ } } catch {}
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}

function stopDaemon() {
  if (!existsSync(PID_FILE)) {
    console.log('No daemon running.');
    process.exit(0);
  }

  const pid = Number(readFileSync(PID_FILE, 'utf8').trim());
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Daemon stopped (PID: ${pid})`);
  } catch {
    console.log(`Daemon not responding — cleaning up stale PID file`);
  }

  try { /* cleanup pid file — leave it for the signal handler */ } catch {}
}

function showStatus() {
  if (!existsSync(PID_FILE)) {
    console.log('Status: NOT RUNNING');
    process.exit(0);
  }

  const pid = Number(readFileSync(PID_FILE, 'utf8').trim());
  let running = false;
  try { process.kill(pid, 0); running = true; } catch {}

  if (!running) {
    console.log('Status: DEAD (stale PID file)');
    process.exit(0);
  }

  let heartbeat = 'unknown';
  try { heartbeat = readFileSync(HEARTBEAT_FILE, 'utf8').trim(); } catch {}

  let hotCount = 0;
  try {
    const hf = JSON.parse(readFileSync(HOT_FILES_FILE, 'utf8'));
    hotCount = hf.hotFiles?.length || 0;
  } catch {}

  console.log(`Status: RUNNING (PID: ${pid})`);
  console.log(`Last heartbeat: ${heartbeat}`);
  console.log(`Hot files: ${hotCount}`);
}

// === MAIN ===
if (cmd === '_run') {
  runLoop();
} else if (cmd === 'stop') {
  stopDaemon();
} else if (cmd === 'status') {
  showStatus();
} else if (cmd === 'start' || !cmd) {
  startDaemon();
} else {
  console.log(`
DevPulse Session Watch Daemon

Usage:
  node scripts/session-watch.js           Start daemon (background)
  node scripts/session-watch.js stop      Stop running daemon
  node scripts/session-watch.js status    Check if daemon is running

The daemon auto-saves session state every ${INTERVAL_MS / 1000} seconds.
Even if your agent session crashes, the latest state is preserved.
`);
}
