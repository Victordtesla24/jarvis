# Jarvis One-Sweep Remediation Checklist

Execution-ordered remediation that moves the working tree from current state to simultaneous PASS on Gates A..G and the full R-1..R-5 output contract from `docs/prompt.md`.

## Preflight · P-0 Environment bootstrap

### Step P-0.1 — Verify platform toolchain availability

- **Requirement IDs:** R-1, R-5, §4.3
- **Target files:** none (diagnostic)
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  sw_vers -productVersion
  uname -m
  swift --version | head -1
  go version
  python3 --version
  ffmpeg -version | head -1
  rg --version | head -1
  git --version
  ```
- **Expected PASS evidence:** macOS `15.*` or newer, arch `arm64`, `Swift 5.10+`, `go1.21+`, `Python 3.12+`, `ffmpeg 6+`, `ripgrep`, `git`. Every command prints a version line on stdout with exit 0.
- **Failure triage action:** If any tool is missing, abort; invoke Step P-0.3 (blocked-tool bootstrap) before proceeding.

### Step P-0.2 — Install shellcheck if absent

- **Requirement IDs:** R-4.5 (Gate D), §4.3
- **Target files:** system (`/opt/homebrew/bin/shellcheck`)
- **Exact change set:** none
- **Commands to run:**
  ```bash
  command -v shellcheck >/dev/null 2>&1 || brew install shellcheck
  shellcheck --version | awk 'NR==2{print $2}'
  ```
- **Expected PASS evidence:** version `0.11.0` or newer on stdout, exit 0.
- **Failure triage action:** If `brew` is unavailable, install Homebrew, then retry this step.

### Step P-0.3 — Provision isolated pytest venv for promo-video gate

- **Requirement IDs:** R-4.3 (Gate C), §4.3
- **Target files:** `scripts/promo-video/.venv/` (gitignored)
- **Exact change set:** create virtualenv, install pytest pinned in venv only.
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  python3 -m venv scripts/promo-video/.venv
  scripts/promo-video/.venv/bin/pip install --upgrade pip
  scripts/promo-video/.venv/bin/pip install pytest==9.0.3
  scripts/promo-video/.venv/bin/pytest --version
  ```
- **Expected PASS evidence:** `pytest 9.0.3` printed, exit 0. Directory `scripts/promo-video/.venv/bin/pytest` exists and is executable.
- **Failure triage action:** Delete `scripts/promo-video/.venv/` and re-run; if it still fails, check `python3 -m ensurepip` and re-run.

### Step P-0.4 — Ensure Go daemon binary is present for Swift Resources bundling

- **Requirement IDs:** R-4.1 (Gate A prerequisite), C-3 (CGO), C-4 (daemon bundled)
- **Target files:** `JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon`
- **Exact change set:** rebuild Go daemon if missing or older than any `mactop/internal/app/*.go`.
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build/mactop
  go build -o ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon .
  file ../JarvisTelemetry/Sources/JarvisTelemetry/Resources/jarvis-mactop-daemon | grep -q 'Mach-O 64-bit executable arm64'
  ```
- **Expected PASS evidence:** grep exits 0, binary is `Mach-O 64-bit executable arm64`.
- **Failure triage action:** If CGO errors, ensure Xcode CLT is installed (`xcode-select --install`), then retry.

## Gap Closure · P-1 Gate D (shellcheck) remediation

### Step P-1.1 — Remove dead zsh fallback in `scripts/_paths.sh`

- **Requirement IDs:** R-3.1, R-3.2, R-4.5, SC-1
- **Target files:** `scripts/_paths.sh`
- **Exact change set:** replace line 14 `__JARVIS_PATHS_SELF="${BASH_SOURCE[0]:-${(%):-%x}}"` with `__JARVIS_PATHS_SELF="${BASH_SOURCE[0]:-$0}"`. The file declares `#!/usr/bin/env bash` so the zsh-only `${(%):-%x}` parameter expansion is unreachable and triggers SC2296.
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  /usr/bin/sed -i '' 's|"${BASH_SOURCE\[0\]:-\${(%):-%x}}"|"${BASH_SOURCE[0]:-$0}"|' scripts/_paths.sh
  shellcheck scripts/_paths.sh
  ```
- **Expected PASS evidence:** `shellcheck scripts/_paths.sh` exits 0 with no stdout.
- **Failure triage action:** If SC2128 reappears, keep the `# shellcheck disable=SC2128` directive above the assignment. If any other error surfaces, inspect with `shellcheck -S error scripts/_paths.sh` and resolve in-file.

### Step P-1.2 — Switch shebang of `scripts/promo-video/assemble.sh` to bash

- **Requirement IDs:** R-3.1, R-3.2, R-4.5, SC-1
- **Target files:** `scripts/promo-video/assemble.sh`
- **Exact change set:** replace line 1 `#!/usr/bin/env zsh` with `#!/usr/bin/env bash`. The script is bash-compatible (only ffmpeg filter literals contain escaped commas, not zsh syntax).
- **Commands to run:**
  ```bash
  /usr/bin/sed -i '' '1s|^#!/usr/bin/env zsh$|#!/usr/bin/env bash|' scripts/promo-video/assemble.sh
  head -1 scripts/promo-video/assemble.sh
  shellcheck scripts/promo-video/assemble.sh
  ```
- **Expected PASS evidence:** line 1 reads `#!/usr/bin/env bash`; `shellcheck` exits 0 with no output.
- **Failure triage action:** If bash parser errors appear, revert line 1 and add `# shellcheck shell=bash` on line 2, then retry.

### Step P-1.3 — Switch shebang of `scripts/promo-video/pick_music.sh` to bash

- **Requirement IDs:** R-3.1, R-3.2, R-4.5, SC-1
- **Target files:** `scripts/promo-video/pick_music.sh`
- **Exact change set:** replace line 1 `#!/usr/bin/env zsh` with `#!/usr/bin/env bash`.
- **Commands to run:**
  ```bash
  /usr/bin/sed -i '' '1s|^#!/usr/bin/env zsh$|#!/usr/bin/env bash|' scripts/promo-video/pick_music.sh
  head -1 scripts/promo-video/pick_music.sh
  shellcheck scripts/promo-video/pick_music.sh
  ```
- **Expected PASS evidence:** line 1 reads `#!/usr/bin/env bash`; `shellcheck` exits 0 with no output.
- **Failure triage action:** Same fallback as P-1.2.

### Step P-1.4 — Switch shebang of `scripts/promo-video/run.sh` to bash

- **Requirement IDs:** R-3.1, R-3.2, R-4.5, SC-1
- **Target files:** `scripts/promo-video/run.sh`
- **Exact change set:** replace line 1 `#!/usr/bin/env zsh` with `#!/usr/bin/env bash`.
- **Commands to run:**
  ```bash
  /usr/bin/sed -i '' '1s|^#!/usr/bin/env zsh$|#!/usr/bin/env bash|' scripts/promo-video/run.sh
  head -1 scripts/promo-video/run.sh
  shellcheck scripts/promo-video/run.sh
  ```
- **Expected PASS evidence:** line 1 reads `#!/usr/bin/env bash`; `shellcheck` exits 0 with no output.
- **Failure triage action:** Same fallback as P-1.2.

### Step P-1.5 — Silence SC2034 on unused loop variable in `start-jarvis.sh`

- **Requirement IDs:** R-3.1, R-4.5, SC-1
- **Target files:** `start-jarvis.sh`
- **Exact change set:** rename loop variable `i` to `_` on line 27: `for _ in $(seq 1 10); do`.
- **Commands to run:**
  ```bash
  /usr/bin/sed -i '' 's|for i in \$(seq 1 10)|for _ in $(seq 1 10)|' start-jarvis.sh
  shellcheck start-jarvis.sh
  ```
- **Expected PASS evidence:** `shellcheck` exits 0 with no output; `grep -n 'for _ in' start-jarvis.sh` prints exactly `27:    for _ in $(seq 1 10); do`.
- **Failure triage action:** If the sed pattern misses due to quoting, edit line 27 manually to `for _ in $(seq 1 10); do` and re-run shellcheck.

### Step P-1.6 — Collapse SC2129 multi-redirect in `build-app.sh`

- **Requirement IDs:** R-3.1, R-4.5, SC-1
- **Target files:** `build-app.sh`
- **Exact change set:** wrap the contiguous `printf ... >> "$INFO"` block in `{ ... } > "$INFO"`, dropping the `>>` appends. Open the file, locate the first `printf '<?xml ... \n' > "$INFO"`, convert every subsequent `printf ... >> "$INFO"` line in that block to `printf ...` (no redirect), and close with `} > "$INFO"` on the line immediately after the final `printf '</plist>\n'`.
- **Commands to run:**
  ```bash
  shellcheck build-app.sh
  ```
- **Expected PASS evidence:** `shellcheck build-app.sh` exits 0 with no output.
- **Failure triage action:** If SC2129 persists, inspect the exact line numbers it points to, then apply the `{ ...; } > "$INFO"` grouping manually; rerun `shellcheck build-app.sh`.

### Step P-1.7a — Fix SC2193 broken test expression in `scripts/promo-video/assemble.sh`

- **Requirement IDs:** R-3.1, R-4.5, SC-1
- **Target files:** `scripts/promo-video/assemble.sh`
- **Exact change set:** replace `[[ "$VO_FILE_COUNT_SKIP:-" == "" ]] || true  # allow tests to override` with `[[ -z "${VO_FILE_COUNT_SKIP:-}" ]] || true  # allow tests to override`. The original typo placed the `:-` outside the braces, producing a literal suffix that can never equal the empty string.
- **Commands to run:**
  ```bash
  shellcheck scripts/promo-video/assemble.sh
  ```
- **Expected PASS evidence:** no SC2193 line; `shellcheck` exits 0.
- **Failure triage action:** If the sed variant doesn't land, edit the line manually to match the new form and rerun.

### Step P-1.7b — Replace SC2001 sed pipeline with parameter expansion in `scripts/promo-video/assemble.sh`

- **Requirement IDs:** R-3.1, R-4.5, SC-1
- **Target files:** `scripts/promo-video/assemble.sh`
- **Exact change set:** replace `echo "$probe" | sed 's/^/  /' >&2` with `printf '%s\n' "${probe//$'\n'/$'\n'  }" | sed -n '1,$p' >&2`, preserving the two-space indent on each probe line.
- **Commands to run:**
  ```bash
  shellcheck scripts/promo-video/assemble.sh
  ```
- **Expected PASS evidence:** no SC2001 line; `shellcheck` exits 0.
- **Failure triage action:** Validate indent behavior on a sample probe string (e.g., `probe=$'width=2560\nheight=1440'; printf '%s\n' "${probe//$'\n'/$'\n'  }"`). Fix until output matches expected two-space indent.

### Step P-1.7c — Replace SC2012 `ls` parse with `find` + `stat` in `scripts/promo-video/run.sh`

- **Requirement IDs:** R-3.1, R-4.5, SC-1
- **Target files:** `scripts/promo-video/run.sh`
- **Exact change set:** replace `FINAL_PATH=$(ls -1t "$REPO_ROOT"/promo/JARVIS_PROMO_v*.mp4 2>/dev/null | head -1)` with `FINAL_PATH=$(find "$REPO_ROOT/promo" -maxdepth 1 -type f -name 'JARVIS_PROMO_v*.mp4' -print0 2>/dev/null | xargs -0 stat -f '%m %N' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)`.
- **Commands to run:**
  ```bash
  shellcheck scripts/promo-video/run.sh
  ```
- **Expected PASS evidence:** no SC2012 line; `shellcheck` exits 0.
- **Failure triage action:** If `stat` flags differ (e.g., GNU), swap the format spec to `stat --format '%Y %n'`. Re-run shellcheck.

### Step P-1.7d — Silence SC1091 info on `_paths.sh` source lines

- **Requirement IDs:** R-3.1, R-4.5, SC-1
- **Target files:** `scripts/deploy.sh` (line 16), `scripts/verify-reactive.sh` (line 18)
- **Exact change set:** on each file, replace `# shellcheck source=./_paths.sh` immediately above the `. "$(cd ...)/_paths.sh"` line with `# shellcheck source=./_paths.sh disable=SC1091`. The `source=` directive is retained so editors and `shellcheck -x` still resolve the path.
- **Commands to run:**
  ```bash
  shellcheck scripts/deploy.sh scripts/verify-reactive.sh
  ```
- **Expected PASS evidence:** `shellcheck` exits 0 with no output on both files.
- **Failure triage action:** If SC1091 reappears, the directive comment has drifted off the line immediately above the source line; restore adjacency.

### Step P-1.8 — Confirm full Gate D sweep is clean

- **Requirement IDs:** R-4.5, SC-2, SC-5
- **Target files:** none (verification)
- **Exact change set:** none
- **Commands to run:**
  ```bash
  shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh
  echo "shellcheck_exit=$?"
  ```
- **Expected PASS evidence:** `shellcheck_exit=0` on stdout, and no SC* lines printed.
- **Failure triage action:** For each remaining finding, return to the owning P-1.* step and re-apply; if a new finding appears, add a step P-1.9+ scoped to that file and rerun this verification.

## Gap Closure · P-2 Gate E (path sentinel)

### Step P-2.1 — Assert no hardcoded user paths in scoped files

- **Requirement IDs:** R-4.5, §4.5
- **Target files:** `scripts/**`, `JarvisTelemetry/Sources/**`, `JarvisTelemetry/Tests/**`, `build-app.sh`, `start-jarvis.sh`, `stop-jarvis.sh`
- **Exact change set:** none if clean; otherwise replace each `/Users/*` literal with an env-var-driven path sourced from `scripts/_paths.sh`.
- **Commands to run:**
  ```bash
  rg -n --hidden --glob '!**/.build/**' --glob '!**/.venv/**' --glob '!**/node_modules/**' \
     '/Users/[a-zA-Z0-9_]+' \
     scripts JarvisTelemetry/Sources JarvisTelemetry/Tests build-app.sh start-jarvis.sh stop-jarvis.sh \
     > /tmp/path_sentinel.txt
  test ! -s /tmp/path_sentinel.txt
  echo "path_sentinel_exit=$?"
  ```
- **Expected PASS evidence:** `/tmp/path_sentinel.txt` is empty; `path_sentinel_exit=0`.
- **Failure triage action:** For each hit, replace with `${JARVIS_REPO_ROOT:?}` derived from `scripts/_paths.sh`, then re-run this step.

## Gap Closure · P-3 Gate F (visual regression harness)

### Step P-3.1 — Activate tests venv for visual harness

- **Requirement IDs:** R-4.6 (Gate F), §4.3
- **Target files:** `tests/.venv/`
- **Exact change set:** rebuild the venv if `tests/.venv/bin/python3` lacks executable bit or is a broken symlink.
- **Commands to run:**
  ```bash
  if ! /usr/bin/test -x tests/.venv/bin/python3 || ! tests/.venv/bin/python3 -c 'import sys' >/dev/null 2>&1; then
    rm -rf tests/.venv
    python3 -m venv tests/.venv
    tests/.venv/bin/pip install --upgrade pip
    tests/.venv/bin/pip install pytest playwright httpx openai
  fi
  tests/.venv/bin/python3 --version
  ```
- **Expected PASS evidence:** `tests/.venv/bin/python3 --version` prints a `Python 3.*` line with exit 0.
- **Failure triage action:** If `pip install` fails, run with `--no-cache-dir`; if playwright fails on browser download, skip `playwright install` — the visual harness only needs the Python module imported.

### Step P-3.2 — Dry-run the visual harness (no launch, schema-only)

- **Requirement IDs:** R-4.6, SC-2
- **Target files:** `tests/visual_capture.py`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  tests/.venv/bin/python3 -c "import importlib.util, sys; \
    spec = importlib.util.spec_from_file_location('vc', 'tests/visual_capture.py'); \
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); \
    print('vc_module_ok')"
  ```
- **Expected PASS evidence:** stdout contains `vc_module_ok` with exit 0 — module imports cleanly, signaling the harness is syntactically runnable.
- **Failure triage action:** If the import fails with `ModuleNotFoundError`, install the missing module into `tests/.venv` and retry.

### Step P-3.3 — Register Gate F harness entrypoint for the final sweep

- **Requirement IDs:** R-4.6, SC-5
- **Target files:** `tests/run_validation.sh` (no edit — confirm it exists, is executable, and has `#!/usr/bin/env bash` or bash-compatible shebang).
- **Exact change set:** if shebang is `zsh`, replace with `bash` per P-1.* pattern.
- **Commands to run:**
  ```bash
  head -1 tests/run_validation.sh
  /usr/bin/test -x tests/run_validation.sh && echo "run_validation_executable=1"
  ```
- **Expected PASS evidence:** shebang is a `bash` shebang and `run_validation_executable=1` is printed.
- **Failure triage action:** If non-executable, run `chmod +x tests/run_validation.sh`; if the shebang is `zsh` and the script is bash-compatible, swap per P-1.2 pattern.

## Gap Closure · P-4 Gate G (protected docs unchanged)

### Step P-4.1 — Assert protected documentation tree is untouched

- **Requirement IDs:** R-5.2, R-4.7
- **Target files:** `docs/JARVIS-SYSTEM-PROMPT.md`, `docs/JARVIS-TELEMETRY-PROMPT.md`, `docs/JarvisOS-Agent-Plan.md`, `docs/macOS_Telemetry_App.md`
- **Exact change set:** none — this is a negative-space guard.
- **Commands to run:**
  ```bash
  git diff --quiet HEAD -- \
     docs/JARVIS-SYSTEM-PROMPT.md \
     docs/JARVIS-TELEMETRY-PROMPT.md \
     docs/JarvisOS-Agent-Plan.md \
     docs/macOS_Telemetry_App.md
  echo "protected_docs_exit=$?"
  ```
- **Expected PASS evidence:** `protected_docs_exit=0` (no diff).
- **Failure triage action:** If non-zero, run `git checkout -- <file>` to restore, then re-run; escalate via approval checkpoint before any overwrite that affects a protected doc.

## Approval Checkpoint · P-5

### Step P-5.1 — Gated-auto approval gate for shebang swaps

- **Requirement IDs:** R-5.4
- **Target files:** `scripts/_paths.sh`, `scripts/promo-video/assemble.sh`, `scripts/promo-video/pick_music.sh`, `scripts/promo-video/run.sh`, `start-jarvis.sh`, `build-app.sh`
- **Exact change set:** none (review diff only)
- **Commands to run:**
  ```bash
  git diff --stat scripts/_paths.sh scripts/promo-video/assemble.sh scripts/promo-video/pick_music.sh scripts/promo-video/run.sh start-jarvis.sh build-app.sh
  git diff scripts/_paths.sh scripts/promo-video/assemble.sh scripts/promo-video/pick_music.sh scripts/promo-video/run.sh start-jarvis.sh build-app.sh | head -120
  ```
- **Expected PASS evidence:** diff touches only lines 1 (shebang) in zsh scripts, line 14 in `_paths.sh`, line 27 in `start-jarvis.sh`, and the plist-printf block in `build-app.sh`. No unrelated churn.
- **Failure triage action:** If diff shows out-of-scope churn, `git checkout -p` to revert non-authorized edits and re-enter the owning P-1.* step.

## Targeted Verification · P-6 Per-gate validation command set

### Step P-6.A — Gate A re-validation (Swift release build)

- **Requirement IDs:** R-4.1, SC-2, SC-5
- **Target files:** entire `JarvisTelemetry` package
- **Exact change set:** none (verify only)
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build/JarvisTelemetry
  swift build -c release 2>&1 | tee /tmp/gate_A.log
  echo "gate_A_exit=${PIPESTATUS[0]}"
  ```
- **Expected PASS evidence:** `gate_A_exit=0`; `/tmp/gate_A.log` ends with `Build complete!`.
- **Failure triage action:** Re-run from `mactop/` Go daemon build (P-0.4); if Swift errors persist, inspect `/tmp/gate_A.log` and fix in `JarvisTelemetry/Sources/`.

### Step P-6.B — Gate B re-validation (Swift tests)

- **Requirement IDs:** R-4.2, SC-2, SC-5
- **Target files:** `JarvisTelemetry/Tests/`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build/JarvisTelemetry
  swift test 2>&1 | tee /tmp/gate_B.log
  echo "gate_B_exit=${PIPESTATUS[0]}"
  ```
- **Expected PASS evidence:** `gate_B_exit=0`; `/tmp/gate_B.log` ends with `Executed N tests, with 0 failures` where N ≥ 58.
- **Failure triage action:** On any red test, open the failing case in `JarvisTelemetry/Tests/JarvisTelemetryTests/` and fix; do not mask with `@available` or skip flags.

### Step P-6.C — Gate C re-validation (promo-video pytest)

- **Requirement IDs:** R-4.3, SC-2, SC-5
- **Target files:** `scripts/promo-video/tests/`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  scripts/promo-video/.venv/bin/pytest scripts/promo-video/tests/ -v 2>&1 | tee /tmp/gate_C.log
  echo "gate_C_exit=${PIPESTATUS[0]}"
  ```
- **Expected PASS evidence:** `gate_C_exit=0`; log ends with `N passed` where N ≥ 7.
- **Failure triage action:** If `ModuleNotFoundError` for `shot_list_loader`, confirm `scripts/promo-video/lib/__init__.py` exists and `conftest.py` inserts `lib/` on `sys.path`; rerun.

### Step P-6.D — Gate D re-validation (shellcheck)

- **Requirement IDs:** R-4.5, SC-2, SC-5
- **Target files:** `scripts/*.sh`, `scripts/promo-video/*.sh`, `build-app.sh`, `start-jarvis.sh`, `stop-jarvis.sh`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh 2>&1 | tee /tmp/gate_D.log
  echo "gate_D_exit=${PIPESTATUS[0]}"
  ```
- **Expected PASS evidence:** `gate_D_exit=0`; `/tmp/gate_D.log` contains no `SC` lines.
- **Failure triage action:** For each residual SC, return to the step in P-1.* that owns the file and re-apply; then rerun.

### Step P-6.E — Gate E re-validation (path sentinel)

- **Requirement IDs:** R-4.5, §4.5, SC-2, SC-5
- **Target files:** scoped by `rg` args
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  rg -n --glob '!**/.build/**' --glob '!**/.venv/**' --glob '!**/node_modules/**' \
     '/Users/[a-zA-Z0-9_]+' \
     scripts JarvisTelemetry/Sources JarvisTelemetry/Tests build-app.sh start-jarvis.sh stop-jarvis.sh \
     > /tmp/gate_E.log
  /usr/bin/test ! -s /tmp/gate_E.log
  echo "gate_E_exit=$?"
  ```
- **Expected PASS evidence:** `gate_E_exit=0`; `/tmp/gate_E.log` is empty.
- **Failure triage action:** Replace each match with `${JARVIS_REPO_ROOT}/...`, then rerun.

### Step P-6.F — Gate F re-validation (visual harness dry-run)

- **Requirement IDs:** R-4.6, SC-2, SC-5
- **Target files:** `tests/visual_capture.py`, `tests/run_validation.sh`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  tests/.venv/bin/python3 -c "import importlib.util; \
    spec=importlib.util.spec_from_file_location('vc','tests/visual_capture.py'); \
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); print('ok')" \
    > /tmp/gate_F.log 2>&1
  grep -q '^ok$' /tmp/gate_F.log
  echo "gate_F_exit=$?"
  ```
- **Expected PASS evidence:** `gate_F_exit=0`; log ends with `ok`.
- **Failure triage action:** If import fails, install the named missing module into `tests/.venv` and rerun. Full-display capture run (`tests/run_validation.sh`) is an extended validation — execute only under explicit user approval since it opens GUI windows and may require `sudo -v`.

### Step P-6.G — Gate G re-validation (protected docs unchanged)

- **Requirement IDs:** R-5.2, SC-2, SC-5
- **Target files:** the four protected docs from P-4.1
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  git diff --quiet HEAD -- \
    docs/JARVIS-SYSTEM-PROMPT.md \
    docs/JARVIS-TELEMETRY-PROMPT.md \
    docs/JarvisOS-Agent-Plan.md \
    docs/macOS_Telemetry_App.md
  echo "gate_G_exit=$?"
  ```
- **Expected PASS evidence:** `gate_G_exit=0`.
- **Failure triage action:** Restore the changed doc with `git checkout -- <file>`; rerun.

## Atomic Full Sweep · P-7 One-shot gates-bundle

### Step P-7.1 — Execute all gates A..G in a single deterministic run

- **Requirement IDs:** R-4 (all), SC-5
- **Target files:** none (bundle)
- **Exact change set:** none
- **Commands to run:**
  ```bash
  set -eu
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build

  # Gate A
  ( cd JarvisTelemetry && swift build -c release ) > /tmp/gate_A.log 2>&1
  echo "gate_A=$?"

  # Gate B
  ( cd JarvisTelemetry && swift test ) > /tmp/gate_B.log 2>&1
  echo "gate_B=$?"

  # Gate C
  scripts/promo-video/.venv/bin/pytest scripts/promo-video/tests/ -v > /tmp/gate_C.log 2>&1
  echo "gate_C=$?"

  # Gate D
  shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh > /tmp/gate_D.log 2>&1
  echo "gate_D=$?"

  # Gate E
  rg -n --glob '!**/.build/**' --glob '!**/.venv/**' --glob '!**/node_modules/**' \
     '/Users/[a-zA-Z0-9_]+' \
     scripts JarvisTelemetry/Sources JarvisTelemetry/Tests \
     build-app.sh start-jarvis.sh stop-jarvis.sh > /tmp/gate_E.log || true
  /usr/bin/test ! -s /tmp/gate_E.log
  echo "gate_E=$?"

  # Gate F
  tests/.venv/bin/python3 -c "import importlib.util; \
    spec=importlib.util.spec_from_file_location('vc','tests/visual_capture.py'); \
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); print('ok')" \
    > /tmp/gate_F.log 2>&1
  grep -q '^ok$' /tmp/gate_F.log
  echo "gate_F=$?"

  # Gate G
  git diff --quiet HEAD -- \
    docs/JARVIS-SYSTEM-PROMPT.md \
    docs/JARVIS-TELEMETRY-PROMPT.md \
    docs/JarvisOS-Agent-Plan.md \
    docs/macOS_Telemetry_App.md
  echo "gate_G=$?"
  ```
- **Expected PASS evidence:** every `gate_X=0` line on stdout, and each `/tmp/gate_*.log` matches the per-gate signatures in P-6.A..G.
- **Failure triage action:** First non-zero gate halts the sweep; return to its P-6.X step, remediate its root cause, then rerun this block verbatim until all seven echoes print `0`.
- **Deterministic controls:** `set -eu` enforces fail-fast; each command writes to its own `/tmp/gate_*.log`; the sweep runs in a single shell session so environment state is shared.

### Step P-7.2 — Timeout-bounded full sweep wrapper

- **Requirement IDs:** R-4, §4.4
- **Target files:** none
- **Exact change set:** none
- **Commands to run:**
  ```bash
  /usr/bin/env perl -e 'alarm 1500; exec @ARGV' bash -c '
    set -eu
    cd /Users/vic/claude/General-Work/jarvis/jarvis-build
    ( cd JarvisTelemetry && swift build -c release ) >/tmp/gate_A.log 2>&1
    ( cd JarvisTelemetry && swift test ) >/tmp/gate_B.log 2>&1
    scripts/promo-video/.venv/bin/pytest scripts/promo-video/tests/ -v >/tmp/gate_C.log 2>&1
    shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh >/tmp/gate_D.log 2>&1
    rg -n --glob "!**/.build/**" --glob "!**/.venv/**" --glob "!**/node_modules/**" \
       "/Users/[a-zA-Z0-9_]+" scripts JarvisTelemetry/Sources JarvisTelemetry/Tests \
       build-app.sh start-jarvis.sh stop-jarvis.sh >/tmp/gate_E.log || true
    /usr/bin/test ! -s /tmp/gate_E.log
    tests/.venv/bin/python3 -c "import importlib.util; \
      s=importlib.util.spec_from_file_location(\"vc\",\"tests/visual_capture.py\"); \
      m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(\"ok\")" \
      >/tmp/gate_F.log 2>&1
    grep -q "^ok$" /tmp/gate_F.log
    git diff --quiet HEAD -- docs/JARVIS-SYSTEM-PROMPT.md docs/JARVIS-TELEMETRY-PROMPT.md \
                             docs/JarvisOS-Agent-Plan.md docs/macOS_Telemetry_App.md
    echo ALL_GATES_PASS
  '
  echo "sweep_exit=$?"
  ```
- **Expected PASS evidence:** stdout ends with `ALL_GATES_PASS` and `sweep_exit=0`. Each `/tmp/gate_*.log` exists and matches the per-gate pass signature.
- **Failure triage action:** A non-zero `sweep_exit` (including alarm-forced exit 142) identifies the first failing gate via inspection of `/tmp/gate_*.log` ordering; remediate in the owning P-1..P-4 section then rerun.

## Ledger Generation · P-8 Completion ledger

### Step P-8.1 — Emit the Requirement → SC → Gate → Evidence ledger

- **Requirement IDs:** SC-7
- **Target files:** `/tmp/ledger.md` (session artifact, not committed)
- **Exact change set:** write a markdown table with the mapping below.
- **Commands to run:**
  ```bash
  cat > /tmp/ledger.md <<'LEDGER'
  | Requirement | Success Criterion | Gate | Validation Evidence | Status |
  |-------------|-------------------|------|---------------------|--------|
  | R-1 Source-of-truth contract | SC-7 | — | `docs/remediation-checklist.md` references active tree only | PASS |
  | R-2 Output contract | SC-3, SC-4, SC-6 | — | Checklist has Step ID / Req IDs / Target files / Exact change set / Commands / Expected PASS evidence / Failure triage per step | PASS |
  | R-3 Gap-closure targeting | SC-1 | D, E, F | Every Gate D/E/F remediation step resolves an observed failure; no partials left | PASS |
  | R-4.1 Gate A | SC-2, SC-5 | A | /tmp/gate_A.log ends with `Build complete!` | PASS |
  | R-4.2 Gate B | SC-2, SC-5 | B | /tmp/gate_B.log shows `Executed N tests, with 0 failures` (N ≥ 58) | PASS |
  | R-4.3 Gate C | SC-2, SC-5 | C | /tmp/gate_C.log ends with `N passed` (N ≥ 7) | PASS |
  | R-4.5 Gate D | SC-2, SC-5 | D | /tmp/gate_D.log empty, shellcheck_exit=0 | PASS |
  | R-4.5 Gate E | SC-2, SC-5 | E | /tmp/gate_E.log empty | PASS |
  | R-4.6 Gate F | SC-2, SC-5 | F | /tmp/gate_F.log ends with `ok` | PASS |
  | R-4.7 Gate G | SC-2, SC-5 | G | git diff --quiet returns 0 for protected docs | PASS |
  | R-5 Safety and scope | SC-6 | — | Diff confined to named files; protected docs untouched | PASS |
  LEDGER
  cat /tmp/ledger.md
  ```
- **Expected PASS evidence:** `/tmp/ledger.md` prints the complete table; every row ends in `PASS`.
- **Failure triage action:** If any row is not `PASS`, return to the owning step and remediate; regenerate the ledger.

## Test Plan

| Test ID | Requirement ID(s) | Gate ID | Command | Expected output signature | Pass/fail decision rule |
|--------|-------------------|---------|---------|---------------------------|-------------------------|
| T-A1 | R-4.1 | A | `cd JarvisTelemetry && swift build -c release` | `Build complete!` | `exit == 0` |
| T-B1 | R-4.2 | B | `cd JarvisTelemetry && swift test` | `Executed N tests, with 0 failures` (N ≥ 58) | `exit == 0` and `0 failures` |
| T-C1 | R-4.3 | C | `scripts/promo-video/.venv/bin/pytest scripts/promo-video/tests/ -v` | `N passed` (N ≥ 7) | `exit == 0` |
| T-D1 | R-4.5 | D | `shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh` | empty stdout | `exit == 0` |
| T-E1 | R-4.5, §4.5 | E | `rg '/Users/[a-zA-Z0-9_]+' scripts JarvisTelemetry/Sources JarvisTelemetry/Tests build-app.sh start-jarvis.sh stop-jarvis.sh` | empty stdout | no matches |
| T-F1 | R-4.6 | F | `tests/.venv/bin/python3 -c "import importlib.util; s=importlib.util.spec_from_file_location('vc','tests/visual_capture.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print('ok')"` | `ok` | `exit == 0` |
| T-G1 | R-4.7 | G | `git diff --quiet HEAD -- docs/JARVIS-SYSTEM-PROMPT.md docs/JARVIS-TELEMETRY-PROMPT.md docs/JarvisOS-Agent-Plan.md docs/macOS_Telemetry_App.md` | empty stdout | `exit == 0` |
| T-SWEEP | R-4 (all), SC-5 | A..G | P-7.2 wrapper block | `ALL_GATES_PASS` | `sweep_exit == 0` |

## Deliverables Map

| Deliverable | Requirement IDs | SC IDs | Validation method |
|-------------|------------------|--------|--------------------|
| Ordered remediation checklist | R-2, R-3 | SC-1, SC-3, SC-4, SC-6 | This file, step sequence P-0 → P-8 |
| Per-gate validation command set | R-4 | SC-2 | P-6.A..G |
| One-shot all-gates sweep block | R-4, §4.6 | SC-5 | P-7.1 and P-7.2 |
| Evidence capture ledger template | SC-7 | SC-7 | P-8.1 emits `/tmp/ledger.md` |
| Residual-risk section | R-5 | SC-6 | Section below; empty on full PASS |

## Residual-Risk Section

On simultaneous Gate A..G PASS (Step P-7.2 emits `ALL_GATES_PASS`), this section is empty.

Until that sweep completes without remediation, the following advisory items remain deferred and are out of scope for this checklist:

- R-67 AppDelegate.swift split (tracked in `docs/tech-debt.md`).

## Execution Order

1. P-0.1 → P-0.4 — preflight environment bootstrap.
2. P-1.1 → P-1.6, P-1.7a → P-1.7d, P-1.8 — Gate D remediation.
3. P-2.1 — Gate E assertion.
4. P-3.1 → P-3.3 — Gate F harness readiness.
5. P-4.1 — Gate G assertion.
6. P-5.1 — approval checkpoint for shebang diffs.
7. P-6.A → P-6.G — per-gate verification.
8. P-7.1, P-7.2 — atomic full sweep.
9. P-8.1 — ledger emission.
10. Exit only when every `gate_X=0` echo is present and the ledger has no non-PASS rows.
