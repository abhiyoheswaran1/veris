# Test Generation Loop

Use this loop when adding or improving tests.

Required inputs:

- Behavior to protect
- Current coverage gap
- Target files
- Verification command

Process:

1. Read the behavior and existing tests.
2. Add focused tests that exercise real code.
3. Avoid tests that only confirm mocks.
4. Run the targeted test.
5. Run the wider test command when available.

Acceptance criteria:

- Tests fail for the wrong behavior and pass for the right behavior.
- Tests are readable and maintainable.

Verification:

- Run the new test file.
- Run the configured test command.

Handoff output:

- Test coverage added
- Behaviors protected
- Gaps left open
