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
//      reflects reality in real time (GitBus → DrawCtx.git → the GIT-18/19/20 panels).
//
// SAFETY INVARIANTS (deliberate, audited):
//   • Never runs a mutating porcelain command (no commit/checkout/reset/clean/stash/
//     push/rebase/merge on your branches). Only: read-only plumbing + commit-tree +
//     update-ref under the private refs/jarvis-snapshots/* namespace.
//   • Skips any repo mid-rebase/-merge/-cherry-pick (won't perturb a delicate state).
//   • Honors a `.jarvis-no-autosave` opt-out file at a repo root.
//   • Local-only by default (no network / no push). Binds to 127.0.0.1.
//
// Zero dependencies — Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────

import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, statSync, readFileSync, mkdirSync, appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();
const STATE_DIR = join(HOME, '.jarvis-git');
const CONFIG_PATH = join(STATE_DIR, 'config.json');
const LOG_PATH = join(STATE_DIR, 'daemon.log');
const VERSION = '1.0.0';

// ── configuration (with sane defaults; installer writes config.json) ──────────
const DEFAULTS = {
  port: 7878,
  roots: [
    join(HOME, 'Downloads'), join(HOME, 'Projects'), join(HOME, 'Developer'),
    join(HOME, 'code'), join(HOME, 'repos'), join(HOME, 'src'), join(HOME, 'work'),
    join(HOME, 'Documents'), join(HOME, 'dev'),
  ],
  scanDepth: 5,             // how deep under each root to search for repos
  maxRepos: 80,             // safety cap on watched repos
  refreshMs: 5000,          // metric refresh + snapshot-check cadence
  rediscoverMs: 600000,     // re-scan roots for new/removed repos every 10 min
  keepSnapshots: 25,        // snapshot refs retained per branch (older pruned)
  pushSnapshots: false,     // local-only by default (no off-machine push)
  pushRemote: 'origin',
  // directory names never descended into during discovery
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

// ── git helpers (read-only by default; never throws) ──────────────────────────
function git(cwd, args, { allowFail = true } = {}) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    if (!allowFail) throw e;
    return '';
  }
}
const gitLines = (cwd, args) => { const o = git(cwd, args); return o ? o.split('\n').filter(Boolean) : []; };
const isInt = (s) => /^-?\d+$/.test(s);

// ── repository discovery ──────────────────────────────────────────────────────
function discover(roots, depth, maxRepos) {
  const found = new Set();
  const visit = (dir, d) => {
    if (found.size >= maxRepos || d < 0) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    // a directory containing .git is a repo root; record it and do not descend further
    if (entries.some((e) => e.name === '.git')) { found.add(dir); return; }
    for (const e of entries) {
      if (found.size >= maxRepos) break;
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;   // skip hidden dirs (dotfile/tooling repos, caches)
      if (IGNORE.has(e.name)) continue;        // skip heavy/vendored dirs
      visit(join(dir, e.name), d - 1);
    }
  };
  for (const root of roots) { if (existsSync(root)) visit(root, depth); }
  return [...found].sort();
}

// ── per-repo metrics + autonomous snapshot ────────────────────────────────────
const lastTree = new Map(); // repoPath → last snapshotted tree sha (de-dupe ref churn)

function midOperation(repoPath) {
  const gd = join(repoPath, '.git');
  for (const f of ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'BISECT_LOG']) {
    if (existsSync(join(gd, f))) return true;
  }
  return false;
}

// Capture the full working tree (tracked + untracked, honoring .gitignore) into a
// snapshot commit under refs/jarvis-snapshots/<branch>/<ts>, WITHOUT touching the
// real index/working tree/HEAD. Returns the new ref name, or '' if nothing to do.
function snapshot(repoPath, branch) {
  if (existsSync(join(repoPath, '.jarvis-no-autosave'))) return '';
  if (midOperation(repoPath)) return '';
  const tmpIndex = join(tmpdir(), `jarvis-idx-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  const run = (args) => execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'], env }).trim();
  try {
    const head = git(repoPath, ['rev-parse', '--verify', 'HEAD']); // '' if unborn
    if (head) run(['read-tree', head]);              // seed temp index from HEAD
    run(['add', '-A']);                               // stage tracked + untracked into TEMP index
    const tree = run(['write-tree']);
    if (!tree) return '';
    if (lastTree.get(repoPath) === tree) return '';   // nothing changed since last snapshot
    const branchSafe = (branch || 'detached').replace(/[^A-Za-z0-9._\/-]/g, '_');
    const ts = Math.floor(Date.now() / 1000);
    const msg = `jarvis-autosave: ${branchSafe} @ ${new Date().toISOString()}`;
    const commitArgs = ['commit-tree', tree, '-m', msg];
    if (head) commitArgs.push('-p', head);
    const commit = run(commitArgs);
    if (!commit) return '';
    const ref = `refs/jarvis-snapshots/${branchSafe}/${ts}`;
    git(repoPath, ['update-ref', ref, commit]);
    lastTree.set(repoPath, tree);
    pruneSnapshots(repoPath, branchSafe);
    if (CFG.pushSnapshots) {
      // off-machine backup of the private snapshot namespace (opt-in)
      git(repoPath, ['push', CFG.pushRemote, `${ref}:${ref}`]);
    }
    return ref;
  } catch (e) {
    log(`snapshot failed for ${repoPath}: ${e.message}`);
    return '';
  } finally {
    try { rmSync(tmpIndex, { force: true }); } catch { /* ignore */ }
  }
}

function pruneSnapshots(repoPath, branchSafe) {
  const refs = gitLines(repoPath, ['for-each-ref', '--format=%(refname)', `refs/jarvis-snapshots/${branchSafe}`]).sort();
  const excess = refs.length - CFG.keepSnapshots;
  for (let i = 0; i < excess; i++) git(repoPath, ['update-ref', '-d', refs[i]]);
}

function snapshotInfo(repoPath) {
  const refs = gitLines(repoPath, ['for-each-ref', '--format=%(refname)', 'refs/jarvis-snapshots']);
  let newest = -1;
  for (const r of refs) { const m = r.match(/\/(\d+)$/); if (m) newest = Math.max(newest, Number(m[1])); }
  const ageSec = newest > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - newest) : -1;
  return { count: refs.length, ageSec };
}

function repoMetrics(repoPath) {
  const name = repoPath.split('/').filter(Boolean).pop() || repoPath;
  const branch = git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'DETACHED';
  const isProtected = PROTECTED.test(branch);

  // counts via porcelain status
  const status = gitLines(repoPath, ['status', '--porcelain']);
  let staged = 0, unstaged = 0, untracked = 0;
  for (const l of status) {
    if (l.startsWith('??')) { untracked++; continue; }
    const x = l[0], y = l[1];
    if (x && x !== ' ' && x !== '?') staged++;
    if (y && y !== ' ' && y !== '?') unstaged++;
  }

  // ±lines (tracked) = staged numstat + unstaged numstat
  let added = 0, deleted = 0;
  for (const args of [['diff', '--numstat'], ['diff', '--cached', '--numstat']]) {
    for (const row of gitLines(repoPath, args)) {
      const [a, d] = row.split('\t');
      if (isInt(a)) added += Number(a);
      if (isInt(d)) deleted += Number(d);
    }
  }

  // ahead / behind upstream
  let ahead = 0, behind = 0;
  const upstream = git(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream) {
    const lr = git(repoPath, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`]);
    const [b, a] = lr.split(/\s+/);
    if (isInt(b)) behind = Number(b);
    if (isInt(a)) ahead = Number(a);
  }

  const stashes = gitLines(repoPath, ['stash', 'list']).length;
  const dirty = staged + unstaged + untracked > 0;

  // last commit
  const lastSubject = git(repoPath, ['log', '-1', '--pretty=%s']) || '(no commits)';
  const lastEpoch = git(repoPath, ['log', '-1', '--pretty=%ct']);
  const lastAgeSec = isInt(lastEpoch) ? Math.max(0, Math.floor(Date.now() / 1000) - Number(lastEpoch)) : -1;

  // autonomous preservation, then read snapshot state
  if (dirty) snapshot(repoPath, branch);
  const snap = snapshotInfo(repoPath);

  // composite loss-risk 0..1
  let risk = 0;
  risk += Math.min(0.40, (added + deleted) / 600);
  risk += Math.min(0.25, untracked / 12);
  risk += Math.min(0.15, ahead / 12);
  if (dirty && (snap.ageSec < 0 || snap.ageSec > 600)) risk += 0.20; // unsnapshotted dirty work
  if (dirty && isProtected) risk += 0.15;                            // dirty on a protected branch
  risk = Math.min(1, risk);

  return {
    name, path: repoPath, branch, protected: isProtected,
    ahead, behind, staged, unstaged, untracked, added, deleted, stashes,
    dirty, risk, lastSubject, lastAgeSec, snapshotAgeSec: snap.ageSec,
    _snapshots: snap.count,
  };
}

// ── live snapshot of the whole fleet ──────────────────────────────────────────
let REPOS = [];          // discovered repo paths
let SNAPSHOT = emptySnapshot();
let scanning = false;

function emptySnapshot() {
  return {
    ts: Date.now(), version: VERSION, repos: [],
    summary: {
      repos: 0, dirty: 0, atRisk: 0, uncommittedLines: 0, untracked: 0, ahead: 0, behind: 0,
      stashes: 0, snapshots: 0, lastSnapshotAgeSec: -1, protectedDirty: 0, avgRisk: 0, maxRisk: 0,
      scanning: false,
    },
  };
}

function refresh() {
  if (scanning) return;
  scanning = true;
  try {
    const repos = REPOS.map((p) => { try { return repoMetrics(p); } catch (e) { log(`metrics error ${p}: ${e.message}`); return null; } }).filter(Boolean);
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
    // strip internal field before publishing
    const pub = repos.map(({ _snapshots, ...r }) => r);
    SNAPSHOT = { ts: Date.now(), version: VERSION, repos: pub, summary: sum };
    broadcast();
  } finally { scanning = false; }
}

function rediscover() {
  const before = REPOS.length;
  REPOS = discover(CFG.roots, CFG.scanDepth, CFG.maxRepos);
  log(`discovery: ${REPOS.length} repos under ${CFG.roots.length} roots (was ${before})`);
}

// ── HTTP + SSE server ─────────────────────────────────────────────────────────
const clients = new Set();
function broadcast() {
  const frame = `event: git\ndata: ${JSON.stringify(SNAPSHOT)}\n\n`;
  for (const res of clients) { try { res.write(frame); } catch { /* dropped */ } }
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'online', version: VERSION, ts: Date.now(), repoCount: REPOS.length }));
    return;
  }
  if (url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(SNAPSHOT));
    return;
  }
  if (url === '/snapshot' && req.method === 'POST') {
    let n = 0;
    for (const p of REPOS) { const b = git(p, ['rev-parse', '--abbrev-ref', 'HEAD']); if (snapshot(p, b)) n++; }
    refresh();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, created: n }));
    return;
  }
  if (url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    res.write(`event: git\ndata: ${JSON.stringify(SNAPSHOT)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  res.writeHead(404); res.end('not found');
});

// heartbeat keeps SSE intermediaries from closing idle streams
setInterval(() => { for (const res of clients) { try { res.write(': hb\n\n'); } catch { /* ignore */ } } }, 15000).unref();

// ── boot ──────────────────────────────────────────────────────────────────────
function main() {
  mkdirSync(STATE_DIR, { recursive: true });
  try { writeFileSync(join(STATE_DIR, 'daemon.pid'), String(process.pid)); } catch { /* ignore */ }
  log(`JARVIS git daemon v${VERSION} starting on 127.0.0.1:${PORT} (pushSnapshots=${CFG.pushSnapshots})`);
  rediscover();
  refresh();
  setInterval(refresh, CFG.refreshMs).unref();
  setInterval(rediscover, CFG.rediscoverMs).unref();
  server.listen(PORT, '127.0.0.1', () => log(`listening on http://127.0.0.1:${PORT}`));
  server.on('error', (e) => { log(`server error: ${e.message}`); process.exit(1); });
}

process.on('SIGTERM', () => { log('SIGTERM — shutting down'); process.exit(0); });
process.on('SIGINT', () => { log('SIGINT — shutting down'); process.exit(0); });

main();
