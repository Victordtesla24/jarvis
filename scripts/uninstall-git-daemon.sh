#!/usr/bin/env bash
# Stop and remove the J.A.R.V.I.S. git daemon launchd agent. Snapshots already written
# to each repo's object DB (refs/jarvis-snapshots/*) are left intact and recoverable.
set -euo pipefail
LABEL="com.jarvis.gitdaemon"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
GUI="gui/$(id -u)"

launchctl bootout "$GUI/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Removed $PLIST and stopped the daemon."
echo "Snapshots remain under refs/jarvis-snapshots/* in each repo (use scripts/jarvis-restore.sh to recover)."
