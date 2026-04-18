#!/usr/bin/env zsh
# tests/bootstrap.sh — local, user-scoped environment check for the JARVIS validation harness.
#
# Scope: verify required CLI tools exist, install Python deps into a repo-local venv,
# and load ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY from
# tests/api_keys.env (preferred) or ~/.jarvis/.env (fallback). Does NOT touch
# Claude Desktop config, does NOT run npm -g, does NOT run system-wide pip install.

set -eu
set -o pipefail

REPO_ROOT="${REPO_ROOT:-/Users/vic/claude/General-Work/jarvis/jarvis-build}"
cd "$REPO_ROOT"

VENV_DIR="$REPO_ROOT/tests/.venv"
API_KEYS_FILE="$REPO_ROOT/tests/api_keys.env"
ENV_FILE="${HOME}/.jarvis/.env"

log() { printf "[bootstrap] %s\n" "$*"; }
die() { printf "[bootstrap][FATAL] %s\n" "$*" >&2; exit 1; }

log "Repo: $REPO_ROOT"

# ---- 1. Load env ------------------------------------------------------------
# Priority: tests/api_keys.env (current session keys) > ~/.jarvis/.env
if [[ -f "$API_KEYS_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$API_KEYS_FILE"
  set +a
  log "Loaded $API_KEYS_FILE"
fi
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  log "Loaded $ENV_FILE"
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  log "WARNING: ANTHROPIC_API_KEY is empty — panel vision tests will be deferred"
fi

# ---- 2. CLI tool checks -----------------------------------------------------
REQUIRED_TOOLS=(go swift ffmpeg python3 jq xcrun)
MISSING=()
for tool in "${REQUIRED_TOOLS[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    log "OK    $tool -> $(command -v "$tool")"
  else
    MISSING+=("$tool")
  fi
done
if (( ${#MISSING[@]} > 0 )); then
  die "Missing required tools: ${MISSING[*]}. Install with Homebrew, then re-run."
fi

# ---- 3. Python venv ---------------------------------------------------------
if [[ ! -d "$VENV_DIR" ]]; then
  log "Creating Python venv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
log "Venv active: $(python3 -c 'import sys; print(sys.executable)')"

python3 -m pip install --quiet --upgrade pip
python3 -m pip install --quiet \
  "anthropic>=0.40" \
  "openai>=1.50" \
  "python-dotenv>=1.0" \
  "requests>=2.31" \
  "Pillow>=10.0" \
  "numpy>=1.26" \
  "pyobjc-framework-Quartz>=10.0" \
  "pyobjc-framework-Cocoa>=10.0"
log "Python deps installed"

# ---- 4. macOS permission reminders -----------------------------------------
log "Reminder: screen recording permission must be granted to the terminal running this script."
log "         System Settings → Privacy & Security → Screen & System Audio Recording."
log "         IOKit/SMC sensor reads in JarvisTelemetry require sudo at launch."

log "Bootstrap complete."
