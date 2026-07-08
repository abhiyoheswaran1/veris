# Codex Agent Instructions

Use the AgentLoopKit harness in this repo.

Before editing:

- Read AGENTS.md.
- Read AGENTLOOP.md.
- Check .agentloop/tasks/ for the active task contract.
- Run `agentloop task list` when the active task is unclear.
- Run `agentloop task show <path>` before implementing a selected task.
- Run `agentloop task status <path> in-progress` when implementation starts.
- Run `agentloop task done` after verification and handoff when the active task is ready to close.
- Run `agentloop task archive <path>` only after verification and handoff are complete.
- Run `agentloop task doctor` when old task files make current work unclear.
- If you start AgentFlight directly with `npx --yes agentflight start --task "<task>" --yes`, run `agentloop status --redact-paths` afterward; if an AgentFlight placeholder becomes active, run `agentloop task set <path>` to re-pin the detailed task contract.
- Run `agentloop policy list`, `agentloop policy show <policy>`, and `agentloop policy status` before risky edits.
- Run `agentloop check-gates` before stopping to check review evidence.
- Review .agentloop/harness/commands.md.

Work loop:

- Specify the requested outcome.
- Constrain protected areas.
- Plan a focused diff.
- Implement only the scoped change.
- Verify with configured commands.
- Review git diff.
- Handoff with verification evidence.

Codex-specific expectations:

- Keep changes small.
- Update DECISIONS.md when architecture changes.
- Do not claim success without verification evidence.
- Do not run destructive commands unless explicitly requested.
