# Bugfix Loop

Use this loop when correcting broken behavior.

Required inputs:

- Reproduction steps or failing case
- Expected behavior
- Actual behavior
- Scope constraints

Process:

1. Reproduce or explain why reproduction is unavailable.
2. Add a failing test when practical.
3. Make the smallest fix that passes.
4. Verify the original failure no longer occurs.
5. Check nearby regressions.

Acceptance criteria:

- The failure is fixed.
- The fix is covered by automated or documented manual verification.
- The change avoids broad rewrites.

Verification:

- Run the targeted test first.
- Run configured verification commands.

Handoff output:

- Root cause summary
- Files changed
- Tests run
- Residual risk
