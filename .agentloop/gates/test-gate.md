# Test Gate

Purpose: ensure behavior changes have evidence.

Checklist:

- New behavior has tests when practical.
- Bug fixes include a regression test when practical.
- Existing tests still pass.
- Manual checks are documented when automation is unavailable.

Pass criteria:

- Verification matches the risk of the change.

Fail criteria:

- The agent claims success without running checks or explaining why not.

Escalation triggers:

- Flaky tests
- Missing test command
- High-risk behavior without coverage
