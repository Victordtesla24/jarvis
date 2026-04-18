#!/usr/bin/env zsh
# tests/run_validation.sh — ONE-SHOT validation orchestrator.
#
# Pipeline:  bootstrap -> build_and_launch -> visual_capture -> generate_evidence -> stop
#
# This script:
#   • does NOT loop on failure
#   • does NOT git commit, push, or open a PR
#   • does NOT install anything globally
#   • does NOT modify Claude Desktop config
#
# Prerequisite: run `sudo -v` in this terminal first so sudo credentials are cached.

set -eu
set -o pipefail

REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
cd "$REPO_ROOT"
export REPO_ROOT

# Force unbuffered output so [PASS]/[FAIL] progress is visible during the
# vision phase instead of arriving only when the process exits.
export PYTHONUNBUFFERED=1

TESTS_DIR="$REPO_ROOT/tests"
VENV_DIR="$TESTS_DIR/.venv"

log() { printf "[run] %s\n" "$*"; }
die() { printf "[run][FATAL] %s\n" "$*" >&2; exit 1; }

trap 'log "trap: stopping JarvisTelemetry"; "$TESTS_DIR/stop_jarvis.sh" || true' EXIT

# ---- 1. bootstrap -----------------------------------------------------------
log "Step 1: bootstrap"
"$TESTS_DIR/bootstrap.sh"

# Re-source env so downstream Python sees ANTHROPIC_API_KEY / OPENAI_API_KEY.
# Priority: tests/api_keys.env (current session) > ~/.jarvis/.env (fallback).
set -a
# shellcheck disable=SC1091
[[ -f "$TESTS_DIR/api_keys.env" ]] && source "$TESTS_DIR/api_keys.env"
# shellcheck disable=SC1091
[[ -f "$HOME/.jarvis/.env" ]] && source "$HOME/.jarvis/.env"
set +a

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# ---- 2. build + launch ------------------------------------------------------
log "Step 2: build & launch JarvisTelemetry"
"$TESTS_DIR/build_and_launch.sh"

# ---- 3. visual capture + checks --------------------------------------------
log "Step 3: visual_capture.py"
set +e
python3 "$TESTS_DIR/visual_capture.py"
CAPTURE_RC=$?
set -e
log "visual_capture exited with rc=$CAPTURE_RC"

# ---- 4. evidence video ------------------------------------------------------
log "Step 4: generate_evidence.py"
python3 "$TESTS_DIR/generate_evidence.py" || log "evidence generation failed (non-fatal)"

# ---- 5. stop ----------------------------------------------------------------
log "Step 5: stop (trap will also run)"
"$TESTS_DIR/stop_jarvis.sh" || true

log "============================================================"
log "DONE. Report: tests/output/REPORT.md"
log "      JSON:   tests/output/analysis.json"
log "      Video:  tests/output/jarvis_evidence.mp4 (if produced)"
log "============================================================"

exit "$CAPTURE_RC"
