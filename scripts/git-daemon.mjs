#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// J.A.R.V.I.S. Git Daemon — autonomous, non-destructive version-control guardian.
//
// This is the host-side faculty that hands ongoing git management to J.A.R.V.I.S.
// It runs continuously (via launchd; see scripts/install-git-daemon.sh), watches
// EVERY git repository under the configured roots, and does two things forever,
// without user intervention:
//
//   1) PRESERVE  — for any repo with uncommitted work, it captures the entire
//      working tree (tracked changes + untracked files) as a real commit object
//      under refs/jarvis-snapshots/<branch>/<unixtime>. This is done with a TEMP
//      index + `git commit-tree`, so it NEVER touches your working tree, index,
//      HEAD, branches, or stashes. It only ADDS recoverable objects to the local
//      object DB. The single irrecoverable state in git — work that lives only in
//      the working tree and was never `git add`-ed — is eliminated, automatically.
//
//   2) REPORT    — it computes live metrics for every repo (branch, ahead/behind,
//      staged/unstaged/untracked, ±lines, stashes, loss-risk, snapshot age) and
//      serves them over HTTP + Server-Sent Events so the holographic dashboard
//      reflects reality in real time (GitBus → DrawCtx.git → GIT-18/19/20 panels).
//
// SAFETY INVARIANTS (deliberate, audited):
//   • Never runs a mutating porcelain command (no commit/checkout/reset/clean/stash/
//     push/rebase/merge on your branches). Only: read-only plumbing + commit-tree +
//     update-ref under the private refs/jarvis-snapshots/* namespace.
//   • Skips any repo mid-rebase/-merge/-cherry-pick (won't perturb a delicate state).
//   • Honors a `.jarvis-no-autosave` opt-out file at a repo root.
//   • Local-only by default (no network / no push). Binds to 127.0.0.1.
//
// All git/filesystem I/O is async so the HTTP + SSE server stays responsive even
// across dozens of repos. Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, mkdirSync, appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const pexec = promisify(execFile);
const HOME = homedir();
const STATE_DIR = join(HOME, '.jarvis-git');
const CONFIG_PATH = join(STATE_DIR, 'config.json');
const LOG_PATH = join(STATE_DIR, 'daemon.log');
const VERSION = '1.0.0';
const EXEC_OPTS = { encoding: 'utf8', timeout: 20000, maxBuffer: 16 * 1024 * 1024 };

// ── configuration (with sane defaults; installer writes config.json) ──────────
const DEFAULTS = {
  port: 7878,
  roots: [join(HOME, 'Downloads'), join(HOME, 'Projects'), join(HOME, 'Developer'),
    join(HOME, 'code'), join(HOME, 'repos'), join(HOME, 'src'), join(HOME, 'work'), join(HOME, 'dev')],
  scanDepth: 6,
  maxRepos: 150,
  refreshMs: 5000,
  rediscoverMs: 600000,
  gcEveryRediscover: true,  // run `git gc --auto` per repo on each rediscover to bound object-DB growth
  keepSnapshots: 25,
  pushSnapshots: false,
  pushRemote: 'origin',
  ignoreDirs: [
    'node_modules', '.git', 'Library', '.Trash', '.cache', '.npm', '.cargo', '.rustup',
    '.pnpm-store', 'venv', '.venv', 'env', '__pycache__', 'dist', 'build', '.next',
    'target', '.gradle', 'Pods', '.terraform', 'vendor', '.cocoapods', 'Applications',
    '.docker', '.ollama', 'go', '.vscode', '.idea', 'coverage', '.nuxt', '.svelte-kit',
  ],
};

function loadConfig() {
  let cfg = { ...DEFAULTS };
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      cfg = { ...DEFAULTS, ...raw };
      if (Array.isArray(raw.roots)) cfg.roots = raw.roots;
      if (Array.isArray(raw.ignoreDirs)) cfg.ignoreDirs = [...new Set([...DEFAULTS.ignoreDirs, ...raw.ignoreDirs])];
    }
  } catch (e) { log(`config parse error, using defaults: ${e.message}`); }
  return cfg;
}

let CFG = loadConfig();
const PORT = Number(process.env.JARVIS_GIT_PORT) || CFG.port;
const IGNORE = new Set(CFG.ignoreDirs);
const PROTECTED = /^(main|master|develop|release\/.*|prod|production)$/;

// ── logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { mkdirSync(STATE_DIR, { recursive: true }); appendFileSync(LOG_PATH, line); } catch { /* ignore */ }
  process.stdout.write(line);
}

// ── git helpers (async, read-only by default; never throw) ────────────────────
async function git(cwd, args, env) {
  try { const { stdout } = await pexec('git', args, env ? { cwd, env, ...EXEC_OPTS } : { cwd, ...EXEC_OPTS }); return stdout.trim(); }
  catch { return ''; }
}
const gitLines = async (cwd, args) => { const o = await git(cwd, args); return o ? o.split('\n').filter(Boolean) : []; };
const isInt = (s) => /^-?\d+$/.test(s);

// ── repository discovery (async; a dir with .git is a repo root, don't descend) ─
async function discover(roots, depth, maxRepos) {
  const found = new Set();
  const visit = async (dir, d) => {
    if (found.size >= maxRepos || d < 0) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.name === '.git')) { found.add(dir); return; }
    for (const e of entries) {
      if (found.size >= maxRepos) break;
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;   // skip hidden dirs (dotfile/tooling repos, caches)
      if (IGNORE.has(e.name)) continue;        // skip heavy/vendored dirs
      await visit(join(dir, e.name), d - 1);
    }
  };
  for (const root of roots) { if (existsSync(root)) await visit(root, depth); }
  return [...found].sort();
}

// ── per-repo metrics + autonomous snapshot ────────────────────────────────────
const lastTree = new Map(); // repoPath → last snapshotted tree sha (de-dupe ref churn)
const inFlight = new Set();  // repoPaths currently snapshotting — serialize refresh vs POST /snapshot

// Resolve the real git dir — handles linked worktrees/submodules where `.git` is a
// FILE ("gitdir: <path>") rather than a directory, so mid-operation markers are found.
function gitDir(repoPath) {
  const dot = join(repoPath, '.git');
  try {
    const m = readFileSync(dot, 'utf8').match(/^gitdir:\s*(.+)$/m); // throws EISDIR if .git is a dir
    if (m) { const p = m[1].trim(); return p.startsWith('/') ? p : join(repoPath, p); }
  } catch { /* .git is a normal directory */ }
  return dot;
}
function midOperation(repoPath) {
  const gd = gitDir(repoPath);
  for (const f of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'BISECT_LOG'])
    if (existsSync(join(gd, f))) return true;
  return false;
}

// Capture the full working tree (tracked + untracked, honoring .gitignore) into a
// snapshot commit under refs/jarvis-snapshots/<branch>/<ts>, WITHOUT touching the
// real index/working tree/HEAD. Returns the new ref name, or '' if nothing to do.
async function snapshot(repoPath, branch) {
  if (existsSync(join(repoPath, '.jarvis-no-autosave'))) return '';
  if (midOperation(repoPath)) return '';
  if (inFlight.has(repoPath)) return '';   // a snapshot of this repo is already running
  inFlight.add(repoPath);
  const tmpIndex = join(tmpdir(), `jarvis-idx-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  const run = async (args) => { const { stdout } = await pexec('git', args, { cwd: repoPath, env, ...EXEC_OPTS }); return stdout.trim(); };
  try {
    const head = await git(repoPath, ['rev-parse', '--verify', 'HEAD']); // '' if unborn
    if (head) await run(['read-tree', head]);          // seed temp index from HEAD
    await run(['add', '-A']);                            // stage tracked + untracked into TEMP index
    const tree = await run(['write-tree']);
    if (!tree) return '';
    if (lastTree.get(repoPath) === tree) return '';     // unchanged since last snapshot
    const branchSafe = (branch || 'detached').replace(/[^A-Za-z0-9._\/-]/g, '_');
    const ts = Math.floor(Date.now() / 1000);
    const args = ['commit-tree', tree, '-m', `jarvis-autosave: ${branchSafe} @ ${new Date().toISOString()}`];
    if (head) args.push('-p', head);
    const commit = await run(args);
    if (!commit) return '';
    const ref = `refs/jarvis-snapshots/${branchSafe}/${ts}`;
    await git(repoPath, ['update-ref', ref, commit]);
    lastTree.set(repoPath, tree);
    await pruneSnapshots(repoPath, branchSafe);
    if (CFG.pushSnapshots) await git(repoPath, ['push', CFG.pushRemote, `${ref}:${ref}`]);
    return ref;
  } catch (e) {
    log(`snapshot failed for ${repoPath}: ${e.message}`);
    return '';
  } finally {
    inFlight.delete(repoPath);
    try { rmSync(tmpIndex, { force: true }); } catch { /* ignore */ }
  }
}

async function pruneSnapshots(repoPath, branchSafe) {
  const refs = (await gitLines(repoPath, ['for-each-ref', '--format=%(refname)', `refs/jarvis-snapshots/${branchSafe}`]))
    .map((r) => ({ r, ts: Number((r.match(/\/(\d+)$/) || [])[1] || 0) }))
    .sort((a, b) => a.ts - b.ts);                               // oldest first (numeric, not lexical)
  for (let i = 0; i < refs.length - CFG.keepSnapshots; i++) await git(repoPath, ['update-ref', '-d', refs[i].r]);
}

async function snapshotInfo(repoPath) {
  const refs = await gitLines(repoPath, ['for-each-ref', '--format=%(refname)', 'refs/jarvis-snapshots']);
  let newest = -1;
  for (const r of refs) { const m = r.match(/\/(\d+)$/); if (m) newest = Math.max(newest, Number(m[1])); }
  return { count: refs.length, ageSec: newest > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - newest) : -1 };
}

async function repoMetrics(repoPath) {
  const name = repoPath.split('/').filter(Boolean).pop() || repoPath;
  const rawBranch = await git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = !rawBranch || rawBranch === 'HEAD' ? 'DETACHED' : rawBranch; // abbrev-ref returns 'HEAD' when detached
  const isProtected = PROTECTED.test(branch);

  const status = await gitLines(repoPath, ['status', '--porcelain']);
  let staged = 0, unstaged = 0, untracked = 0;
  for (const l of status) {
    if (l.startsWith('??')) { untracked++; continue; }
    if (l[0] && l[0] !== ' ' && l[0] !== '?') staged++;
    if (l[1] && l[1] !== ' ' && l[1] !== '?') unstaged++;
  }

  let added = 0, deleted = 0;
  for (const a of [['diff', '--numstat'], ['diff', '--cached', '--numstat']])
    for (const row of await gitLines(repoPath, a)) {
      const [x, y] = row.split('\t');
      if (isInt(x)) added += Number(x);
      if (isInt(y)) deleted += Number(y);
    }

  let ahead = 0, behind = 0;
  const upstream = await git(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream) {
    const [b, a] = (await git(repoPath, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`])).split(/\s+/);
    if (isInt(b)) behind = Number(b);
    if (isInt(a)) ahead = Number(a);
  }

  const stashes = (await gitLines(repoPath, ['stash', 'list'])).length;
  const dirty = staged + unstaged + untracked > 0;
  const lastSubject = (await git(repoPath, ['log', '-1', '--pretty=%s'])) || '(no commits)';
  const lastEpoch = await git(repoPath, ['log', '-1', '--pretty=%ct']);
  const lastAgeSec = isInt(lastEpoch) ? Math.max(0, Math.floor(Date.now() / 1000) - Number(lastEpoch)) : -1;

  if (dirty) await snapshot(repoPath, branch);   // autonomous preservation
  const snap = await snapshotInfo(repoPath);

  let risk = 0;
  risk += Math.min(0.40, (added + deleted) / 600);
  risk += Math.min(0.25, untracked / 12);
  risk += Math.min(0.15, ahead / 12);
  if (dirty && (snap.ageSec < 0 || snap.ageSec > 600)) risk += 0.20;
  if (dirty && isProtected) risk += 0.15;
  risk = Math.min(1, risk);

  return {
    name, path: repoPath, branch, protected: isProtected,
    ahead, behind, staged, unstaged, untracked, added, deleted, stashes,
    dirty, risk, lastSubject, lastAgeSec, snapshotAgeSec: snap.ageSec, _snapshots: snap.count,
  };
}

// ── live snapshot of the whole fleet ──────────────────────────────────────────
let REPOS = [];
let SNAPSHOT = { ts: Date.now(), version: VERSION, repos: [], summary: emptySummary() };
let scanning = false;

function emptySummary() {
  return {
    repos: 0, dirty: 0, atRisk: 0, uncommittedLines: 0, untracked: 0, ahead: 0, behind: 0,
    stashes: 0, snapshots: 0, lastSnapshotAgeSec: -1, protectedDirty: 0, avgRisk: 0, maxRisk: 0, scanning: false,
  };
}

async function refresh() {
  if (scanning) return;
  scanning = true;
  try {
    const repos = [];
    for (const p of REPOS) { try { repos.push(await repoMetrics(p)); } catch (e) { log(`metrics error ${p}: ${e.message}`); } }
    repos.sort((a, b) => b.risk - a.risk || (b.added + b.deleted) - (a.added + a.deleted));
    const sum = {
      repos: repos.length,
      dirty: repos.filter((r) => r.dirty).length,
      atRisk: repos.filter((r) => r.risk >= 0.5).length,
      uncommittedLines: repos.reduce((s, r) => s + r.added + r.deleted, 0),
      untracked: repos.reduce((s, r) => s + r.untracked, 0),
      ahead: repos.reduce((s, r) => s + r.ahead, 0),
      behind: repos.reduce((s, r) => s + r.behind, 0),
      stashes: repos.reduce((s, r) => s + r.stashes, 0),
      snapshots: repos.reduce((s, r) => s + (r._snapshots || 0), 0),
      lastSnapshotAgeSec: repos.reduce((m, r) => (r.snapshotAgeSec >= 0 ? (m < 0 ? r.snapshotAgeSec : Math.min(m, r.snapshotAgeSec)) : m), -1),
      protectedDirty: repos.filter((r) => r.dirty && r.protected).length,
      avgRisk: repos.length ? repos.reduce((s, r) => s + r.risk, 0) / repos.length : 0,
      maxRisk: repos.reduce((m, r) => Math.max(m, r.risk), 0),
      scanning: false,
    };
    SNAPSHOT = { ts: Date.now(), version: VERSION, repos: repos.map(({ _snapshots, ...r }) => r), summary: sum };
    broadcast();
  } finally { scanning = false; }
}

async function rediscover() {
  const before = REPOS.length;
  REPOS = await discover(CFG.roots, CFG.scanDepth, CFG.maxRepos);
  log(`discovery: ${REPOS.length} repos under ${CFG.roots.length} roots (was ${before})`);
}

// Bound object-DB growth: pruned snapshot refs leave unreachable objects; `git gc --auto`
// lets each repo's own maintenance reclaim them (a no-op unless git's thresholds are hit).
async function gcSweep() {
  if (!CFG.gcEveryRediscover) return;
  for (const p of REPOS) { try { await git(p, ['gc', '--auto', '--quiet']); } catch { /* ignore */ } }
}

// ── HTTP + SSE server ─────────────────────────────────────────────────────────
const clients = new Set();
function broadcast() {
  const frame = `event: git\ndata: ${JSON.stringify(SNAPSHOT)}\n\n`;
  for (const res of clients) { try { res.write(frame); } catch { /* dropped */ } }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  // Same-origin (Vite /gitd proxy) needs no CORS; allow ONLY local origins so an arbitrary
  // website the operator visits can't read repo paths/branches or trigger snapshots.
  const origin = req.headers.origin || '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'online', version: VERSION, ts: Date.now(), repoCount: REPOS.length }));
  } else if (url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(SNAPSHOT));
  } else if (url === '/snapshot' && req.method === 'POST') {
    let n = 0;
    for (const p of REPOS) { const b = await git(p, ['rev-parse', '--abbrev-ref', 'HEAD']); if (await snapshot(p, b)) n++; }
    await refresh();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, created: n }));
  } else if (url === '/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    res.write(`event: git\ndata: ${JSON.stringify(SNAPSHOT)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  } else {
    res.writeHead(404); res.end('not found');
  }
});

setInterval(() => { for (const res of clients) { try { res.write(': hb\n\n'); } catch { /* ignore */ } } }, 15000).unref();

// ── boot — listen FIRST (so /health answers immediately), then scan ──────────
function main() {
  mkdirSync(STATE_DIR, { recursive: true });
  try { writeFileSync(join(STATE_DIR, 'daemon.pid'), String(process.pid)); } catch { /* ignore */ }
  log(`JARVIS git daemon v${VERSION} starting on 127.0.0.1:${PORT} (pushSnapshots=${CFG.pushSnapshots})`);
  server.on('error', (e) => { log(`server error: ${e.message}`); process.exit(1); });
  server.listen(PORT, '127.0.0.1', async () => {
    log(`listening on http://127.0.0.1:${PORT}`);
    await rediscover();
    await refresh();
    setInterval(() => { refresh().catch((e) => log(`refresh error: ${e.message}`)); }, CFG.refreshMs).unref();
    setInterval(() => { rediscover().then(gcSweep).catch((e) => log(`rediscover error: ${e.message}`)); }, CFG.rediscoverMs).unref();
  });
}

process.on('SIGTERM', () => { log('SIGTERM — shutting down'); process.exit(0); });
process.on('SIGINT', () => { log('SIGINT — shutting down'); process.exit(0); });

main();
