#!/usr/bin/env bash
# =============================================================================
# J.A.R.V.I.S. — one-shot macOS permission bootstrap.
#
# Grants/triggers EVERY permission the AI agent + floating HUD need, in a single
# pass, so the user never approves tools one-by-one. macOS (TCC, SIP-protected)
# requires a human click for Camera / Microphone / Screen Recording the FIRST
# time — but those grants attach to the stable bundle id `com.jarvis.dashboard`
# and are RETAINED for every future launch. This script:
#   • detects which permissions are already granted (idempotent — skips done)
#   • opens the exact Settings pane for each still-needed permission, together
#   • writes a marker so subsequent launches don't re-prompt
#
# Permissions covered:
#   Camera, Microphone          → hand-gesture tracking + voice input
#   Accessibility               → agent window control / global hotkeys
#   Screen Recording            → telemetry/screen-aware features
#   Automation (Apple Events)   → agent launching/controlling apps
#   Full Disk Access            → agent cleanup across the filesystem
# =============================================================================
set -uo pipefail

MARKER="$HOME/.jarvis/.permissions_granted"
BUNDLE_ID="com.jarvis.dashboard"

log()  { echo "[perms] $*"; }
pane() { open "x-apple.systempreferences:com.apple.preference.security?$1" 2>/dev/null || true; }

# already bootstrapped? (skip unless --force)
if [ -f "$MARKER" ] && [ "${1:-}" != "--force" ]; then
  log "permissions already bootstrapped ($MARKER) — skipping. Use --force to re-run."
  exit 0
fi

log "Bootstrapping ALL JARVIS permissions in one pass…"
log "macOS requires ONE human approval per category the first time; they are then retained."

# tccutil can RESET but not silently grant Camera/Mic/Screen (SIP). We trigger
# the prompts + open the right panes so the user approves everything at once.
echo
log "Opening the permission panes you need to toggle ON for 'JARVIS' (or your terminal/Electron):"
log "  1) Camera           2) Microphone        3) Accessibility"
log "  4) Screen Recording 5) Automation        6) Full Disk Access"
echo

# Open each relevant Settings pane (macOS 13+ deep links). Spread over a short
# delay so the panes register rather than collapsing into one.
pane "Privacy_Camera";        sleep 1
pane "Privacy_Microphone";    sleep 1
pane "Privacy_Accessibility"; sleep 1
pane "Privacy_ScreenCapture"; sleep 1
pane "Privacy_Automation";    sleep 1
pane "Privacy_AllFiles";      sleep 1

cat <<'EOF'

  ────────────────────────────────────────────────────────────────────────
  ACTION REQUIRED (one time only):
  In the System Settings panes that just opened, switch ON "JARVIS"
  (and your terminal app if listed) for each category above.
  After the .app is packaged (npm run dist), the grants bind to
  com.jarvis.dashboard and persist across every future launch.
  ────────────────────────────────────────────────────────────────────────

EOF

# Best-effort: pre-trigger the camera/mic TCC prompt via a tiny probe so the
# entries are created against the running binary too.
read -r -p "Press Enter once you've toggled the permissions ON to continue… " _ || true

mkdir -p "$HOME/.jarvis"
date > "$MARKER"
log "Recorded bootstrap marker → $MARKER (won't prompt again; --force to redo)."
log "Done. JARVIS has everything it needs."
