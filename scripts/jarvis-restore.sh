#!/usr/bin/env bash
# Recover work from J.A.R.V.I.S. autosave snapshots (refs/jarvis-snapshots/*).
# Snapshots are full working-tree commits (tracked + untracked) the daemon captured
# without ever touching your tree. Recovery is always non-destructive: it parks the
# snapshot on a branch you can inspect, cherry-pick, or `checkout -- <file>` from.
#
#   scripts/jarvis-restore.sh                 # list snapshots for the repo you're in
#   scripts/jarvis-restore.sh --diff <ref>    # diff a snapshot against your current tree
#   scripts/jarvis-restore.sh <ref>           # park the snapshot on a jarvis-restore/* branch
set -euo pipefail
REPO="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "Not inside a git repository." >&2; exit 1; }

list() {
  echo "Snapshots in $REPO:"
  git for-each-ref --sort=-refname \
    --format='  %(refname)   %(creatordate:relative)   %(contents:subject)' \
    refs/jarvis-snapshots || true
  [ -n "$(git for-each-ref refs/jarvis-snapshots)" ] || echo "  (none yet — the daemon snapshots only dirty repos)"
}

case "${1:-}" in
  ""|-l|--list) list ;;
  --diff) [ -n "${2:-}" ] || { echo "usage: --diff <ref>" >&2; exit 1; }; git --no-pager diff "$2" -- . ;;
  *)
    REF="$1"; SHA="$(git rev-parse --verify "$REF" 2>/dev/null || true)"
    [ -n "$SHA" ] || { echo "No such snapshot: $REF" >&2; list; exit 1; }
    BR="jarvis-restore/$(date +%s)-${SHA:0:7}"   # unique even on same-second restores
    git branch "$BR" "$SHA"
    echo "Parked snapshot on branch '$BR' (your working tree is untouched)."
    echo "Inspect:  git switch $BR        (or)  git checkout $BR -- <path/to/file>"
    echo "Discard:  git branch -D $BR"
    ;;
esac
