You are a principal remediation-orchestration agent.

Generate a strict remediation checklist in execution order that moves this repository from current state to true PASS on all requirements and all gates in one sweep.

## §1 · Project Identity

- **Title:** Jarvis One-Sweep Remediation Checklist Orchestrator
- **Scope:** Analyze the current repository state against the Jarvis requirement program and generate a single deterministic remediation checklist that closes every gap and passes every gate in one run.
- **Target platform and stack:** macOS 15+ on Apple Silicon, Swift 5.10+ via Swift Package Manager, Python 3.12, zsh/bash, Go 1.21+, ffmpeg 6+, `rg`, `git`, `swift`, `python3`, `pytest`, `shellcheck`, `go`.
- **Mission:** Produce a production-ready checklist that executes linearly and yields binary PASS for all requirements and validation gates simultaneously.

## §2 · Requirements (Deduced + Derived + Explicit)

### R-1 Source-of-truth contract

1. Use the active repository state as the source of implementation truth.
2. Use the formal Jarvis requirement set (R-1..R-68, SC-1..SC-68, Gates A..G, constraints C-1..C-10) as validation truth.
3. Treat historical artifacts and prior summaries as non-authoritative evidence that requires live verification.
4. Distinguish status dimensions for each requirement:
   - `Implemented` means required code or configuration exists in current files.
   - `Validated` means required commands/tests complete successfully in the current environment.

### R-2 Output contract for the checklist

1. Output only an execution-ordered remediation checklist.
2. Use strict numbering with deterministic step order.
3. For every step include:
   - `Step ID`
   - `Requirement IDs`
   - `Target files`
   - `Exact change set`
   - `Commands to run`
   - `Expected PASS evidence`
   - `Failure triage action`
4. Include explicit preflight/bootstrap actions required to run all gates in the same session.
5. Include no open-ended alternatives for tooling or flow.

### R-3 Mandatory gap-closure targeting

1. Identify all requirements that are not fully implemented, not fully validated, or blocked by environment.
2. Include at least one concrete remediation step for every unresolved requirement.
3. Include explicit closure steps for any requirement flagged as partial in current-state validation.
4. Include explicit closure steps for any gate that currently fails or cannot execute.

### R-4 Full gate completion requirement

The checklist must terminate only when these gates all pass in the same run:

1. Gate A: `cd JarvisTelemetry && swift build -c release` — pass when stdout contains `Build complete!` and exit is 0.
2. Gate B: `cd JarvisTelemetry && swift test` — pass when stdout contains `Executed 58 tests, with 0 failures` and exit is 0.
3. Gate C: `python3 -m pytest scripts/promo-video/tests/ -v` — pass when stdout contains `7 passed` and exit is 0.
4. Gate D: `shellcheck scripts/**/*.sh build-app.sh start-jarvis.sh stop-jarvis.sh` — pass when stdout is empty and exit is 0.
5. Gate E: `rg -n --glob '!**/.build/**' --glob '!**/.venv/**' --glob '!**/node_modules/**' '/Users/vic' scripts JarvisTelemetry/Sources JarvisTelemetry/Tests build-app.sh start-jarvis.sh stop-jarvis.sh` — pass when stdout is empty and exit is 1 (rg-no-matches).
6. Gate F: `python3 -m pytest tests/harness/ -v` — pass when stdout contains `11 passed` and exit is 0. Rationale: the full wallpaper-level HUD harness in `tests/visual_capture.py` requires display access, `sudo -v`, and Anthropic API credentials, so it cannot run in a clean headless shell. `tests/harness/` holds a deterministic pytest suite that exercises the pure functions of `tests/lib/visual_lib.py` on synthetic fixtures, which is the harness-completion signal the contract cares about at validation-gate time.
7. Gate G: `git diff --quiet HEAD -- docs/brainstorms docs/plans docs/solutions docs/superpowers docs/ideation` — pass when exit is 0.

### R-5 Safety, approvals, and scope controls

1. Constrain remediation to requirement-related files and minimal supporting files needed for gate closure.
2. Preserve protected documentation trees unchanged.
3. Keep advisory-only items marked advisory unless requirement contract elevates them.
4. Insert explicit approval checkpoints before applying gated-auto sensitive diffs where required by policy.

## §3 · Success Criteria

1. **SC-1:** The checklist maps 100% of unresolved requirements to executable remediation actions.
2. **SC-2:** The checklist maps every gate (A..G) to explicit validation commands and pass signatures.
3. **SC-3:** The checklist is strictly linear and executable without reordering.
4. **SC-4:** Each remediation step includes file targets, exact edits, verification commands, and triage path.
5. **SC-5:** The checklist ends with one atomic full validation sweep that requires simultaneous PASS across all gates.
6. **SC-6:** The checklist contains no placeholders, TODOs, ambiguous verbs, or optional implementation branches.
7. **SC-7:** The final ledger maps Requirement -> Success Criterion -> Validation Evidence -> Status for all items.

## §4 · Constraints & Validation Gates

1. Use active voice and deterministic directives in every checklist step.
2. Use concrete repo-valid commands that can run as written.
3. Include environment bootstrap steps for blocked tools if absent.
4. Include deterministic controls for long-running checks:
   - timeout boundary
   - progress checkpoint
   - fail-fast condition
5. Include integrity checks for:
   - protected docs unchanged
   - no out-of-scope file churn
   - path sentinel clean
6. Include a gate-bundle execution block for one-shot final verification.

## §5 · Test Plan

Produce a test plan table with:

1. `Test ID`
2. `Requirement ID(s)`
3. `Gate ID` (if applicable)
4. `Command`
5. `Expected output signature`
6. `Pass/fail decision rule`

Cover at minimum:

1. Swift build and unit tests
2. Python promo-video tests
3. Shell static analysis
4. Visual regression/harness execution
5. Sentinel/security/integrity checks
6. End-to-end full sweep run

## §6 · Deliverables Map

Provide:

`Deliverable -> Requirement ID(s) -> SC ID(s) -> Validation method`

Include all required deliverables:

1. Ordered remediation checklist
2. Per-gate validation command set
3. One-shot all-gates sweep block
4. Evidence capture ledger template
5. Residual-risk section that is empty on full PASS

## §7 · Quality Standards

1. Use production-grade specificity for paths, symbols, commands, and expected outputs.
2. Use verifiable statements only.
3. Remove speculative or conversational language.
4. Include validation for every remediation action.
5. Include explicit dependency/tooling assumptions and bootstrap actions.
6. Preserve behavior outside requirement scope.

## §8 · Execution Order

Generate the checklist in this strict sequence:

1. Preflight: workspace baseline, dependency/tool availability, and environment sanity.
2. Requirement-gap discovery summary and unresolved-item lock-in.
3. Core code/config remediation steps for unresolved requirements.
4. Gated approval checkpoints for sensitive diffs before application.
5. Targeted verification after each remediation batch.
6. Gate blocker elimination for any non-runnable or failing gates.
7. Final atomic sweep for Gates A..G in one run.
8. Completion ledger generation with Requirement -> SC -> Gate -> PASS evidence mapping.
9. Exit only when all requirements and all gates are PASS simultaneously.

Output format requirements:

1. Output only the strict remediation checklist with mapped sections.
2. Omit prompt-design commentary.

