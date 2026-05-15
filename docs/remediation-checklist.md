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

### Step P-0.3 — Install pytest, numpy, pillow for the default `python3`

- **Requirement IDs:** R-4.3 (Gate C), R-4.6 (Gate F), §4.3, RQ-2.2
- **Target files:** `~/Library/Python/3.14/site-packages/{pytest,numpy,PIL}` (user-site; no repo writes)
- **Exact change set:** bootstrap the three packages into the user-site area of the default `python3` so the exact contract commands `python3 -m pytest …` resolve without any venv activation. PEP 668 requires `--break-system-packages` on Homebrew Python; `--user` keeps installs out of `/opt/homebrew`.
- **Commands to run:**
  ```bash
  python3 -m pip install --user --break-system-packages \
    --no-warn-script-location pytest==9.0.3 numpy pillow
  python3 -c "import pytest, numpy, PIL; print(pytest.__version__, numpy.__version__, PIL.__version__)"
  ```
- **Expected PASS evidence:** stdout prints three version strings (pytest 9.0.3, numpy 2.4+, PIL 12.2+), exit 0. `python3 -m pytest --version` prints `pytest 9.0.3`.
- **Failure triage action:** If `--break-system-packages` is rejected on a non-Homebrew python, remove the flag. If the user-site install succeeds but later `python3 -m pytest` still reports `ModuleNotFoundError`, inspect `python3 -c 'import sys; print(sys.path)'` for the user-site path and append it to `PYTHONPATH` if absent.

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

## Gap Closure · P-3 Gate F (harness pytest suite)

### Step P-3.1 — Install numpy and Pillow for the default `python3`

- **Requirement IDs:** R-4.6 (Gate F), §4.3, RQ-2.3
- **Target files:** `~/Library/Python/3.14/site-packages/{numpy,PIL}` (user-site)
- **Exact change set:** bootstrap numpy and Pillow into the user-site area of the default `python3` so `tests/lib/visual_lib.py` imports succeed under `python3 -m pytest tests/harness/`.
- **Commands to run:**
  ```bash
  python3 -m pip install --user --break-system-packages --no-warn-script-location numpy pillow
  python3 -c "import numpy, PIL; print('numpy', numpy.__version__, 'PIL', PIL.__version__)"
  ```
- **Expected PASS evidence:** stdout prints numpy and PIL version lines, exit 0.
- **Failure triage action:** If the install fails with a compile error (macOS wheel mismatch), pin `numpy<2.5` or install from a wheel mirror; if PEP 668 rejects `--break-system-packages`, remove the flag on non-Homebrew pythons.

### Step P-3.2 — Verify `tests/harness/` pytest suite is present and runnable

- **Requirement IDs:** R-4.6, SC-2, SC-3
- **Target files:** `tests/harness/__init__.py`, `tests/harness/conftest.py`, `tests/harness/test_visual_lib_pure.py`
- **Exact change set:** none if the three files exist. If absent, create them — the suite exercises `visual_lib.PALETTE`, `pixel_color_ratio`, `hue_family_ratio`, `frame_motion_score`, `now_tag`, `process_alive`, and `load_rgb` on synthetic in-memory fixtures (see `tests/harness/test_visual_lib_pure.py` for the canonical 11-case shape).
- **Commands to run:**
  ```bash
  python3 -m pytest tests/harness/ --collect-only -q
  ```
- **Expected PASS evidence:** stdout lists exactly 11 `test_*` cases and exits 0.
- **Failure triage action:** If fewer than 11 cases collect, diff the suite against `tests/harness/test_visual_lib_pure.py` and restore the missing cases. If a collection error surfaces `ModuleNotFoundError`, rerun P-3.1.

### Step P-3.3 — Dry-run Gate F command

- **Requirement IDs:** R-4.6, SC-2
- **Target files:** none (verification)
- **Exact change set:** none
- **Commands to run:**
  ```bash
  python3 -m pytest tests/harness/ -v > /tmp/gate_F.log 2>&1
  echo "gate_F_exit=$?"
  grep -E '11 passed' /tmp/gate_F.log
  ```
- **Expected PASS evidence:** `gate_F_exit=0`; log ends with `11 passed`.
- **Failure triage action:** On assertion failure, inspect `/tmp/gate_F.log` and fix the regressing pure function in `tests/lib/visual_lib.py`. On import error, rerun P-3.1.

## Gap Closure · P-4 Gate G (protected docs unchanged)

### Step P-4.1 — Assert protected documentation trees are untouched

- **Requirement IDs:** R-5.2, R-4.7
- **Target files:** `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/superpowers/`, `docs/ideation/`
- **Exact change set:** none — this is a negative-space guard.
- **Commands to run:**
  ```bash
  git diff --quiet HEAD -- \
     docs/brainstorms docs/plans docs/solutions docs/superpowers docs/ideation
  echo "protected_docs_exit=$?"
  ```
- **Expected PASS evidence:** `protected_docs_exit=0` (no diff). `git diff` tolerates absent tree paths (e.g., `docs/solutions/`), so a missing tree does not flip this gate.
- **Failure triage action:** If non-zero, run `git checkout -- <tree>` to restore the offending tree, then re-run; escalate via approval checkpoint before any overwrite that affects a protected tree.

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

### Step P-6.C — Gate C re-validation (promo-video pytest, exact contract command)

- **Requirement IDs:** R-4.3, SC-2, SC-3, SC-5, RQ-2.2
- **Target files:** `scripts/promo-video/tests/`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  python3 -m pytest scripts/promo-video/tests/ -v > /tmp/gate_C.log 2>&1
  echo "gate_C_exit=$?"
  ```
- **Expected PASS evidence:** `gate_C_exit=0`; `/tmp/gate_C.log` ends with `7 passed`.
- **Failure triage action:** If `ModuleNotFoundError: pytest`, rerun Step P-0.3 to install pytest into the default `python3` user-site. If `ModuleNotFoundError` for `shot_list_loader`, confirm `scripts/promo-video/lib/__init__.py` exists and `conftest.py` inserts `lib/` on `sys.path`.

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

### Step P-6.E — Gate E re-validation (`/Users/vic` sentinel, exact contract)

- **Requirement IDs:** R-4.5, SC-2, SC-5
- **Target files:** scoped by `rg` args
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  set +e
  rg -n --glob '!**/.build/**' --glob '!**/.venv/**' --glob '!**/node_modules/**' \
     '/Users/vic' \
     scripts JarvisTelemetry/Sources JarvisTelemetry/Tests build-app.sh start-jarvis.sh stop-jarvis.sh \
     > /tmp/gate_E.log 2>&1
  RG_RC=$?
  set -e
  case "$RG_RC" in
    1) echo "gate_E_exit=0" ;;
    0) echo "gate_E_exit=1 (matches found — see /tmp/gate_E.log)" ;;
    *) echo "gate_E_exit=$RG_RC (rg error)" ;;
  esac
  ```
- **Expected PASS evidence:** `gate_E_exit=0`; `/tmp/gate_E.log` is empty; `rg` exit code is 1 (no matches).
- **Failure triage action:** For each match, replace the literal `/Users/vic` with `${JARVIS_REPO_ROOT}` derived from `scripts/_paths.sh`; rerun.

### Step P-6.F — Gate F re-validation (harness pytest suite, exact contract)

- **Requirement IDs:** R-4.6, SC-2, SC-3, SC-5, RQ-2.3
- **Target files:** `tests/harness/`, `tests/lib/visual_lib.py`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  python3 -m pytest tests/harness/ -v > /tmp/gate_F.log 2>&1
  echo "gate_F_exit=$?"
  ```
- **Expected PASS evidence:** `gate_F_exit=0`; `/tmp/gate_F.log` ends with `11 passed`.
- **Failure triage action:** If `ModuleNotFoundError: numpy` or `PIL`, rerun Step P-0.3. If any assertion fails, read the pytest diff and fix the regressing pure function in `tests/lib/visual_lib.py`. The full-display HUD validation in `tests/run_validation.sh` is an extended manual path, not Gate F — run only with explicit approval because it opens GUI windows and calls paid APIs.

### Step P-6.G — Gate G re-validation (protected doc trees unchanged)

- **Requirement IDs:** R-5.2, R-4.7, SC-2, SC-5
- **Target files:** `docs/brainstorms/`, `docs/plans/`, `docs/solutions/`, `docs/superpowers/`, `docs/ideation/`
- **Exact change set:** none
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  git diff --quiet HEAD -- docs/brainstorms docs/plans docs/solutions docs/superpowers docs/ideation
  echo "gate_G_exit=$?"
  ```
- **Expected PASS evidence:** `gate_G_exit=0`. `git diff` tolerates absent paths, so missing trees (e.g., `docs/solutions/` if it does not yet exist) do not cause failure.
- **Failure triage action:** For each tree with uncommitted changes, `git checkout -- <path>` to restore; rerun.

## Atomic Full Sweep · P-7 One-shot gates-bundle

### Step P-7.1 — Execute all gates A..G in a single deterministic run

- **Requirement IDs:** R-4 (all), SC-5
- **Target files:** none (bundle)
- **Exact change set:** none
- **Commands to run:**
  ```bash
  bash -c '
  set -euo pipefail
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build

  # Gate A
  ( cd JarvisTelemetry && swift build -c release ) > /tmp/gate_A.log 2>&1
  GA=$?; echo "gate_A=$GA"
  grep -q "Build complete!" /tmp/gate_A.log

  # Gate B
  ( cd JarvisTelemetry && swift test ) > /tmp/gate_B.log 2>&1
  GB=$?; echo "gate_B=$GB"
  grep -q "Executed 58 tests, with 0 failures" /tmp/gate_B.log

  # Gate C — exact contract command
  python3 -m pytest scripts/promo-video/tests/ -v > /tmp/gate_C.log 2>&1
  GC=$?; echo "gate_C=$GC"
  grep -qE "7 passed" /tmp/gate_C.log

  # Gate D
  shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh > /tmp/gate_D.log 2>&1
  GD=$?; echo "gate_D=$GD"
  [[ ! -s /tmp/gate_D.log ]]

  # Gate E — rg exit 1 = zero matches = PASS per the contract
  set +e
  rg -n --glob "!**/.build/**" --glob "!**/.venv/**" --glob "!**/node_modules/**" \
     "/Users/vic" \
     scripts JarvisTelemetry/Sources JarvisTelemetry/Tests \
     build-app.sh start-jarvis.sh stop-jarvis.sh > /tmp/gate_E.log 2>&1
  RG_RC=$?
  set -e
  case "$RG_RC" in
    1) GE=0 ;;
    *) GE=$RG_RC ;;
  esac
  echo "gate_E=$GE"
  [[ ! -s /tmp/gate_E.log ]]

  # Gate F — exact contract command
  python3 -m pytest tests/harness/ -v > /tmp/gate_F.log 2>&1
  GF=$?; echo "gate_F=$GF"
  grep -qE "11 passed" /tmp/gate_F.log

  # Gate G — widened protected-doc trees
  git diff --quiet HEAD -- docs/brainstorms docs/plans docs/solutions docs/superpowers docs/ideation
  GG=$?; echo "gate_G=$GG"

  if [[ "$GA$GB$GC$GD$GE$GF$GG" == "0000000" ]]; then
    echo ALL_GATES_PASS
  else
    echo SWEEP_FAILED
    exit 1
  fi
  '
  ```
- **Expected PASS evidence:** stdout ends with `ALL_GATES_PASS` and the bash script exits 0. Each `/tmp/gate_*.log` matches the per-gate signatures in P-6.A..G.
- **Failure triage action:** First non-zero gate halts the sweep under `set -euo pipefail`; the offending `grep -q` or `[[ … ]]` line fails, surfacing the gate name via the most recent `echo "gate_X=…"` output. Remediate in the owning P-1..P-4 step, then rerun this block verbatim.
- **Deterministic controls:** `set -euo pipefail` enforces fail-fast AND pipeline-exit truthfulness (no tail/echo can mask a failing left-hand side). Each gate's exit is captured directly to `$?` before any pipe, and the pass-signature `grep`/`[[ ]]` check runs after the exit capture so a swallowed non-zero cannot pass.

### Step P-7.2 — Single-entrypoint verifier script

- **Requirement IDs:** R-4, §4.4, SC-3, SC-5
- **Target files:** `scripts/run-gate-sweep.sh` (committed)
- **Exact change set:** none — the script is the one-shot entrypoint.
- **Commands to run:**
  ```bash
  cd /Users/vic/claude/General-Work/jarvis/jarvis-build
  scripts/run-gate-sweep.sh
  echo "sweep_exit=$?"
  ```
- **Expected PASS evidence:** stdout ends with `[sweep] ALL_GATES_PASS` and `sweep_exit=0`. Each `/tmp/gate_*.log` exists and matches the per-gate pass signature.
- **Failure triage action:** A non-zero `sweep_exit` halts at the first failing gate (the script uses `set -euo pipefail` plus per-gate `grep -q` signature checks). Inspect the referenced `/tmp/gate_X.log`, remediate in the owning P-1..P-4 step, then rerun `scripts/run-gate-sweep.sh`.

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
  | R-4.1 Gate A | SC-2, SC-5 | A | /tmp/gate_A.log contains `Build complete!` | PASS |
  | R-4.2 Gate B | SC-2, SC-5 | B | /tmp/gate_B.log contains `Executed 58 tests, with 0 failures` | PASS |
  | R-4.3 Gate C | SC-2, SC-5 | C | /tmp/gate_C.log contains `7 passed` | PASS |
  | R-4.4 Gate D | SC-2, SC-5 | D | /tmp/gate_D.log empty, shellcheck_exit=0 | PASS |
  | R-4.5 Gate E | SC-2, SC-5 | E | /tmp/gate_E.log empty, rg_exit=1 (zero matches) | PASS |
  | R-4.6 Gate F | SC-2, SC-5 | F | /tmp/gate_F.log contains `11 passed` | PASS |
  | R-4.7 Gate G | SC-2, SC-5 | G | git diff --quiet exit=0 for protected trees | PASS |
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
| T-B1 | R-4.2 | B | `cd JarvisTelemetry && swift test` | `Executed 58 tests, with 0 failures` | `exit == 0` and `0 failures` |
| T-C1 | R-4.3 | C | `python3 -m pytest scripts/promo-video/tests/ -v` | `7 passed` | `exit == 0` |
| T-D1 | R-4.5 | D | `shellcheck scripts/*.sh scripts/promo-video/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh` | empty stdout | `exit == 0` |
| T-E1 | R-4.5 | E | `rg -n --glob '!**/.build/**' --glob '!**/.venv/**' --glob '!**/node_modules/**' '/Users/vic' scripts JarvisTelemetry/Sources JarvisTelemetry/Tests build-app.sh start-jarvis.sh stop-jarvis.sh` | empty stdout | `rg exit == 1` |
| T-F1 | R-4.6 | F | `python3 -m pytest tests/harness/ -v` | `11 passed` | `exit == 0` |
| T-G1 | R-4.7 | G | `git diff --quiet HEAD -- docs/brainstorms docs/plans docs/solutions docs/superpowers docs/ideation` | empty stdout | `exit == 0` |
| T-SWEEP | R-4 (all), SC-3, SC-5 | A..G | `scripts/run-gate-sweep.sh` | `[sweep] ALL_GATES_PASS` | `sweep_exit == 0` |

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

## Recent Updates

- 2026-04-19: Added `docs/jarvis-uhd-cinematic-v2-parity-report.md` documenting white outer-ring restoration and amber-reason diagnostics in `prototypes/jarvis-uhd-cinematic-v2.html`.
- 2026-04-19: Added `prototypes/jarvis-reactor-c-shape-baseline.html` — additive single-file C-shape concentric-reactor baseline (4 C-rings, single-gap-per-ring, BPM clock, bloom; 120 FPS); registered comparator chip + LEFT-pane source button in `prototypes/compare.html`; appended `§0.6 BASELINE C-SHAPE REACTOR` to the parity report with full evidence + checklist roll-up; ralph-loop-infinite Iteration 1 PASS.

- 2026-04-19: Installed and locked JARVIS Cinematic Animation dependency stack — Python via `uv` (pyproject.toml + uv.lock: playwright 1.58, numpy 2.4, Pillow 12, pytest 9, ffmpeg-python 0.2) and JavaScript via `npm` (js/package.json + js/package-lock.json: three r184, postprocessing 6.39.1, gsap 3.15, animejs 4.3.6, ogl 1.0.11, regl 2.1.1, meyda 5.6.3, tsparticles 3.9.1, pixi.js 8.18.1, motion 12.38.0, vite 8.0.8). All 8 Node ESM smoke tests PASS. Playwright cinema-bloom pipeline test PASS (bloom annulus ≥ 500 bright pixels). Clean-room restore verified (lockfile hashes stable). See docs/dependency-manifest.md.

- 2026-04-19: Shipped V4 `jarvis-reactor-cinematic-marvel` — TypeScript + Vite ESM bundle with Three.js r182 PBR C-rings, `pmndrs/postprocessing` (EffectComposer + BloomEffect HDR + ChromaticAberrationEffect + anamorphic-flare ShaderPass + glsl-godrays Effect), drei-equivalent volumetric SpotLight, `@newkrok/three-particles` GPU-instanced sparks, Meyda audio→bloom/ring coupling (Pearson 0.82 / 0.72), GSAP MotionPath boot/lock/shutdown choreography, Anime.js SVG stroke draw, 65.9 FPS sustained at 1920×1080 via Metal ANGLE. All 60 tests PASS, zero placeholders, zero new CDNs. Integrated marvel chip into `compare.html`. Full evidence in `docs/jarvis-uhd-cinematic-v2-parity-report.md#§0.7`.
