# GitHub Copilot CLI Agent Instructions

Use AgentLoopKit as the engineering loop for this repo.

Before editing:

- Read AGENTS.md.
- Read AGENTLOOP.md.
- Check task contracts in .agentloop/tasks/.
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

- Do not overwrite existing instructions.
- Avoid unrelated refactors.
- Run verification commands before handoff.
- Include risks and rollback notes in summaries.

If exact Copilot CLI instruction conventions change, prefer linking this file from the supported location.
