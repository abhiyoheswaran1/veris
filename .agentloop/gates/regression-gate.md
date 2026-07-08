# Regression Gate

Purpose: catch nearby breakage.

Checklist:

- Identify nearby modules.
- Run targeted tests for changed areas.
- Run broader verification when configured.
- Record untested paths.

Pass criteria:

- Reasonable regression surface was checked.

Fail criteria:

- Only the happy path was checked for a shared change.

Escalation triggers:

- Shared utilities
- Public APIs
- State management
- Build or deployment behavior
