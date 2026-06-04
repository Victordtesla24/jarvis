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

# Strip quoted substrings so destructive phrases inside arguments (e.g. a commit message
# `-m "fix git reset --hard bug"`) don't trip the guards — only real command tokens remain.
SCAN="$(printf '%s' "$CMD" | sed -e "s/'[^']*'//g" -e 's/"[^"]*"//g')"

block() { echo "BLOCKED by git-guard: $1" >&2; exit 2; }
m() { printf '%s' "$SCAN" | grep -Eq "$1"; }

# ── destructive / history- and work-erasing forms ────────────────────────────
# Push forms — detect the subcommand first, then scan flags on the full string (so a
# single space between `push` and `-f`/`+ref` isn't consumed by the subcommand match).
if m 'git[[:space:]].*push([[:space:]]|$)'; then
  m '(--force|--force-with-lease|[[:space:]]-[A-Za-z]*f)' && block "force-push is forbidden — open a PR"
  m '[[:space:]]\+[^[:space:]]'                           && block "force-push via +refspec is forbidden — open a PR"
  m '(--mirror|--prune|--delete([[:space:]]|$)|[[:space:]]-d([[:space:]]|$))' && block "push --mirror/--prune/--delete can erase remote refs"
fi
# Discard-working-tree forms (checkout/restore of '.') — same two-step.
if m 'git[[:space:]].*(checkout|restore)([[:space:]]|$)'; then
  m '(--force|[[:space:]]--[[:space:]]+\.|[[:space:]]\.([[:space:]]|$))' && block "discarding local changes (checkout/restore .) is irreversible"
fi
m 'git[[:space:]].*reset[[:space:]].*--hard'   && block "git reset --hard destroys uncommitted work"
m 'git[[:space:]].*clean[[:space:]].*(--force|-[A-Za-z]*[fd])' && block "git clean deletes untracked files irreversibly"
m 'git[[:space:]].*stash[[:space:]].*(drop|clear)' && block "stash drop/clear is irreversible — park work on a branch instead"
m 'git[[:space:]].*branch[[:space:]].*-D'      && block "force-deleting a branch can orphan commits — use -d or park it first"
m 'git[[:space:]].*reflog[[:space:]].*(expire|delete)' && block "reflog expire/delete removes your recovery safety net"
m 'git[[:space:]].*update-ref[[:space:]].*-d'  && block "update-ref -d can orphan commits"

# ── branch guard: never commit/push on a protected branch — branch first ──────
if m 'git[[:space:]].*(commit|push)([[:space:]]|$)'; then
  BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  case "$BR" in
    main|master|develop|release/*|prod|production)
      block "refusing to commit/push on protected branch '$BR' — branch first: git switch -c <type>/<name>" ;;
  esac
fi
exit 0
