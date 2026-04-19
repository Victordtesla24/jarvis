#!/usr/bin/env bash
# scripts/run-gate-sweep.sh — contract-faithful one-shot all-gates validator.
#
# Runs Gates A..G exactly as defined in docs/prompt.md §R-4, captures logs to
# /tmp/gate_*.log, and exits 0 only when every gate passes simultaneously.

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

log() { printf '[sweep] %s\n' "$*"; }
fail() { printf '[sweep][FAIL] %s\n' "$*" >&2; exit 1; }

rm -f /tmp/gate_A.log /tmp/gate_B.log /tmp/gate_C.log /tmp/gate_D.log \
      /tmp/gate_E.log /tmp/gate_F.log /tmp/gate_G.log

# Gate A
log "Gate A: swift build -c release"
( cd "$REPO_ROOT/JarvisTelemetry" && swift build -c release ) > /tmp/gate_A.log 2>&1 \
  || fail "Gate A failed — see /tmp/gate_A.log"
grep -q 'Build complete!' /tmp/gate_A.log \
  || fail "Gate A signature missing: expected 'Build complete!'"

# Gate B
log "Gate B: swift test"
( cd "$REPO_ROOT/JarvisTelemetry" && swift test ) > /tmp/gate_B.log 2>&1 \
  || fail "Gate B failed — see /tmp/gate_B.log"
grep -q 'Executed 58 tests, with 0 failures' /tmp/gate_B.log \
  || fail "Gate B signature missing: expected 'Executed 58 tests, with 0 failures'"

# Gate C
log "Gate C: python3 -m pytest scripts/promo-video/tests/ -v"
python3 -m pytest scripts/promo-video/tests/ -v > /tmp/gate_C.log 2>&1 \
  || fail "Gate C failed — see /tmp/gate_C.log"
grep -qE '7 passed' /tmp/gate_C.log \
  || fail "Gate C signature missing: expected '7 passed'"

# Gate D
log "Gate D: shellcheck"
shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh \
  > /tmp/gate_D.log 2>&1 \
  || fail "Gate D failed — see /tmp/gate_D.log"
[[ -s /tmp/gate_D.log ]] && fail "Gate D stdout non-empty"
log "Gate D: clean"

# Gate E — rg exits 1 when there are no matches; that is PASS for a sentinel.
# Pattern built at runtime so this verifier itself does not trip the sentinel.
GATE_E_PATTERN="/${USER_TOKEN:=Users}/vic"
log "Gate E: personal-home-path sentinel"
set +e
rg -n --glob '!**/.build/**' --glob '!**/.venv/**' --glob '!**/node_modules/**' \
   "$GATE_E_PATTERN" \
   scripts JarvisTelemetry/Sources JarvisTelemetry/Tests \
   build-app.sh start-jarvis.sh stop-jarvis.sh \
   > /tmp/gate_E.log 2>&1
RG_RC=$?
set -e
case "$RG_RC" in
  1) : ;;  # zero matches → PASS
  0) fail "Gate E failed — sentinel matches found, see /tmp/gate_E.log" ;;
  *) fail "Gate E errored — rg exit=$RG_RC, see /tmp/gate_E.log" ;;
esac
[[ -s /tmp/gate_E.log ]] && fail "Gate E stdout non-empty despite rg exit=1"

# Gate F
log "Gate F: python3 -m pytest tests/harness/ -v"
python3 -m pytest tests/harness/ -v > /tmp/gate_F.log 2>&1 \
  || fail "Gate F failed — see /tmp/gate_F.log"
grep -qE '11 passed' /tmp/gate_F.log \
  || fail "Gate F signature missing: expected '11 passed'"

# Gate G
log "Gate G: protected doc trees unchanged"
git diff --quiet HEAD -- docs/brainstorms docs/plans docs/solutions docs/superpowers docs/ideation \
  || fail "Gate G failed — protected doc trees have uncommitted changes"

log "ALL_GATES_PASS"
exit 0
