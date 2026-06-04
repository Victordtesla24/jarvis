#!/usr/bin/env bash
# install-git-guard.sh — wire the deterministic git-guard into Claude Code so EVERY
# session (in every repo) is protected from work-destroying commands and from
# committing/pushing to protected branches. Run this yourself — it edits your Claude
# settings (an action the agent deliberately does not take on your behalf).
#
#   bash scripts/install-git-guard.sh          # user (global) scope — covers every repo
#   bash scripts/install-git-guard.sh --project # also add a project-scoped copy
set -euo pipefail
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required." >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/git-guard.sh"
[ -f "$SRC" ] || { echo "ERROR: $SRC not found." >&2; exit 1; }

DENY='["Bash(git push --force:*)","Bash(git push --force-with-lease:*)","Bash(git push -f:*)","Bash(git push --mirror:*)","Bash(git push --prune:*)","Bash(git push --delete:*)","Bash(git reset --hard:*)","Bash(git clean -f:*)","Bash(git clean -fd:*)","Bash(git clean --force:*)","Bash(git checkout -- .:*)","Bash(git checkout --force:*)","Bash(git restore .:*)","Bash(git stash drop:*)","Bash(git stash clear:*)","Bash(git branch -D:*)","Bash(git reflog expire:*)","Bash(git update-ref -d:*)","Bash(git push:* main)","Bash(git push:* master)","Bash(git push:* develop)","Bash(git push:* prod)","Bash(git push:* production)"]'
ASK='["Bash(git commit:*)","Bash(git push:*)"]'

patch_settings() { # $1 = settings.json path, $2 = hook command path
  local FILE="$1" CMD="$2"
  mkdir -p "$(dirname "$FILE")"
  [ -f "$FILE" ] || echo '{}' > "$FILE"
  cp "$FILE" "$FILE.bak.$(date +%Y%m%d-%H%M%S)"
  jq --arg cmd "$CMD" --argjson deny "$DENY" --argjson ask "$ASK" '
    .permissions = (.permissions // {}) |
    .permissions.deny = ((.permissions.deny // []) + $deny | unique) |
    .permissions.ask  = ((.permissions.ask  // []) + $ask  | unique) |
    .hooks = (.hooks // {}) |
    .hooks.PreToolUse = (.hooks.PreToolUse // []) |
    .hooks.PreToolUse = (
      if any(.hooks.PreToolUse[]?; (.hooks[]?.command // "") == $cmd)
      then .hooks.PreToolUse
      else .hooks.PreToolUse + [{matcher:"Bash",hooks:[{type:"command",command:$cmd}]}]
      end)
  ' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
  jq -e . "$FILE" >/dev/null && echo "  patched $FILE (backup alongside)"
}

# user (global) scope
USER_HOOK="$HOME/.claude/hooks/git-guard.sh"
mkdir -p "$HOME/.claude/hooks"
cp "$SRC" "$USER_HOOK"; chmod +x "$USER_HOOK"
echo "Installed guard → $USER_HOOK"
patch_settings "$HOME/.claude/settings.json" "\$HOME/.claude/hooks/git-guard.sh"

# optional project scope
if [ "${1:-}" = "--project" ]; then
  PROJ="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  mkdir -p "$PROJ/.claude/hooks"
  cp "$SRC" "$PROJ/.claude/hooks/git-guard.sh"; chmod +x "$PROJ/.claude/hooks/git-guard.sh"
  patch_settings "$PROJ/.claude/settings.json" "\${CLAUDE_PROJECT_DIR}/.claude/hooks/git-guard.sh"
fi

echo ""
echo "✅ git-guard wired. Restart Claude Code (or /hooks reload) to activate."
echo "   Destructive git is now denied; commit/push prompt for confirmation; protected branches are blocked."
