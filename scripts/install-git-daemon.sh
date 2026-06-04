#!/usr/bin/env bash
# Install the J.A.R.V.I.S. git daemon as a persistent macOS launchd agent so it runs
# continuously and on login — fully autonomous version-control management for every
# repo, with no user intervention. Idempotent: safe to re-run after edits.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON="$SCRIPT_DIR/git-daemon.mjs"
STATE_DIR="$HOME/.jarvis-git"
CONFIG="$STATE_DIR/config.json"
LABEL="com.jarvis.gitdaemon"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE_BIN="$(command -v node || true)"

[ -n "$NODE_BIN" ] || { echo "ERROR: node not found on PATH." >&2; exit 1; }
[ -f "$DAEMON" ] || { echo "ERROR: daemon not found at $DAEMON" >&2; exit 1; }

mkdir -p "$STATE_DIR" "$HOME/Library/LaunchAgents"

# Default config — watch the whole home tree (depth-limited) so EVERY past & future
# repo is preserved; local-only snapshots (no push). Edit and re-run to change.
if [ ! -f "$CONFIG" ]; then
  cat > "$CONFIG" <<JSON
{
  "port": 7878,
  "roots": ["$HOME"],
  "scanDepth": 6,
  "maxRepos": 150,
  "refreshMs": 5000,
  "rediscoverMs": 600000,
  "keepSnapshots": 25,
  "pushSnapshots": false,
  "pushRemote": "origin"
}
JSON
  echo "Wrote default config → $CONFIG"
else
  echo "Keeping existing config → $CONFIG"
fi

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$DAEMON</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>$HOME</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>$HOME</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StandardOutPath</key><string>$STATE_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$STATE_DIR/launchd.err.log</string>
</dict>
</plist>
PLIST
echo "Wrote launchd plist → $PLIST"

# (re)load via modern launchctl, falling back to legacy load.
GUI="gui/$(id -u)"
launchctl bootout "$GUI/$LABEL" 2>/dev/null || true
if launchctl bootstrap "$GUI" "$PLIST" 2>/dev/null; then
  launchctl enable "$GUI/$LABEL" 2>/dev/null || true
  launchctl kickstart -k "$GUI/$LABEL" 2>/dev/null || true
else
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load -w "$PLIST"
fi

sleep 1
echo ""
if curl -fsS "http://127.0.0.1:7878/health" >/dev/null 2>&1; then
  echo "✅ JARVIS git daemon is live → http://127.0.0.1:7878/health"
  curl -fsS "http://127.0.0.1:7878/health" 2>/dev/null || true; echo ""
else
  echo "⚠️  Daemon installed but not answering yet; check $STATE_DIR/daemon.log"
fi
echo "Manage: launchctl kickstart -k $GUI/$LABEL  ·  logs: tail -f $STATE_DIR/daemon.log"
