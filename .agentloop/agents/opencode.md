# OpenCode Agent Instructions

Use AgentLoopKit as the working loop for this repository.

Before editing:

- Read AGENTS.md.
- Read AGENTLOOP.md.
- Check .agentloop/tasks/.
- Run `agentloop task list` when current work is unclear.
- Run `agentloop task show <path>` before implementing a selected task.
- Run `agentloop task status <path> in-progress` when implementation starts.
- Run `agentloop task done` after verification and handoff when the active task is ready to close.
- Run `agentloop task archive <path>` only after verification and handoff are complete.
- Run `agentloop task doctor` when old task files make current work unclear.
- If you start AgentFlight directly with `npx --yes agentflight start --task "<task>" --yes`, run `agentloop status --redact-paths` afterward; if an AgentFlight placeholder becomes active, run `agentloop task set <path>` to re-pin the detailed task contract.
- Run `agentloop policy list`, `agentloop policy show <policy>`, and `agentloop policy status` before risky edits.
- Run `agentloop check-gates` before stopping to check review evidence.

Rules:

- Do not take destructive actions without explicit approval.
- Prefer small diffs.
- Verify before completion.
- Summarize changed files, tests, risks, and rollback notes.

If OpenCode config conventions differ in your setup, paste or link this file into the appropriate agent instructions.
