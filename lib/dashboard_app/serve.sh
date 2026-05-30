#!/usr/bin/env bash
# =============================================================================
# J.A.R.V.I.S. — full-stack launcher for the floating holographic HUD.
#
# Brings up the ENTIRE stack in the right order and streams every step to a log
# so it can be troubleshot live:
#   1. Load secrets (~/.jarvis/.env, fallback ~/.claude/.env.production)
#   2. Preflight: Node, Python, Docker daemon (the agent's prune_docker needs it)
#   3. Build the React/R3F dashboard into dist/ (only if stale)
#   4. Launch the JARVIS backend + MiniMax AI agent + Electron floating glass app
#      via the real CLI (python3 -m lib.cli dashboard)
#
# Usage:
#   ./serve.sh              # build if needed, launch floating .app (default)
#   ./serve.sh --browser    # serve the HUD in a browser instead of the .app
#   ./serve.sh --rebuild    # force a clean dashboard rebuild first
#   ./serve.sh --backend    # backend + agent only (no Electron window)
# =============================================================================
set -uo pipefail

# --- paths -------------------------------------------------------------------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"          # lib/dashboard_app
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"                         # worktree root (has lib/)
LOG_DIR="$APP_DIR/server-logs"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/jarvis-$TS.log"
PORT="${JARVIS_PORT:-7327}"

mkdir -p "$LOG_DIR"

log()  { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
ok()   { echo "[$(date '+%H:%M:%S')] ✅ $*" | tee -a "$LOG_FILE"; }
warn() { echo "[$(date '+%H:%M:%S')] ⚠️  $*" | tee -a "$LOG_FILE"; }
die()  { echo "[$(date '+%H:%M:%S')] ❌ $*" | tee -a "$LOG_FILE"; exit 1; }

MODE="app"
FORCE_REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --browser) MODE="browser" ;;
    --backend) MODE="backend" ;;
    --rebuild) FORCE_REBUILD=1 ;;
    *) warn "unknown flag: $arg" ;;
  esac
done

log "=== J.A.R.V.I.S. launcher — mode=$MODE port=$PORT ==="
log "repo: $REPO_ROOT"

# --- 1. secrets --------------------------------------------------------------
# config.py reads ~/.jarvis/.env automatically; we ALSO export keys from the
# production env file as a fallback so the MiniMax brain is always credentialed.
load_env() {
  local f="$1"
  [ -f "$f" ] || return 1
  log "loading env: $f"
  # export non-comment KEY=VALUE lines without evaluating the file
  set -a
  while IFS= read -r line; do
    case "$line" in
      ''|\#*) continue ;;
      *=*) export "${line%%=*}=${line#*=}" 2>/dev/null || true ;;
    esac
  done < "$f"
  set +a
  return 0
}
load_env "$HOME/.jarvis/.env"            || warn "no ~/.jarvis/.env"
load_env "$HOME/.claude/.env.production" || true
if [ -n "${MINIMAX_API_KEY:-}" ]; then ok "MiniMax key present (agent brain enabled)"; else warn "MINIMAX_API_KEY missing — agent falls back to heuristics"; fi

# --- 1b. permissions (one-shot; retained after first grant) ------------------
# Grants Camera/Mic/Accessibility/Screen/Automation/Full-Disk in a single pass
# so the user never approves tools individually. Idempotent via a marker file.
if [ "$MODE" != "backend" ] && [ ! -f "$HOME/.jarvis/.permissions_granted" ]; then
  log "first run — bootstrapping all macOS permissions at once…"
  bash "$APP_DIR/permissions.sh" || warn "permission bootstrap skipped/failed (you can re-run ./permissions.sh)"
else
  ok "permissions already bootstrapped (or backend-only mode)"
fi

# --- 2. preflight ------------------------------------------------------------
command -v python3 >/dev/null || die "python3 not found"
ok "python3: $(python3 --version 2>&1)"
if [ "$MODE" != "backend" ]; then
  command -v node >/dev/null || die "node not found (needed to build/run the dashboard)"
  ok "node: $(node --version)"
fi
# Docker is optional but the agent's prune_docker action needs the daemon up.
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then ok "docker daemon: up"; else warn "docker installed but daemon DOWN — start Docker Desktop for prune_docker actions"; fi
else
  warn "docker not installed — prune_docker actions will be skipped by the agent"
fi

# --- 3. build the dashboard --------------------------------------------------
if [ "$MODE" != "backend" ]; then
  cd "$APP_DIR"
  if [ ! -d node_modules ]; then
    log "installing npm dependencies (first run)…"
    npm install >>"$LOG_FILE" 2>&1 || die "npm install failed — see $LOG_FILE"
    ok "npm install complete"
  fi
  if [ "$FORCE_REBUILD" = "1" ] || [ ! -f dist/index.html ] || [ src -nt dist ] 2>/dev/null; then
    log "building dashboard (vite build)…"
    npm run build >>"$LOG_FILE" 2>&1 || die "vite build failed — see $LOG_FILE"
    ok "dashboard built → dist/"
  else
    ok "dist/ present — skipping rebuild (use --rebuild to force)"
  fi
fi

# --- 4. launch ---------------------------------------------------------------
cleanup() {
  log "shutting down JARVIS…"
  [ -n "${JARVIS_PID:-}" ] && kill "$JARVIS_PID" 2>/dev/null || true
  pkill -f "lib.cli dashboard" 2>/dev/null || true
  ok "JARVIS offline."
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT"
export JARVIS_DASHBOARD_URL="http://127.0.0.1:$PORT"

case "$MODE" in
  app)
    log "launching backend + MiniMax agent + Electron floating glass app…"
    # The CLI serves /api on :PORT and spawns the transparent Electron window.
    python3 -m lib.cli dashboard --port "$PORT" 2>&1 | tee -a "$LOG_FILE" &
    JARVIS_PID=$!
    ;;
  browser)
    log "launching backend + agent, serving HUD in browser…"
    python3 -m lib.cli dashboard --port "$PORT" --browser 2>&1 | tee -a "$LOG_FILE" &
    JARVIS_PID=$!
    ;;
  backend)
    log "launching backend + agent ONLY (no window)…"
    python3 -c "from lib import dashboard; dashboard.serve(host='127.0.0.1', port=$PORT, open_browser=False)" 2>&1 | tee -a "$LOG_FILE" &
    JARVIS_PID=$!
    ;;
esac

sleep 3
# health probe so failures surface immediately in the log
if curl -s -m 5 "http://127.0.0.1:$PORT/api/stats" >/dev/null 2>&1; then
  ok "backend healthy — /api/stats responding on :$PORT"
else
  warn "backend not answering /api/stats yet (it may still be starting; watch the log)"
fi
log "JARVIS running (PID $JARVIS_PID). Logs: $LOG_FILE"
log "Press Ctrl-C to disengage."
wait "$JARVIS_PID" 2>/dev/null || true
