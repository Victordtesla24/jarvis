# CLAUDE.md — J.A.R.V.I.S. Holographic Interface

Operating instructions for any AI agent (and human) working in this repo. **User
instructions always take precedence.**

## Project shape (orient fast, change little)

- Vite + React 18 + R3F 8 dashboard. `npm run dev` (port 3000). `npm test` (vitest),
  `npm run lint` (tsc), `npm run build`.
- Three live **buses**, identical singleton + `Set<listener>` + `window` seam pattern:
  - `services/telemetryBus.ts` (`Telemetry`) — the laptop (battery/cpu/heap/net/fps).
  - `services/agentState.ts` (`AgentBus`) — the JARVIS brain (mood/intensity/activity/tps).
  - `services/gitBus.ts` (`GitBus`) — version control (repos/risk/snapshots), fed by the git daemon.
- Instruments are Canvas-2D panels reading one `DrawCtx` (`{ctx,t,dt,w,h,sig,a,tel,git}`)
  each frame (`widgets/HudCanvas.tsx`). Placement + console-free gates live in `widgets/GestureDeck.tsx`.
- Backend brain: `agent/jarvis_brain.py` (FastAPI, Docker) streamed over SSE at `/api/jarvis`.
- **Retention rule:** touch only what the task needs. The deck's console-free layout
  invariant (documented in `GestureDeck.tsx`) is load-bearing — verify no panel overlaps.

## Git rules (MANDATORY)

- **NEVER commit or push to `main`/`master`.** Branch first: `git switch -c <type>/<short-name>`.
- One task = one branch (its own lane). Prefer a dedicated `git worktree` for parallel work.
- Commit ONLY when explicitly asked. Stage deliberately — never blind `git add -A` outside a
  preservation checkpoint; one concern per commit.
- **NEVER run:** `git reset --hard`, `git clean -fd`, `git checkout -- .`,
  `git push --force[-with-lease]`, `git stash drop/clear`, `git branch -D`,
  `git rebase` on shared branches. Ask first. (The `git-guard` hook enforces this.)
- `git push` requires explicit human approval. Commit locally freely; pushing is gated.
- Ship via pull request; open as a DRAFT PR until ready. `main` is protected server-side by a
  GitHub ruleset (require PR, block force-push & deletion, restrict direct updates).

## Autonomous version-control faculty (handover — this is yours, JARVIS)

A host-side daemon now manages git for **every** repo, continuously and without user
intervention, so uncommitted work can never become unrecoverable again.

- **`scripts/git-daemon.mjs`** — discovers every repo under the configured roots
  (`~/.jarvis-git/config.json`) and, for any dirty repo, captures the FULL working tree
  (tracked **and** untracked) as a commit object under `refs/jarvis-snapshots/<branch>/<ts>`
  using a temp index + `git commit-tree`. It **never** touches the working tree, index,
  HEAD, branches, or stashes — it only adds recoverable objects locally (no push by default).
  It also serves live metrics over HTTP + SSE on `127.0.0.1:7878`.
- **Install / run:** `npm run gitd:install` (launchd agent, runs on login) or `npm run gitd`
  (foreground). Logs: `~/.jarvis-git/daemon.log`. Force a snapshot: `curl -XPOST :7878/snapshot`.
- **Recover work:** `scripts/jarvis-restore.sh` lists snapshots and parks any one on a
  `jarvis-restore/*` branch (non-destructive). Snapshots are also reachable via normal git:
  `git for-each-ref refs/jarvis-snapshots`, `git stash apply <sha>`, `git checkout <sha> -- <file>`.
- **Dashboard surface:** `GitBus` → `DrawCtx.git` → panels **GIT-18 VERSION CONTROL CORE**,
  **GIT-19 REPOSITORY MATRIX**, **GIT-20 COMMIT STREAM**. They update in real time the instant
  the daemon detects a change (including commits you make), and recolor with `AgentBus.mood`;
  emit `<<ui {"highlight":"<repo-name>"}>>` to spotlight a repo in the matrix.

### Day-to-day runbook
1. **Start a task** → `git worktree add -b <type>/<slug> ../jarvis-<slug> <base>` (or
   `claude --worktree <slug>` / `isolation: worktree` for an agent); install deps per worktree.
2. **During** → small, one-concern commits. The daemon checkpoints WIP automatically.
3. **Push** → only on explicit human approval; `push.default=simple` + the `pre-push` hook guard you.
4. **PR** → open a draft; squash-merge into `main` (the only path, enforced by the ruleset).
5. **Finish** → `git worktree remove ../jarvis-<slug>`; `git branch -d <branch>`; `git worktree prune`.

### Guard wiring (run once, by the user)
`scripts/install-git-guard.sh` wires the deterministic `git-guard` PreToolUse hook + deny/ask
permissions into Claude settings (the agent does not self-wire its own hooks). The shared
`pre-push` hook is enabled via `git config core.hooksPath .githooks`.

Full reference: `docs/jarvis-git-management/README.md`. Strategy: `~/Downloads/strategic-git-plan.md`.
