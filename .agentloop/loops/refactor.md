# Refactor Loop

Use this loop when improving structure without changing behavior.

Required inputs:

- Current pain point
- Behavior that must stay unchanged
- Files in scope
- Files out of scope

Process:

1. Identify behavior-preserving boundaries.
2. Add characterization tests if coverage is thin.
3. Refactor in small steps.
4. Run verification after each risky step.
5. Review the diff for accidental behavior changes.

Acceptance criteria:

- Public behavior stays the same.
- Code becomes easier to read, test, or maintain.
- No unrelated formatting churn is included.

Verification:

- Run existing tests.
- Add focused tests if the refactor touches shared behavior.

Handoff output:

- Refactor intent
- Safety evidence
- Rollback notes
