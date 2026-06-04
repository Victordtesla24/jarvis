# J.A.R.V.I.S. Autonomous Git Management

This subsystem hands ongoing git management to J.A.R.V.I.S. so that **uncommitted work
can never become unrecoverable again**, multi-branch/agent work stays untangled, and the
holographic dashboard shows live version-control telemetry that aids decisions.

It implements `~/Downloads/strategic-git-plan.md` and extends it with (a) a continuous
host-side preservation daemon and (b) three real-time dashboard panels.

---

## 1. Architecture

```
 host filesystem                         dashboard (Vite :3000)
 ┌────────────────────────┐   SSE        ┌───────────────────────────────┐
 │ git-daemon.mjs         │  /gitd/stream│ gitBus.ts (GitBus singleton)  │
 │  • discover all repos  │◀────proxy───▶│   → DrawCtx.git               │
 │  • snapshot dirty trees│   /gitd/*     │   → GIT-18 VERSION CTRL CORE  │
 │  • compute metrics     │              │   → GIT-19 REPOSITORY MATRIX  │
 │  127.0.0.1:7878        │              │   → GIT-20 COMMIT STREAM      │
 └────────────────────────┘              └───────────────────────────────┘
        │ writes                                   ▲ recolors with
        ▼ refs/jarvis-snapshots/*                  │ AgentBus.mood / highlight
   local object DB (recoverable)        agent <<ui {"highlight":"repo"}>>
```

The git bus mirrors `Telemetry` and `AgentBus` exactly (singleton + `Set<listener>` +
`window.GitBus` QA seam), so all three compose identically inside the instrument deck.

## 2. The daemon (`scripts/git-daemon.mjs`)

Zero-dependency Node service. Two jobs, forever:

**Preserve.** Every `refreshMs` (default 5 s), for each dirty repo it captures the entire
working tree — tracked changes **and** untracked files — into a commit under
`refs/jarvis-snapshots/<branch>/<unixtime>`, via a *temporary* index + `git commit-tree`.

> Safety invariants (audited): it never runs a mutating porcelain command. It only does
> read-only plumbing + `commit-tree` + `update-ref` under the private
> `refs/jarvis-snapshots/*` namespace. Your working tree, index, HEAD, branches and
> stashes are never touched. It skips repos mid-rebase/-merge/-cherry-pick, honors a
> `.jarvis-no-autosave` opt-out file, de-dupes identical trees (no ref churn), prunes to
> `keepSnapshots` per branch, and is **local-only** by default (no push). Binds to localhost.

**Report.** Computes per-repo metrics (branch, ahead/behind, staged/unstaged/untracked,
±lines, stashes, last-commit age, snapshot age, composite loss-risk) and a fleet summary,
served as JSON and pushed over SSE.

### Endpoints (proxied as `/gitd/*` in dev)
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + repo count |
| GET | `/metrics` | full `GitSnapshot` JSON |
| GET | `/stream` | SSE (`event: git`) — pushed on every refresh |
| POST | `/snapshot` | force a snapshot of every dirty repo now |

### Config — `~/.jarvis-git/config.json`
```json
{ "port": 7878, "roots": ["/Users/you"], "scanDepth": 6, "maxRepos": 150,
  "refreshMs": 5000, "rediscoverMs": 600000, "keepSnapshots": 25,
  "pushSnapshots": false, "pushRemote": "origin" }
```
Set `pushSnapshots: true` (and a reachable `pushRemote`) for an off-machine backup of the
snapshot refs. Logs: `~/.jarvis-git/daemon.log`.

### Run / install
```bash
npm run gitd            # foreground (dev)
npm run gitd:install    # persistent launchd agent (runs on login) — recommended
npm run gitd:uninstall  # stop & remove the agent (snapshots are kept)
```

## 3. Recovery

```bash
scripts/jarvis-restore.sh                  # list snapshots for the repo you're in
scripts/jarvis-restore.sh --diff <ref>     # diff a snapshot vs your current tree
scripts/jarvis-restore.sh <ref>            # park it on a jarvis-restore/* branch (non-destructive)
```
Or with plain git: `git for-each-ref refs/jarvis-snapshots` → `git stash apply <sha>` /
`git checkout <sha> -- <path>` / `git branch rescue <sha>`.

## 4. Guardrails (defense-in-depth)

| Layer | Where | Enforces |
|---|---|---|
| GitHub ruleset on `main` | server-side | require PR, block force-push & deletion, restrict direct updates — **unbypassable** |
| `pre-push` hook | `.githooks/pre-push` (+ `core.hooksPath`) | blocks direct/force/wrong-branch pushes locally (bypassable with `--no-verify`) |
| git-guard | `scripts/git-guard.sh` → Claude PreToolUse | blocks `reset --hard`, `clean -fd`, force-push, `stash drop/clear`, `branch -D`, and commit/push on protected branches |
| permissions | Claude settings deny/ask | deny destructive git; prompt on commit/push |
| CLAUDE.md | repo root | shapes agent intent |

Wire the agent guard (run yourself — the agent will not self-wire its hooks):
```bash
bash scripts/install-git-guard.sh            # user scope (every repo)
bash scripts/install-git-guard.sh --project  # + project scope
git config core.hooksPath .githooks          # enable the shared pre-push hook
```

## 5. Dashboard panels

- **GIT-18 VERSION CONTROL CORE** — radial preservation-integrity gauge (1 − mean risk),
  ringed by one dot per repo (green→amber→red), with a scanner sweep and a "WIP SAVED Xs AGO"
  readout. Turns red on imminent loss risk or dirty-on-protected.
- **GIT-19 REPOSITORY MATRIX** — per-repo status cards (branch · ahead/behind · ±lines · risk
  bar), most-at-risk first; spotlights the agent-highlighted repo.
- **GIT-20 COMMIT STREAM** — scrolling uncommitted-lines history + a sync conduit (flowing
  dashes ∝ unpushed work) + an autosave-heartbeat bar.

They render live only when the daemon is reachable; otherwise they show an honest `VC LINK DOWN`.
Placement: far-left console-free rail in `GestureDeck.tsx`, height-gated like the rest of the deck.
