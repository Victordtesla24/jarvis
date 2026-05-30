# Run Claude Code locally + dual-server diff (original vs. ours)

## Why local
Your Mac has the camera, the real MiniMax backend, Docker, and ~/.claude/.env.production.
Cloud Claude Code can't see the webcam, so the live gesture loop can only be proven here.
Run BOTH apps side-by-side so runtime errors/exceptions in OURS are obvious vs. the working ORIGINAL.

## STEP 1 — get both projects ready

### A) The ORIGINAL (known-working) on port 3000
```bash
cd ~/Downloads/jarvis-holographic-1.0.0
npm install          # if not already
npm run dev -- --port 3000 --host 127.0.0.1
```
Open http://localhost:3000 — allow camera. This is the reference that works.

### B) OURS (the R3F dashboard) on port 3001, in a second terminal
```bash
cd ~/.jarvis/.claude/worktrees/jarvis-r3f/lib/dashboard_app
git fetch origin fix/holographic-uplift && git reset --hard origin/fix/holographic-uplift
npm install
npm run dev -- --port 3001 --host 127.0.0.1
```
Open http://localhost:3001?debug — the ?debug flag shows the live gesture values overlay.

### C) The backend (for OUR live telemetry), third terminal
```bash
cd ~/.jarvis/.claude/worktrees/jarvis-r3f
python3 -c "from lib import dashboard; dashboard.serve(host='127.0.0.1', port=7327, open_browser=False)"
```

## STEP 2 — let Claude Code catch the runtime diffs

In a fourth terminal, point Claude Code at our dashboard with both servers live so it can
compare console/runtime behavior and fix every exception OURS throws that the ORIGINAL doesn't:

```bash
cd ~/.jarvis/.claude/worktrees/jarvis-r3f/lib/dashboard_app
claude "Two dev servers are running: the PROVEN-WORKING original at http://localhost:3000 and OUR dashboard at http://localhost:3001?debug (backend at :7327). Open both, allow camera, and compare runtime behavior. The reference originals are in ./_gesture_reference/. Goal: make hand gestures control BOTH the reactor and the globe in ours exactly like the original controls the globe. Catch and fix EVERY console error, uncaught exception, and gesture-pipeline difference in ours vs. the original. The ?debug overlay shows live rotationControl/expansionFactor/isPinching — use it to prove the camera->ref->motion pipeline works. Do not break the build (npm run build must stay green, tsc --noEmit zero errors). Commit fixes to branch fix/holographic-uplift. Be honest about anything still broken."
```

## What to watch for (the runtime diff)
- ORIGINAL camera prompt appears + hand skeleton draws → if OURS doesn't, the VideoFeed mount/initialize differs.
- ?debug numbers move when you move your hands → pipeline alive. If numbers move but reactor/globe don't → consume-side (useFrame) bug. If numbers don't move → capture-side (camera/MediaPipe) bug.
- Compare DevTools consoles on :3000 vs :3001 — every red line in :3001 that isn't in :3000 is a regression to fix.

## Notes
- Our vite dev defaults to :3000 too; the `-- --port 3001` override avoids the clash with the original.
- If port already in use: `lsof -ti:3001 | xargs kill` then retry.
- ralphy (autonomous loop) is also available if you want hands-off iteration:
  `ralphy --claude "fix all runtime errors in lib/dashboard_app so gestures drive reactor+globe like the original at :3000"`
