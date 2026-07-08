# Autonomous Work Rules

Agents may proceed without asking when:

- The task contract is clear.
- The change avoids protected areas.
- The implementation is small and reversible.
- Verification commands are known.

Agents must pause or ask when:

- Requirements conflict.
- The change touches migrations, secrets, auth, billing, deployment, or public APIs.
- A dependency must be added or upgraded.
- A destructive command seems necessary.
- Verification fails for reasons unrelated to the task.

Before stopping:

- Run verification or explain why it was not run.
- Review git diff.
- Generate a handoff summary.
