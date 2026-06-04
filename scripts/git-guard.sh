#!/usr/bin/env bash
# git-guard.sh — deterministic PreToolUse boundary for J.A.R.V.I.S. git management.
#
# Wire this as a Claude Code PreToolUse(Bash) hook (see scripts/install-git-guard.sh
# or docs/jarvis-git-management/README.md). Permission patterns are fragile (a reordered
# flag or `git -C <path>` slips a naive glob); this hook sees the FULL command string and
# fires even when a pattern would miss. Exit 0 = continue to the normal permission flow.
# Exit 2 = BLOCK (stderr is shown to the agent). It is intentionally narrow: it stops
# work-destroying commands and commits/pushes onto protected branches, then gets out of
# the way. Keep it < 500 ms — it gates every Bash call.
set -euo pipefail

# Read the tool-call JSON from stdin and extract the bash command (jq → python → raw).
INPUT="$(cat 2>/dev/null || true)"
extract() {
  if command -v jq >/dev/null 2>&1; then printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null && return; fi
  if command -v python3 >/dev/null 2>&1; then printf '%s' "$INPUT" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception: print("")' 2>/dev/null && return; fi
  printf '%s' "$INPUT"
}
CMD="$(extract)"
[ -n "$CMD" ] || exit 0

block() { echo "BLOCKED by git-guard: $1" >&2; exit 2; }

printf '%s' "$CMD" | grep -Eq 'git[[:space:]].*push[[:space:]].*(--force([^-]|$)|--force-with-lease|-f([[:space:]]|$))' \
  && block "force-push is forbidden — open a PR (override deliberately by hand if truly needed)"
printf '%s' "$CMD" | grep -Eq 'git[[:space:]].*reset[[:space:]]+--hard'            && block "git reset --hard destroys uncommitted work"
printf '%s' "$CMD" | grep -Eq 'git[[:space:]].*clean[[:space:]]+-[a-zA-Z]*[fd]'    && block "git clean deletes untracked files irreversibly"
printf '%s' "$CMD" | grep -Eq 'git[[:space:]].*checkout[[:space:]]+--[[:space:]]+\.|git[[:space:]].*checkout[[:space:]]+--force' && block "checkout -- . discards local changes"
printf '%s' "$CMD" | grep -Eq 'git[[:space:]].*stash[[:space:]]+(drop|clear)'      && block "stash drop/clear is irreversible — park work on a branch instead"
printf '%s' "$CMD" | grep -Eq 'git[[:space:]].*branch[[:space:]]+-D'               && block "force-deleting a branch can orphan commits — use -d or park it first"

# Branch guard: never commit/push on a protected branch — branch first.
if printf '%s' "$CMD" | grep -Eq 'git[[:space:]].*(commit|push)([[:space:]]|$)'; then
  BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  case "$BR" in
    main|master|develop|release/*|prod|production)
      block "refusing to commit/push on protected branch '$BR' — branch first: git switch -c <type>/<name>" ;;
  esac
fi
exit 0
