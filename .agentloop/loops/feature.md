# Feature Loop

Use this loop when adding user-visible behavior.

Required inputs:

- Problem statement
- Desired outcome
- Acceptance criteria
- Files or areas likely to change
- Files or areas not to touch

Process:

1. Specify the feature contract.
2. Constrain public API, data, auth, and dependency changes.
3. Plan a narrow implementation path.
4. Implement the smallest useful feature.
5. Verify with tests, typecheck, lint, and build when configured.
6. Review the diff against the contract.
7. Handoff with risks and rollback notes.

Acceptance criteria:

- User behavior is clear.
- Edge cases are handled or documented.
- No unrelated refactors are included.

Verification:

- Run configured test, lint, typecheck, and build commands.
- Add or update tests when behavior changes.

Handoff output:

- PR summary
- Verification report
- Reviewer checklist
