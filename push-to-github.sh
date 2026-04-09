#!/bin/bash
# Run this from /Users/vic/claude/General-Work/jarvis/jarvis-build
# It pushes the committed code to GitHub

set -e

cd "$(dirname "$0")"

echo "=== JARVIS — Pushing to GitHub ==="
echo "Remote: $(git remote get-url origin)"
echo "Branch: main"
echo "Commit: $(GIT_INDEX_FILE=/tmp/jarvis-git-index git log --oneline -1)"
echo ""

export GIT_INDEX_FILE=/tmp/jarvis-git-index
git push -u origin main

echo ""
echo "✓ Push complete — https://github.com/Victordtesla24/jarvis"
